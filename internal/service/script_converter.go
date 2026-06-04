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

	"scene-script/config"
	"scene-script/internal/model"
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
	Summary           model.ScriptSummary
	ConsistencyReport model.ConsistencyReport
	Usage             *einoSchema.TokenUsage
}

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
	if err := sc.validateRequest(req); err != nil {
		return nil, err
	}

	systemPrompt, userPrompt := sc.promptManager.ConvertPrompt(req)
	llmResp, err := sc.llm.GenerateScript(ctx, systemPrompt, userPrompt)
	if err != nil {
		return nil, err
	}

	result, convErr := sc.normalizeAndValidate(req, llmResp.Content)
	if convErr == nil {
		result.Usage = llmResp.Usage
		return result, nil
	}

	if !isRepairableConvertError(convErr) {
		return nil, convErr
	}

	lastErr := convErr
	lastOutput := llmResp.Content
	for attempt := 1; attempt <= sc.promptManager.MaxRepairAttempts(); attempt++ {
		repairSystem, repairPrompt := sc.promptManager.RepairPrompt(req, lastOutput, lastErr, attempt)
		repairResp, repairErr := sc.llm.GenerateScript(ctx, repairSystem, repairPrompt)
		if repairErr != nil {
			return nil, repairErr
		}

		result, convErr = sc.normalizeAndValidate(req, repairResp.Content)
		if convErr == nil {
			result.Usage = mergeTokenUsage(llmResp.Usage, repairResp.Usage)
			return result, nil
		}

		lastErr = convErr
		lastOutput = repairResp.Content
	}

	return nil, lastErr
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

	return trimmed
}

func (sc *ScriptConverter) normalizeAndValidate(req ConvertRequest, rawContent string) (*ConvertResult, error) {
	sanitized := sanitizeLLMOutput(rawContent)
	scriptYAML := &model.ScriptYAML{}
	parseErr := yaml.Unmarshal([]byte(sanitized), scriptYAML)
	if parseErr != nil {
		return nil, NewConvertError(ConvertErrorYAMLParse, "yaml parse failed", parseErr)
	}

	schemaErr := sc.validateSchema(scriptYAML, req)
	if schemaErr != nil {
		return nil, schemaErr
	}

	scriptYAML.ConsistencyReport = sc.validateConsistency(scriptYAML)
	normalizedYAML, err := yaml.Marshal(scriptYAML)
	if err != nil {
		return nil, NewConvertError(ConvertErrorSerialization, "yaml serialization failed", err)
	}

	return &ConvertResult{
		YAML:              string(normalizedYAML),
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
