package service

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	einoSchema "github.com/cloudwego/eino/schema"
	"github.com/goccy/go-yaml"
	"go.uber.org/zap"

	"scene-script/config"
	"scene-script/internal/model"
	"scene-script/pkg/logn"
)

var (
	chapterIDPattern = regexp.MustCompile(`^ch\d+$`)
	sceneIDPattern   = regexp.MustCompile(`^ch\d+\.sc\d+$`)
	beatIDPattern    = regexp.MustCompile(`^ch\d+\.sc\d+\.b\d+$`)
	quotedTermRegexp = regexp.MustCompile(`[“"《](.{2,20}?)[”"》]`)
)

// ScriptConverter - Script conversion service.
type ScriptConverter struct {
	llm           LLMProvider
	llmConfig     *config.LLMConf
	promptManager *PromptManager
}

// ConvertRequest - Conversion request.
type ConvertRequest struct {
	Chapters []ChapterInput `json:"chapters"`
	Genre    string         `json:"genre"`
	Tone     string         `json:"tone"`
	Pacing   string         `json:"pacing"`
}

// ChapterInput - Chapter input.
type ChapterInput struct {
	Title string `json:"title"`
	Text  string `json:"text"`
}

// ConvertResult - Normalized conversion output returned to logic layer.
type ConvertResult struct {
	YAML              string
	ScriptTitle       string
	Summary           model.ScriptSummary
	ConsistencyReport model.ConsistencyReport
	Usage             *einoSchema.TokenUsage
}

type ConvertProgress struct {
	Stage   string
	Message string
}

type ConvertProgressReporter func(ConvertProgress)

const (
	longFormTotalCharsThreshold    = 12000
	longFormSingleChapterThreshold = 4500
	longFormSummaryTargetChars     = 900
)

// NewScriptConverter - Create a new script converter.
func NewScriptConverter(cfg *config.LLMConf, llm LLMProvider) (*ScriptConverter, error) {
	if llm == nil {
		client, err := NewLLMClient(cfg)
		if err != nil {
			return nil, err
		}
		llm = client
	}

	return &ScriptConverter{
		llm:           llm,
		llmConfig:     cfg,
		promptManager: NewPromptManager(&cfg.Prompt),
	}, nil
}

// Convert - Convert novel text into normalized screenplay YAML.
func (sc *ScriptConverter) Convert(ctx context.Context, req ConvertRequest) (*ConvertResult, error) {
	return sc.ConvertWithProgress(ctx, req, nil)
}

// ConvertWithProgress - Convert novel text into normalized screenplay YAML with optional stage reporting.
func (sc *ScriptConverter) ConvertWithProgress(ctx context.Context, req ConvertRequest, report ConvertProgressReporter) (*ConvertResult, error) {
	if err := sc.validateRequest(req); err != nil {
		return nil, err
	}

	logn.Debug("script converter start",
		TaskLogFields(ctx, "converter_start",
			zap.Int("chapters", len(req.Chapters)),
			zap.String("genre", req.Genre),
			zap.String("tone", req.Tone),
			zap.String("pacing", req.Pacing),
		)...,
	)
	workingReq := req
	preprocessUsage := (*einoSchema.TokenUsage)(nil)
	if sc.shouldUseLongFormMode(req) {
		sc.reportProgress(report, ScriptTaskStageSummarizing, "原文篇幅较长，正在逐章提炼摘要后再生成剧本。")
		compressedReq, usage, err := sc.compressLongFormRequest(ctx, req)
		if err != nil {
			logn.Error("script converter long form summarizing failed", TaskLogFields(ctx, ScriptTaskStageSummarizing, zap.Error(err))...)
			return nil, err
		}
		workingReq = compressedReq
		preprocessUsage = usage
		logn.Debug("script converter long form summarized",
			TaskLogFields(ctx, ScriptTaskStageSummarizing,
				zap.Int("chapters", len(req.Chapters)),
				zap.Int("total_chars_before", totalChapterChars(req.Chapters)),
				zap.Int("total_chars_after", totalChapterChars(workingReq.Chapters)),
			)...,
		)
	}

	sc.reportProgress(report, ScriptTaskStageGenerating, "正在调用大模型生成剧本 YAML。")
	systemPrompt, userPrompt := sc.promptManager.ConvertPrompt(workingReq)
	llmResp, err := sc.llm.GenerateScript(ctx, systemPrompt, userPrompt)
	if err != nil {
		logn.Error("script converter initial generation failed", TaskLogFields(ctx, ScriptTaskStageGenerating, zap.Error(err))...)
		return nil, err
	}
	logn.Debug("script converter initial generation done",
		TaskLogFields(ctx, ScriptTaskStageGenerating,
			zap.Int("raw_len", len(llmResp.Content)),
		)...,
	)

	sc.reportProgress(report, ScriptTaskStageValidating, "首轮生成完成，正在做 YAML 与 schema 校验。")
	result, convErr := sc.normalizeAndValidate(ctx, workingReq, llmResp.Content)
	if convErr == nil {
		result.Usage = mergeTokenUsage(preprocessUsage, llmResp.Usage)
		logn.Debug("script converter validated on first pass",
			TaskLogFields(ctx, ScriptTaskStageValidating,
				zap.Int("yaml_len", len(result.YAML)),
				zap.Int("summary_chapters", result.Summary.Chapters),
				zap.Int("summary_scenes", result.Summary.Scenes),
				zap.Int("summary_beats", result.Summary.Beats),
			)...,
		)
		return result, nil
	}
	logn.Warn("script converter first pass invalid",
		TaskLogFields(ctx, ScriptTaskStageValidating, zap.Error(convErr))...,
	)

	if !isRepairableConvertError(convErr) {
		return nil, convErr
	}

	lastErr := convErr
	lastOutput := llmResp.Content
	for attempt := 1; attempt <= sc.promptManager.MaxRepairAttempts(); attempt++ {
		logn.Debug("script converter repair attempt started",
			TaskLogFields(ctx, ScriptTaskStageRepairing,
				zap.Int("attempt", attempt),
				zap.Error(lastErr),
				zap.Int("raw_len", len(lastOutput)),
			)...,
		)
		sc.reportProgress(report, ScriptTaskStageRepairing, fmt.Sprintf("首轮结果未通过校验，正在执行第 %d 次修复。", attempt))
		repairSystem, repairPrompt := sc.promptManager.RepairPrompt(workingReq, lastOutput, lastErr, attempt)
		repairResp, repairErr := sc.llm.GenerateScript(ctx, repairSystem, repairPrompt)
		if repairErr != nil {
			logn.Error("script converter repair generation failed",
				TaskLogFields(ctx, ScriptTaskStageRepairing,
					zap.Int("attempt", attempt),
					zap.Error(repairErr),
				)...,
			)
			return nil, repairErr
		}

		sc.reportProgress(report, ScriptTaskStageValidating, fmt.Sprintf("第 %d 次修复完成，正在重新校验结果。", attempt))
		result, convErr = sc.normalizeAndValidate(ctx, workingReq, repairResp.Content)
		if convErr == nil {
			result.Usage = mergeTokenUsage(preprocessUsage, llmResp.Usage, repairResp.Usage)
			logn.Debug("script converter repair succeeded",
				TaskLogFields(ctx, ScriptTaskStageRepairing,
					zap.Int("attempt", attempt),
					zap.Int("yaml_len", len(result.YAML)),
					zap.Int("summary_chapters", result.Summary.Chapters),
					zap.Int("summary_scenes", result.Summary.Scenes),
					zap.Int("summary_beats", result.Summary.Beats),
				)...,
			)
			return result, nil
		}

		logn.Warn("script converter repair attempt invalid",
			TaskLogFields(ctx, ScriptTaskStageRepairing,
				zap.Int("attempt", attempt),
				zap.Error(convErr),
			)...,
		)
		lastErr = convErr
		lastOutput = repairResp.Content
	}

	logn.Error("script converter exhausted repair attempts", TaskLogFields(ctx, ScriptTaskStageRepairing, zap.Error(lastErr))...)
	return nil, lastErr
}

func (sc *ScriptConverter) reportProgress(report ConvertProgressReporter, stage, message string) {
	if report == nil {
		return
	}
	report(ConvertProgress{
		Stage:   stage,
		Message: message,
	})
}

func (sc *ScriptConverter) shouldUseLongFormMode(req ConvertRequest) bool {
	if totalChapterChars(req.Chapters) >= longFormTotalCharsThreshold {
		return true
	}
	for _, chapter := range req.Chapters {
		if len([]rune(strings.TrimSpace(chapter.Text))) >= longFormSingleChapterThreshold {
			return true
		}
	}
	return false
}

func (sc *ScriptConverter) compressLongFormRequest(ctx context.Context, req ConvertRequest) (ConvertRequest, *einoSchema.TokenUsage, error) {
	compressed := ConvertRequest{
		Chapters: make([]ChapterInput, len(req.Chapters)),
		Genre:    req.Genre,
		Tone:     req.Tone,
		Pacing:   req.Pacing,
	}

	usages := make([]*einoSchema.TokenUsage, 0, len(req.Chapters))
	for index, chapter := range req.Chapters {
		systemPrompt, userPrompt := sc.promptManager.ChapterSummaryPrompt(req, chapter, index, longFormSummaryTargetChars)
		resp, err := sc.llm.GenerateScript(ctx, systemPrompt, userPrompt)
		if err != nil {
			return ConvertRequest{}, nil, err
		}

		compressed.Chapters[index] = ChapterInput{
			Title: chapter.Title,
			Text:  normalizeChapterSummary(chapter.Title, resp.Content),
		}
		usages = append(usages, resp.Usage)
	}

	return compressed, mergeTokenUsage(usages...), nil
}

func normalizeChapterSummary(title, raw string) string {
	text := strings.TrimSpace(raw)
	if text == "" {
		return fmt.Sprintf("章节标题：%s\n该章节摘要为空，请回退到原文重新生成。", strings.TrimSpace(title))
	}

	lines := strings.Split(text, "\n")
	normalized := make([]string, 0, len(lines)+1)
	header := fmt.Sprintf("章节标题：%s", strings.TrimSpace(title))
	if len(lines) == 0 || !strings.HasPrefix(strings.TrimSpace(lines[0]), "章节标题：") {
		normalized = append(normalized, header)
	}

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		normalized = append(normalized, trimmed)
	}

	return strings.Join(normalized, "\n")
}

func totalChapterChars(chapters []ChapterInput) int {
	total := 0
	for _, chapter := range chapters {
		total += len([]rune(strings.TrimSpace(chapter.Text)))
	}
	return total
}

// NormalizeEditedYAML validates and normalizes user-edited YAML against the
// persisted task metadata so edited results can be safely stored.
func (sc *ScriptConverter) NormalizeEditedYAML(rawYAML string, genre, tone, pacing string, sourceChapters int) (*ConvertResult, error) {
	req := ConvertRequest{
		Chapters: make([]ChapterInput, sourceChapters),
		Genre:    genre,
		Tone:     tone,
		Pacing:   pacing,
	}
	return sc.normalizeAndValidate(context.Background(), req, rawYAML)
}

func (sc *ScriptConverter) validateRequest(req ConvertRequest) error {
	if len(req.Chapters) < 3 {
		return NewConvertError(ConvertErrorSchema, fmt.Sprintf("minimum 3 chapters required, got %d", len(req.Chapters)), nil)
	}
	if strings.TrimSpace(req.Genre) == "" || strings.TrimSpace(req.Tone) == "" || strings.TrimSpace(req.Pacing) == "" {
		return NewConvertError(ConvertErrorSchema, "genre, tone, and pacing are required", nil)
	}
	for i, chapter := range req.Chapters {
		if strings.TrimSpace(chapter.Title) == "" {
			return NewConvertError(ConvertErrorSchema, fmt.Sprintf("chapter %d title is required", i+1), nil)
		}
		if strings.TrimSpace(chapter.Text) == "" {
			return NewConvertError(ConvertErrorSchema, fmt.Sprintf("chapter %d text is required", i+1), nil)
		}
	}
	return nil
}

// buildPrompt - kept as a narrow helper for tests and prompt debugging.
func (sc *ScriptConverter) buildPrompt(req ConvertRequest) string {
	_, userPrompt := sc.promptManager.ConvertPrompt(req)
	return userPrompt
}

func sanitizeLLMOutput(raw string) string {
	trimmed := strings.TrimSpace(strings.TrimPrefix(raw, "\ufeff"))
	if trimmed == "" {
		return trimmed
	}

	if strings.HasPrefix(trimmed, "```") {
		lines := strings.Split(trimmed, "\n")
		if len(lines) >= 3 {
			lines = lines[1:]
			if last := len(lines) - 1; last >= 0 && strings.TrimSpace(lines[last]) == "```" {
				lines = lines[:last]
			}
			trimmed = strings.TrimSpace(strings.Join(lines, "\n"))
		}
	}

	if idx := strings.Index(trimmed, "version:"); idx >= 0 {
		trimmed = strings.TrimSpace(trimmed[idx:])
	}

	trimmed = sanitizeQuotedYAMLText(trimmed)

	return trimmed
}

func sanitizeQuotedYAMLText(raw string) string {
	lines := strings.Split(raw, "\n")
	output := make([]string, 0, len(lines))
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if !strings.Contains(trimmed, `: "`) {
			output = append(output, line)
			continue
		}

		keyValueIdx := strings.Index(line, `: "`)
		if keyValueIdx < 0 {
			output = append(output, line)
			continue
		}

		keyPart := line[:keyValueIdx]
		valuePart := strings.TrimSpace(line[keyValueIdx+2:])
		if valuePart == "" {
			output = append(output, line)
			continue
		}

		if !shouldConvertQuotedScalar(valuePart) {
			output = append(output, line)
			continue
		}

		unquoted := trimQuotedScalarEdge(valuePart)
		indent := strings.Repeat(" ", len(keyPart)-len(strings.TrimLeft(keyPart, " "))+2)
		output = append(output, keyPart+": |-")
		for _, blockLine := range strings.Split(unquoted, "\n") {
			output = append(output, indent+blockLine)
		}
	}
	return strings.Join(output, "\n")
}

func shouldConvertQuotedScalar(value string) bool {
	if value == "" || value[0] != '"' {
		return false
	}

	if hasQuotedScalarTerminator(value) {
		inner := trimQuotedScalarEdge(value)
		return strings.Contains(inner, `"`) || strings.Contains(inner, "：") || strings.Contains(inner, "“") || strings.Contains(inner, "”")
	}

	return true
}

func hasQuotedScalarTerminator(value string) bool {
	if value == "" {
		return false
	}
	last := []rune(value)[len([]rune(value))-1]
	return last == '"' || last == '”' || last == '“'
}

func trimQuotedScalarEdge(value string) string {
	trimmed := strings.TrimPrefix(value, `"`)
	for {
		runes := []rune(trimmed)
		if len(runes) == 0 {
			return trimmed
		}
		last := runes[len(runes)-1]
		if last != '"' && last != '”' && last != '“' {
			return trimmed
		}
		trimmed = string(runes[:len(runes)-1])
	}
}

func (sc *ScriptConverter) normalizeAndValidate(ctx context.Context, req ConvertRequest, rawContent string) (*ConvertResult, error) {
	sanitized := sanitizeLLMOutput(rawContent)
	logn.Debug("script yaml sanitize finished",
		TaskLogFields(ctx, "sanitize",
			zap.Int("raw_len", len(rawContent)),
			zap.Int("sanitized_len", len(sanitized)),
		)...,
	)
	scriptYAML := &model.ScriptYAML{}
	parseErr := yaml.Unmarshal([]byte(sanitized), scriptYAML)
	if parseErr != nil {
		logn.Debug("script yaml parse failed",
			TaskLogFields(ctx, "yaml_parse_failed",
				zap.Int("sanitized_len", len(sanitized)),
				zap.Error(parseErr),
			)...,
		)
		return nil, NewConvertError(ConvertErrorYAMLParse, "yaml parse failed", parseErr)
	}

	schemaErr := sc.validateSchema(scriptYAML, req)
	if schemaErr != nil {
		logn.Debug("script schema validation failed", TaskLogFields(ctx, "schema_invalid", zap.Error(schemaErr))...)
		return nil, schemaErr
	}

	scriptYAML.ConsistencyReport = sc.validateConsistency(scriptYAML)
	normalizedYAML, err := yaml.Marshal(scriptYAML)
	if err != nil {
		return nil, NewConvertError(ConvertErrorSerialization, "yaml serialization failed", err)
	}

	return &ConvertResult{
		YAML:              string(normalizedYAML),
		ScriptTitle:       strings.TrimSpace(scriptYAML.Metadata.Title),
		Summary:           sc.generateSummary(scriptYAML),
		ConsistencyReport: scriptYAML.ConsistencyReport,
	}, nil
}

func isRepairableConvertError(err error) bool {
	var convertErr *ConvertError
	if !errors.As(err, &convertErr) {
		return false
	}
	return convertErr.Code == ConvertErrorYAMLParse || convertErr.Code == ConvertErrorSchema
}

func mergeTokenUsage(usages ...*einoSchema.TokenUsage) *einoSchema.TokenUsage {
	var merged *einoSchema.TokenUsage
	for _, usage := range usages {
		if usage == nil {
			continue
		}
		if merged == nil {
			copyUsage := *usage
			merged = &copyUsage
			continue
		}
		merged.PromptTokens += usage.PromptTokens
		merged.TotalTokens += usage.TotalTokens
		merged.CompletionTokens += usage.CompletionTokens
		merged.PromptTokenDetails.CachedTokens += usage.PromptTokenDetails.CachedTokens
		merged.CompletionTokensDetails.ReasoningTokens += usage.CompletionTokensDetails.ReasoningTokens
	}
	return merged
}

func (sc *ScriptConverter) validateSchema(script *model.ScriptYAML, req ConvertRequest) error {
	var problems []string

	if script.Version != "1.0" {
		problems = append(problems, `version must be "1.0"`)
	}
	if strings.TrimSpace(script.Metadata.Title) == "" {
		problems = append(problems, "metadata.title is required")
	}
	if strings.TrimSpace(script.Metadata.Author) == "" {
		problems = append(problems, "metadata.author is required")
	}
	if script.Metadata.Genre != req.Genre {
		problems = append(problems, "metadata.genre must match request.genre")
	}
	if script.Metadata.Tone != req.Tone {
		problems = append(problems, "metadata.tone must match request.tone")
	}
	if script.Metadata.Pacing != req.Pacing {
		problems = append(problems, "metadata.pacing must match request.pacing")
	}
	if script.Metadata.SourceChapters != len(req.Chapters) {
		problems = append(problems, "metadata.source_chapters must match input chapter count")
	}
	if _, err := time.Parse(time.RFC3339, script.Metadata.GeneratedAt); err != nil {
		problems = append(problems, "metadata.generated_at must be RFC3339")
	}
	if script.Metadata.Pacing != "fast" && script.Metadata.Pacing != "medium" && script.Metadata.Pacing != "slow" {
		problems = append(problems, "metadata.pacing must be one of fast|medium|slow")
	}

	characterNames := make(map[string]struct{}, len(script.DramatisPersonae))
	for i, char := range script.DramatisPersonae {
		prefix := fmt.Sprintf("dramatis_personae[%d]", i)
		if strings.TrimSpace(char.Name) == "" {
			problems = append(problems, prefix+".name is required")
		}
		if strings.TrimSpace(char.Archetype) == "" {
			problems = append(problems, prefix+".archetype is required")
		}
		if strings.TrimSpace(char.Motivation) == "" {
			problems = append(problems, prefix+".motivation is required")
		}
		if strings.TrimSpace(char.FirstAppearance) == "" {
			problems = append(problems, prefix+".first_appearance is required")
		}
		if _, exists := characterNames[char.Name]; char.Name != "" && exists {
			problems = append(problems, prefix+".name must be unique")
		}
		characterNames[char.Name] = struct{}{}
	}

	settingNames := make(map[string]struct{}, len(script.Settings))
	for i, setting := range script.Settings {
		prefix := fmt.Sprintf("settings[%d]", i)
		if strings.TrimSpace(setting.Name) == "" {
			problems = append(problems, prefix+".name is required")
		}
		if strings.TrimSpace(setting.Description) == "" {
			problems = append(problems, prefix+".description is required")
		}
		if setting.Importance != "high" && setting.Importance != "medium" && setting.Importance != "low" {
			problems = append(problems, prefix+".importance must be one of high|medium|low")
		}
		if _, exists := settingNames[setting.Name]; setting.Name != "" && exists {
			problems = append(problems, prefix+".name must be unique")
		}
		settingNames[setting.Name] = struct{}{}
	}

	if len(script.Chapters) == 0 {
		problems = append(problems, "chapters must not be empty")
	}
	for i, chapter := range script.Chapters {
		prefix := fmt.Sprintf("chapters[%d]", i)
		if !chapterIDPattern.MatchString(chapter.ID) {
			problems = append(problems, prefix+".id must match chN")
		}
		if strings.TrimSpace(chapter.Title) == "" {
			problems = append(problems, prefix+".title is required")
		}
		if strings.TrimSpace(chapter.Summary) == "" {
			problems = append(problems, prefix+".summary is required")
		}
		if chapter.Scenes == nil {
			problems = append(problems, prefix+".scenes is required")
		}
		for j, scene := range chapter.Scenes {
			scenePrefix := fmt.Sprintf("%s.scenes[%d]", prefix, j)
			if !sceneIDPattern.MatchString(scene.ID) {
				problems = append(problems, scenePrefix+".id must match chN.scN")
			}
			if strings.TrimSpace(scene.Title) == "" {
				problems = append(problems, scenePrefix+".title is required")
			}
			if strings.TrimSpace(scene.Goal) == "" {
				problems = append(problems, scenePrefix+".goal is required")
			}
			if strings.TrimSpace(scene.Location) == "" {
				problems = append(problems, scenePrefix+".location is required")
			}
			if strings.TrimSpace(scene.Time) == "" {
				problems = append(problems, scenePrefix+".time is required")
			}
			if strings.TrimSpace(scene.POV) == "" {
				problems = append(problems, scenePrefix+".pov is required")
			}
			if strings.TrimSpace(scene.Mood) == "" {
				problems = append(problems, scenePrefix+".mood is required")
			}
			if strings.TrimSpace(scene.Outcome) == "" {
				problems = append(problems, scenePrefix+".outcome is required")
			}
			if scene.Beats == nil {
				problems = append(problems, scenePrefix+".beats is required")
			}
			for k, beat := range scene.Beats {
				beatPrefix := fmt.Sprintf("%s.beats[%d]", scenePrefix, k)
				if !beatIDPattern.MatchString(beat.ID) {
					problems = append(problems, beatPrefix+".id must match chN.scN.bN")
				}
				if beat.Type != "action" && beat.Type != "dialogue" && beat.Type != "inner" && beat.Type != "exposition" {
					problems = append(problems, beatPrefix+".type must be one of action|dialogue|inner|exposition")
				}
				if strings.TrimSpace(beat.Summary) == "" {
					problems = append(problems, beatPrefix+".summary is required")
				}
				if (beat.Type == "dialogue" || beat.Type == "inner") && beat.Dialogue == nil {
					problems = append(problems, beatPrefix+".dialogue is required for dialogue and inner beats")
					continue
				}
				if beat.Dialogue != nil {
					if strings.TrimSpace(beat.Dialogue.Speaker) == "" {
						problems = append(problems, beatPrefix+".dialogue.speaker is required")
					}
					if strings.TrimSpace(beat.Dialogue.Content) == "" {
						problems = append(problems, beatPrefix+".dialogue.content is required")
					}
				}
			}
		}
	}

	if len(problems) > 0 {
		return NewConvertError(ConvertErrorSchema, strings.Join(problems, "; "), nil)
	}
	return nil
}

// validateConsistency - Validate script consistency.
func (sc *ScriptConverter) validateConsistency(script *model.ScriptYAML) model.ConsistencyReport {
	definedRoles := make(map[string]struct{}, len(script.DramatisPersonae))
	for _, char := range script.DramatisPersonae {
		definedRoles[char.Name] = struct{}{}
	}

	definedSettings := make(map[string]struct{}, len(script.Settings))
	for _, setting := range script.Settings {
		definedSettings[setting.Name] = struct{}{}
	}

	usedRoles := make(map[string]struct{})
	usedSettings := make(map[string]struct{})
	rolesMissing := make(map[string]struct{})
	settingsMissing := make(map[string]struct{})
	danglingRefs := make(map[string]struct{})

	for _, chapter := range script.Chapters {
		for _, scene := range chapter.Scenes {
			if scene.Location != "" {
				if _, ok := definedSettings[scene.Location]; !ok {
					settingsMissing[scene.Location] = struct{}{}
				} else {
					usedSettings[scene.Location] = struct{}{}
				}
			}

			if scene.POV != "" {
				if _, ok := definedRoles[scene.POV]; !ok {
					rolesMissing[scene.POV] = struct{}{}
				} else {
					usedRoles[scene.POV] = struct{}{}
				}
			}

			for _, beat := range scene.Beats {
				if beat.Dialogue != nil && beat.Dialogue.Speaker != "" {
					if _, ok := definedRoles[beat.Dialogue.Speaker]; !ok {
						rolesMissing[beat.Dialogue.Speaker] = struct{}{}
					} else {
						usedRoles[beat.Dialogue.Speaker] = struct{}{}
					}
				}
			}
		}
	}

	for _, char := range script.DramatisPersonae {
		if _, used := usedRoles[char.Name]; !used {
			danglingRefs[fmt.Sprintf("角色 '%s' 已定义但未使用", char.Name)] = struct{}{}
		}
	}

	for _, setting := range script.Settings {
		if _, used := usedSettings[setting.Name]; !used {
			danglingRefs[fmt.Sprintf("场景 '%s' 已定义但未使用", setting.Name)] = struct{}{}
		}
	}

	for _, clue := range sc.findDanglingStoryClues(script) {
		danglingRefs[clue] = struct{}{}
	}

	return model.ConsistencyReport{
		RolesMissing:    sortedKeys(rolesMissing),
		SettingsMissing: sortedKeys(settingsMissing),
		DanglingRefs:    sortedKeys(danglingRefs),
	}
}

func (sc *ScriptConverter) findDanglingStoryClues(script *model.ScriptYAML) []string {
	mentions := make(map[string]int)
	collect := func(text string) {
		for _, match := range quotedTermRegexp.FindAllStringSubmatch(text, -1) {
			if len(match) < 2 {
				continue
			}
			term := strings.TrimSpace(match[1])
			if term == "" {
				continue
			}
			mentions[term]++
		}
	}

	for _, chapter := range script.Chapters {
		collect(chapter.Summary)
		for _, scene := range chapter.Scenes {
			collect(scene.Goal)
			collect(scene.Outcome)
			for _, beat := range scene.Beats {
				collect(beat.Summary)
				if beat.Dialogue != nil {
					collect(beat.Dialogue.Content)
				}
			}
		}
	}

	results := make([]string, 0)
	for term, count := range mentions {
		if count == 1 {
			results = append(results, fmt.Sprintf("伏笔 '%s' 仅被提及一次，可能未回收", term))
		}
	}
	sort.Strings(results)
	return results
}

func sortedKeys(set map[string]struct{}) []string {
	items := make([]string, 0, len(set))
	for item := range set {
		items = append(items, item)
	}
	sort.Strings(items)
	return items
}

// generateSummary - Generate script summary.
func (sc *ScriptConverter) generateSummary(script *model.ScriptYAML) model.ScriptSummary {
	summary := model.ScriptSummary{
		Chapters:   len(script.Chapters),
		Characters: len(script.DramatisPersonae),
		Settings:   len(script.Settings),
	}

	for _, chapter := range script.Chapters {
		summary.Scenes += len(chapter.Scenes)
		for _, scene := range chapter.Scenes {
			summary.Beats += len(scene.Beats)
		}
	}

	return summary
}

// GenerateTaskID - Generate a unique task ID for persistence and response payloads.
func GenerateTaskID() string {
	return fmt.Sprintf("task_%d", time.Now().UnixNano())
}
