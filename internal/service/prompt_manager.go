package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"scene-script/config"
)

const defaultConvertSystemPrompt = "你是一位资深编剧，擅长将小说改编为结构化剧本。你必须只输出 YAML，不得输出解释、代码块围栏或额外说明。"

const defaultRepairSystemPrompt = "你是一位剧本 YAML 修复专家。你只能修复 YAML 结构和缺失字段，必须保持原故事语义尽量不变，只返回修复后的 YAML 正文。"

const defaultRepairTemplate = `你之前生成的剧本 YAML 没有通过系统校验，请严格修复下列问题并重新输出完整 YAML。

输入约束：
- 源章节数必须为 {source_chapters}
- metadata.genre 必须等于 {genre}
- metadata.tone 必须等于 {tone}
- metadata.pacing 必须等于 {pacing}
- metadata.generated_at 必须使用 RFC3339，例如 {generated_at}
- 如果原文没有作者信息，请填 "未知作者"
- chapter.id 必须是 ch1/ch2/ch3...
- scene.id 必须是 ch1.sc1
- beat.id 必须是 ch1.sc1.b1
- settings.importance 只能是 high/medium/low
- beats.type 只能是 action/dialogue/inner/exposition
- dialogue 和 inner 类型必须提供 dialogue.speaker 与 dialogue.content
- 必须补齐 metadata、dramatis_personae、settings、chapters、consistency_report

校验失败信息：
{validation_errors}

原始 YAML：
{raw_yaml}`

const screenplaySchemaSynopsis = `Schema v1.0 要求：
- version: "1.0"
- metadata: title, author, genre, tone, pacing, source_chapters, generated_at
- dramatis_personae[].name/archetype/motivation/traits/relations/first_appearance 必填
- settings[].name/description/importance 必填
- chapters[].id/title/summary/scenes 必填
- scenes[].id/title/goal/location/time/pov/mood/beats/outcome 必填
- beats[].id/type/summary 必填；当 type=dialogue 或 inner 时必须有 dialogue.speaker 和 dialogue.content
- consistency_report 必须包含 roles_missing/settings_missing/dangling_refs`

// PromptManager centralizes prompt assembly, versioned defaults and repair prompts.
type PromptManager struct {
	cfg *config.LLMPromptConf
}

// NewPromptManager creates a prompt manager with config-backed overrides.
func NewPromptManager(cfg *config.LLMPromptConf) *PromptManager {
	return &PromptManager{cfg: cfg}
}

func (pm *PromptManager) ConvertPrompt(req ConvertRequest) (systemPrompt, userPrompt string) {
	systemPrompt = defaultConvertSystemPrompt
	if pm.cfg != nil && strings.TrimSpace(pm.cfg.System) != "" {
		systemPrompt = strings.TrimSpace(pm.cfg.System)
	}

	template := ""
	if pm.cfg != nil {
		template = strings.TrimSpace(pm.cfg.Template)
	}
	if template == "" {
		template = "根据以下小说文本，生成结构化剧本。\n\n体裁: {genre}\n语气: {tone}\n节奏: {pacing}\n\n小说内容:\n{chapters_text}"
	}

	userPrompt = renderPromptTemplate(template, req, time.Now())
	userPrompt = strings.TrimSpace(userPrompt) + "\n\n" + pm.schemaContract(req, time.Now())
	return systemPrompt, userPrompt
}

func (pm *PromptManager) RepairPrompt(req ConvertRequest, rawYAML string, validationErr error, attempt int) (systemPrompt, userPrompt string) {
	systemPrompt = defaultRepairSystemPrompt
	if pm.cfg != nil && strings.TrimSpace(pm.cfg.RepairSystem) != "" {
		systemPrompt = strings.TrimSpace(pm.cfg.RepairSystem)
	}

	template := defaultRepairTemplate
	if pm.cfg != nil && strings.TrimSpace(pm.cfg.RepairTemplate) != "" {
		template = strings.TrimSpace(pm.cfg.RepairTemplate)
	}

	now := time.Now()
	replacements := map[string]string{
		"{genre}":             req.Genre,
		"{tone}":              req.Tone,
		"{pacing}":            req.Pacing,
		"{source_chapters}":   fmt.Sprintf("%d", len(req.Chapters)),
		"{generated_at}":      now.Format(time.RFC3339),
		"{validation_errors}": repairIssues(validationErr),
		"{raw_yaml}":          sanitizeLLMOutput(rawYAML),
		"{repair_attempt}":    fmt.Sprintf("%d", attempt),
	}

	userPrompt = template
	for old, newVal := range replacements {
		userPrompt = strings.ReplaceAll(userPrompt, old, newVal)
	}

	userPrompt = strings.TrimSpace(userPrompt) + "\n\n" + pm.schemaContract(req, now)
	return systemPrompt, userPrompt
}

func (pm *PromptManager) MaxRepairAttempts() int {
	if pm.cfg != nil && pm.cfg.MaxRepairAttempts > 0 {
		return pm.cfg.MaxRepairAttempts
	}
	return 1
}

func (pm *PromptManager) schemaContract(req ConvertRequest, now time.Time) string {
	return fmt.Sprintf(`必须满足以下输出契约：
%s

生成补充规则：
- metadata.source_chapters 必须为 %d
- metadata.generated_at 必须使用 %s
- metadata.genre/tone/pacing 必须分别为 %s/%s/%s
- 如果无法确定标题，可基于第一章标题生成整体剧名
- 如果无法确定作者，请填写 "未知作者"
- consistency_report 中三个字段必须始终存在，允许为空数组
- 只能输出 YAML，禁止输出 Markdown 代码块`,
		screenplaySchemaSynopsis,
		len(req.Chapters),
		now.Format(time.RFC3339),
		req.Genre,
		req.Tone,
		req.Pacing,
	)
}

func renderPromptTemplate(template string, req ConvertRequest, now time.Time) string {
	replacements := map[string]string{
		"{genre}":           req.Genre,
		"{tone}":            req.Tone,
		"{pacing}":          req.Pacing,
		"{chapters_text}":   chapterInputText(req.Chapters),
		"{source_chapters}": fmt.Sprintf("%d", len(req.Chapters)),
		"{generated_at}":    now.Format(time.RFC3339),
	}

	out := template
	for old, newVal := range replacements {
		out = strings.ReplaceAll(out, old, newVal)
	}
	return out
}

func chapterInputText(chapters []ChapterInput) string {
	var builder strings.Builder
	for i, ch := range chapters {
		fmt.Fprintf(&builder, "【第%d章 %s】\n%s\n\n", i+1, ch.Title, ch.Text)
	}
	return builder.String()
}

func repairIssues(err error) string {
	if err == nil {
		return "未提供错误信息，请根据 Schema v1.0 自查并输出完整 YAML。"
	}

	var convertErr *ConvertError
	if errors.As(err, &convertErr) {
		return convertErr.Message
	}
	return err.Error()
}
