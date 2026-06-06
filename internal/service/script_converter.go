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
	minConvertSourceChapters       = 3
	maxConvertSourceChapters       = 12
	longFormChapterCountThreshold  = 8
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
	if len(req.Chapters) >= longFormChapterCountThreshold {
		return true
	}
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

	structuredEnabled := false
	if _, ok := sc.llm.(StructuredSummaryProvider); ok {
		structuredEnabled = true
	}
	usages := make([]*einoSchema.TokenUsage, 0, len(req.Chapters))
	targetChars := summaryTargetChars(req)
	logn.Debug("script converter long form summary started",
		TaskLogFields(ctx, "long_form_summary_started",
			zap.Int("chapter_count", len(req.Chapters)),
			zap.Int("target_chars", targetChars),
			zap.Bool("structured_summary_enabled", structuredEnabled),
		)...,
	)
	for index, chapter := range req.Chapters {
		chapterStartedAt := time.Now()
		chapterTitle := strings.TrimSpace(chapter.Title)
		charCount := len([]rune(strings.TrimSpace(chapter.Text)))
		finalMode := "text"
		fallbackReason := ""

		logn.Debug("script converter chapter summary started",
			TaskLogFields(ctx, "long_form_chapter_summary_started",
				zap.Int("chapter_index", index),
				zap.String("chapter_title", chapterTitle),
				zap.Int("source_char_count", charCount),
				zap.Bool("structured_summary_enabled", structuredEnabled),
			)...,
		)

		if structuredLLM, ok := sc.llm.(StructuredSummaryProvider); ok {
			systemPrompt, userPrompt := sc.promptManager.ChapterSummaryStructuredPrompt(req, chapter, index, targetChars)
			resp, err := structuredLLM.GenerateStructuredChapterSummary(ctx, systemPrompt, userPrompt)
			if err == nil {
				finalMode = "structured"
				compressed.Chapters[index] = ChapterInput{
					Title: chapter.Title,
					Text:  normalizeStructuredChapterSummary(chapter.Title, resp.Summary),
				}
				usages = append(usages, resp.Usage)
				logn.Debug("script converter chapter summary done",
					TaskLogFields(ctx, "long_form_chapter_summary_done",
						zap.Int("chapter_index", index),
						zap.String("chapter_title", chapterTitle),
						zap.String("summary_mode", finalMode),
						zap.Int("source_char_count", charCount),
						zap.Int("summary_char_count", len([]rune(compressed.Chapters[index].Text))),
						zap.Int64("elapsed_ms", time.Since(chapterStartedAt).Milliseconds()),
						zap.Bool("fallback_triggered", false),
						zap.Any("usage", resp.Usage),
					)...,
				)
				continue
			}
			fallbackReason = err.Error()
			logn.Warn("structured summary generation failed, fallback to text summary",
				TaskLogFields(ctx, "long_form_summary_fallback",
					zap.Int("chapter_index", index),
					zap.String("chapter_title", chapterTitle),
					zap.Int("source_char_count", charCount),
					zap.String("fallback_from", "structured"),
					zap.String("fallback_to", "text"),
					zap.Int64("structured_elapsed_ms", time.Since(chapterStartedAt).Milliseconds()),
					zap.Error(err),
				)...,
			)
		}

		systemPrompt, userPrompt := sc.promptManager.ChapterSummaryPrompt(req, chapter, index, targetChars)
		resp, err := sc.llm.GenerateScript(ctx, systemPrompt, userPrompt)
		if err != nil {
			return ConvertRequest{}, nil, err
		}

		compressed.Chapters[index] = ChapterInput{
			Title: chapter.Title,
			Text:  normalizeChapterSummary(chapter.Title, resp.Content),
		}
		usages = append(usages, resp.Usage)
		logn.Debug("script converter chapter summary done",
			TaskLogFields(ctx, "long_form_chapter_summary_done",
				zap.Int("chapter_index", index),
				zap.String("chapter_title", chapterTitle),
				zap.String("summary_mode", finalMode),
				zap.Int("source_char_count", charCount),
				zap.Int("summary_char_count", len([]rune(compressed.Chapters[index].Text))),
				zap.Int64("elapsed_ms", time.Since(chapterStartedAt).Milliseconds()),
				zap.Bool("fallback_triggered", fallbackReason != ""),
				zap.String("fallback_reason", fallbackReason),
				zap.Any("usage", resp.Usage),
			)...,
		)
	}

	logn.Debug("script converter long form summary completed",
		TaskLogFields(ctx, "long_form_summary_completed",
			zap.Int("chapter_count", len(compressed.Chapters)),
			zap.Int("target_chars", targetChars),
			zap.Bool("structured_summary_enabled", structuredEnabled),
			zap.Any("usage", mergeTokenUsage(usages...)),
		)...,
	)
	return compressed, mergeTokenUsage(usages...), nil
}

func normalizeStructuredChapterSummary(title string, summary StructuredChapterSummary) string {
	structured := map[string][]string{
		"关键人物：": toBulletList(summary.Characters),
		"关键地点：": toBulletList(summary.Locations),
		"关键事件：": toBulletList(summary.PlotPoints),
		"关键冲突：": toBulletList(summary.Conflicts),
		"伏笔线索：": toBulletList(summary.Foreshadow),
	}
	if strings.TrimSpace(summary.ChapterTitle) != "" {
		title = summary.ChapterTitle
	}
	endingState := strings.TrimSpace(summary.EndingState)
	if endingState == "" {
		endingState = "无"
	}
	return defaultStructuredChapterSummary(title, buildStructuredSummaryLines(structured, endingState))
}

func normalizeChapterSummary(title, raw string) string {
	text := strings.TrimSpace(raw)
	if text == "" {
		return defaultStructuredChapterSummary(title, nil)
	}

	lines := strings.Split(text, "\n")
	structured := map[string][]string{
		"关键人物：": {},
		"关键地点：": {},
		"关键事件：": {},
		"关键冲突：": {},
		"伏笔线索：": {},
	}
	endingState := ""
	currentSection := ""
	hasStructuredSections := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}

		switch trimmed {
		case "关键人物：", "关键地点：", "关键事件：", "关键冲突：", "伏笔线索：":
			currentSection = trimmed
			hasStructuredSections = true
			continue
		}
		if strings.HasPrefix(trimmed, "结尾状态：") {
			endingState = strings.TrimSpace(strings.TrimPrefix(trimmed, "结尾状态："))
			hasStructuredSections = true
			currentSection = ""
			continue
		}
		if strings.HasPrefix(trimmed, "章节标题：") {
			hasStructuredSections = true
			currentSection = ""
			continue
		}

		if currentSection != "" {
			if strings.HasPrefix(trimmed, "- ") {
				structured[currentSection] = append(structured[currentSection], trimmed)
			} else {
				structured[currentSection] = append(structured[currentSection], "- "+trimmed)
			}
			continue
		}

		structured["关键事件："] = append(structured["关键事件："], "- "+trimmed)
	}

	if !hasStructuredSections {
		return defaultStructuredChapterSummary(title, []string{text})
	}

	if endingState == "" {
		endingState = "无"
	}

	return defaultStructuredChapterSummary(title, buildStructuredSummaryLines(structured, endingState))
}

func buildStructuredSummaryLines(structured map[string][]string, endingState string) []string {
	lines := make([]string, 0, 16)
	for _, section := range []string{"关键人物：", "关键地点：", "关键事件：", "关键冲突：", "伏笔线索："} {
		lines = append(lines, section)
		items := structured[section]
		if len(items) == 0 {
			lines = append(lines, "- 无")
			continue
		}
		lines = append(lines, items...)
	}
	lines = append(lines, "结尾状态："+endingState)
	return lines
}

func defaultStructuredChapterSummary(title string, eventFallback []string) string {
	lines := []string{
		fmt.Sprintf("章节标题：%s", strings.TrimSpace(title)),
		"关键人物：",
		"- 无",
		"关键地点：",
		"- 无",
		"关键事件：",
	}
	if len(eventFallback) == 0 {
		lines = append(lines, "- 无")
	} else {
		for _, item := range eventFallback {
			item = strings.TrimSpace(item)
			if item == "" {
				continue
			}
			if strings.HasPrefix(item, "- ") {
				lines = append(lines, item)
			} else {
				lines = append(lines, "- "+item)
			}
		}
		if lines[len(lines)-1] == "关键事件：" {
			lines = append(lines, "- 无")
		}
	}
	lines = append(lines,
		"关键冲突：",
		"- 无",
		"伏笔线索：",
		"- 无",
		"结尾状态：无",
	)
	return strings.Join(lines, "\n")
}

func toBulletList(items []string) []string {
	if len(items) == 0 {
		return nil
	}
	lines := make([]string, 0, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		lines = append(lines, "- "+item)
	}
	return lines
}

func summaryTargetChars(req ConvertRequest) int {
	switch {
	case len(req.Chapters) >= 11:
		return 500
	case len(req.Chapters) >= 8:
		return 650
	default:
		return longFormSummaryTargetChars
	}
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
	if len(req.Chapters) < minConvertSourceChapters || len(req.Chapters) > maxConvertSourceChapters {
		return NewConvertError(
			ConvertErrorSchema,
			fmt.Sprintf("chapter count must be between %d and %d, got %d", minConvertSourceChapters, maxConvertSourceChapters, len(req.Chapters)),
			nil,
		)
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
	trimmed = sanitizeKnownSequenceScalars(trimmed)

	return trimmed
}

func isLikelyTruncatedYAMLError(raw string, err error) bool {
	message := ""
	if err != nil {
		message = err.Error()
	}
	if strings.Contains(message, "could not find end character of double-quoted text") {
		return true
	}
	if strings.Contains(message, "did not find expected node content") || strings.Contains(message, "could not find expected ':'") {
		return true
	}

	sanitized := sanitizeLLMOutput(raw)
	lastLine := strings.TrimSpace(lastNonEmptyLine(sanitized))
	switch {
	case strings.HasSuffix(lastLine, `: "`),
		strings.HasSuffix(lastLine, `: '`),
		strings.HasSuffix(lastLine, `- id: "`),
		strings.HasSuffix(lastLine, `- id:`),
		strings.HasSuffix(lastLine, `dialogue:`),
		strings.HasSuffix(lastLine, `beats:`):
		return true
	}

	quoteCount := 0
	escaped := false
	for _, r := range sanitized {
		if escaped {
			escaped = false
			continue
		}
		if r == '\\' {
			escaped = true
			continue
		}
		if r == '"' {
			quoteCount++
		}
	}
	return quoteCount%2 == 1
}

func lastNonEmptyLine(raw string) string {
	lines := strings.Split(raw, "\n")
	for index := len(lines) - 1; index >= 0; index-- {
		if strings.TrimSpace(lines[index]) != "" {
			return lines[index]
		}
	}
	return ""
}

var knownSequenceScalarRegexp = regexp.MustCompile(`^(\s*)(traits|relations|aliases|roles_missing|settings_missing|dangling_refs):\s*(.*?)\s*$`)

func sanitizeKnownSequenceScalars(raw string) string {
	lines := strings.Split(raw, "\n")
	output := make([]string, 0, len(lines))
	for _, line := range lines {
		matches := knownSequenceScalarRegexp.FindStringSubmatch(line)
		if len(matches) != 4 {
			output = append(output, line)
			continue
		}

		indent, key, value := matches[1], matches[2], strings.TrimSpace(matches[3])
		if value == "" || value == "[]" || strings.HasPrefix(value, "[") || strings.HasPrefix(value, "|") || strings.HasPrefix(value, ">") {
			output = append(output, line)
			continue
		}

		items := sequenceScalarItems(key, value)
		if len(items) == 0 {
			output = append(output, fmt.Sprintf("%s%s: []", indent, key))
			continue
		}

		output = append(output, fmt.Sprintf("%s%s:", indent, key))
		itemIndent := indent + "  "
		for _, item := range items {
			output = append(output, fmt.Sprintf(`%s- "%s"`, itemIndent, escapeDoubleQuotedYAML(item)))
		}
	}
	return strings.Join(output, "\n")
}

func sequenceScalarItems(key, value string) []string {
	unquoted := strings.TrimSpace(trimQuotedScalarEdge(strings.TrimSpace(value)))
	if unquoted == "" {
		return nil
	}

	var rawItems []string
	switch key {
	case "traits", "aliases":
		rawItems = splitSequenceScalar(unquoted)
	default:
		rawItems = []string{unquoted}
		if strings.ContainsAny(unquoted, "，,；;|/、") {
			rawItems = splitSequenceScalar(unquoted)
		}
	}

	items := make([]string, 0, len(rawItems))
	for _, item := range rawItems {
		item = strings.TrimSpace(item)
		if item != "" {
			items = append(items, item)
		}
	}
	return items
}

func splitSequenceScalar(value string) []string {
	fields := strings.FieldsFunc(value, func(r rune) bool {
		switch r {
		case '、', '，', ',', '；', ';', '|', '/', '\n':
			return true
		default:
			return false
		}
	})
	if len(fields) == 0 {
		return []string{value}
	}
	return fields
}

func escapeDoubleQuotedYAML(value string) string {
	replacer := strings.NewReplacer(`\`, `\\`, `"`, `\"`)
	return replacer.Replace(value)
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
	settingCandidates := make([]settingCandidate, 0, len(script.Settings))
	for _, setting := range script.Settings {
		definedSettings[setting.Name] = struct{}{}
		if strings.TrimSpace(setting.Name) != "" {
			settingCandidates = append(settingCandidates, settingCandidate{
				Canonical: setting.Name,
				Candidate: setting.Name,
			})
		}
		for _, alias := range setting.Aliases {
			alias = strings.TrimSpace(alias)
			if alias == "" {
				continue
			}
			settingCandidates = append(settingCandidates, settingCandidate{
				Canonical: setting.Name,
				Candidate: alias,
			})
		}
	}

	usedRoles := make(map[string]struct{})
	usedSettings := make(map[string]struct{})
	rolesMissing := make(map[string]struct{})
	settingsMissing := make(map[string]struct{})
	danglingRefs := make(map[string]struct{})

	for _, chapter := range script.Chapters {
		for _, scene := range chapter.Scenes {
			if scene.Location != "" {
				if _, ok := definedSettings[scene.Location]; ok {
					usedSettings[scene.Location] = struct{}{}
				} else if match, ok := softMatchSetting(scene.Location, settingCandidates); ok {
					usedSettings[match] = struct{}{}
				} else {
					settingsMissing[scene.Location] = struct{}{}
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

type settingCandidate struct {
	Canonical string
	Candidate string
}

func softMatchSetting(loc string, defined []settingCandidate) (string, bool) {
	locN := normalizeLocationName(loc)
	locT := trimGenericSuffixes(locN)
	best := ""
	bestScore := 0.0
	bestLen := 0
	for _, item := range defined {
		name := item.Candidate
		nameN := normalizeLocationName(name)
		nameT := trimGenericSuffixes(nameN)

		// 1) 直接等价（含经裁剪后的等价）
		if nameN == locN || nameT == locT || nameN == locT || nameT == locN {
			return item.Canonical, true
		}

		// 2) 包含匹配 + 长度差小（原始与裁剪后均尝试）
		if strings.Contains(locN, nameN) || strings.Contains(locT, nameN) || strings.Contains(locN, nameT) || strings.Contains(locT, nameT) {
			lr := runeLen(nameN)
			rr := runeLen(locN)
			if rr > 0 && (rr-lr) <= 4 {
				return item.Canonical, true
			}
			score := float64(runeLen(nameT)) / float64(maxInt(runeLen(nameT), runeLen(locT)))
			if score > bestScore || (score == bestScore && runeLen(nameT) > bestLen) {
				best, bestScore, bestLen = item.Canonical, score, runeLen(nameT)
			}
			continue
		}
		if strings.Contains(nameN, locN) || strings.Contains(nameT, locN) || strings.Contains(nameN, locT) || strings.Contains(nameT, locT) {
			nl := runeLen(nameN)
			score := float64(runeLen(locT)) / float64(maxInt(runeLen(locT), runeLen(nameT)))
			if score > bestScore || (score == bestScore && nl > bestLen) {
				best, bestScore, bestLen = item.Canonical, score, nl
			}
			continue
		}

		// 3) 相似度兜底（对裁剪后的字符串计算）
		s := jaccardBigrams(locT, nameT)
		if s > bestScore || (s == bestScore && runeLen(nameT) > bestLen) {
			best, bestScore, bestLen = item.Canonical, s, runeLen(nameT)
		}
	}
	if bestScore >= 0.72 {
		return best, true
	}
	return "", false
}

func normalizeLocationName(s string) string {
	x := strings.TrimSpace(strings.ToLower(s))
	x = strings.NewReplacer(
		" ", "",
		"\u3000", "",
		"·", "",
		"-", "",
		"_", "",
		"，", "",
		",", "",
		"。", "",
		".", "",
		"：", "",
		":", "",
		"；", "",
		";", "",
		"！", "",
		"!", "",
		"？", "",
		"?", "",
		"、", "",
		"（", "",
		"）", "",
		"(", "",
		")", "",
		"“", "",
		"”", "",
		"\"", "",
		"《", "",
		"》", "",
	).Replace(x)
	x = strings.ReplaceAll(x, "的", "")
	x = strings.ReplaceAll(x, "里", "")
	return x
}

// trimGenericSuffixes removes common area-like suffixes to obtain a more canonical stem
// for matching, e.g. "城南老宅院落" -> "城南老宅"，"旧车站遗址墙角" -> "旧车站遗址"。
func trimGenericSuffixes(s string) string {
	suffixes := []string{
		"院落", "书房", "墙角", "走廊", "庭院", "院子", "房间", "大厅", "天台", "屋顶",
		"门口", "后院", "前厅", "长廊", "街道", "小街", "小巷", "胡同", "站台", "角落",
	}
	for _, suf := range suffixes {
		if strings.HasSuffix(s, suf) && runeLen(s) > runeLen(suf)+1 {
			return strings.TrimSuffix(s, suf)
		}
	}
	return s
}

func jaccardBigrams(a, b string) float64 {
	A := bigrams(a)
	B := bigrams(b)
	if len(A) == 0 && len(B) == 0 {
		return 1
	}
	inter := 0
	for k := range A {
		if _, ok := B[k]; ok {
			inter++
		}
	}
	union := len(A) + len(B) - inter
	if union == 0 {
		return 0
	}
	return float64(inter) / float64(union)
}

func bigrams(s string) map[string]struct{} {
	r := []rune(s)
	m := make(map[string]struct{})
	if len(r) == 0 {
		return m
	}
	if len(r) == 1 {
		m[string(r)] = struct{}{}
		return m
	}
	for i := 0; i < len(r)-1; i++ {
		m[string(r[i:i+2])] = struct{}{}
	}
	return m
}

func runeLen(s string) int { return len([]rune(s)) }

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
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
