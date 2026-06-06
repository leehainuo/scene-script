package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/goccy/go-yaml"

	"scene-script/config"
	"scene-script/internal/model"
)

const defaultConvertSystemPrompt = "你是一名擅长小说改编的结构化剧本引擎。你的唯一任务是输出可被 YAML 解析器直接解析的合法 YAML。禁止解释、禁止分析、禁止 Markdown 代码块、禁止任何 YAML 之外的文本。"
const defaultSummarizeSystemPrompt = "你是一位小说改编策划助手。你需要在不丢失关键情节的前提下，将长章节压缩成适合后续剧本生成的结构化摘要，只输出纯文本，不要输出 YAML、JSON、Markdown 标题或额外解释。"
const defaultStructuredSummarySystemPrompt = "你是一位小说改编信息抽取助手。你需要把章节内容压缩为稳定、忠实、可机读的结构化摘要，并且必须只输出一个合法的 JSON object，不能输出 JSON 之外的任何文本。"
const defaultSceneRewriteSystemPrompt = "你是一位局部剧本改写助手。你的唯一任务是改写单个 scene，并且只输出一个合法的 YAML scene 对象。禁止输出解释、禁止 Markdown 代码块、禁止输出 scene 之外的任何额外文本。"

const defaultRepairSystemPrompt = "你是一位剧本 YAML 修复专家。你必须优先保证 YAML 可解析、结构完整、字段类型正确；若原结果疑似截断，必须丢弃残缺尾部并从头重写一份更紧凑的完整 YAML。只返回 YAML 正文。"

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
- 对 summary/goal/outcome/description/title/dialogue.content 这类自由文本，优先使用 YAML block scalar（例如 |-），不要用双引号包裹整段长中文
- 如果文本中包含中文引号、冒号或嵌套引用，必须改写为 block scalar，避免 YAML 引号转义错误
- summary/goal/outcome/description/dialogue.content 必须保持紧凑自然，不要为了排版手工插入多余空行、缩进或句间留白
- 自由文本内容末尾禁止残留引号、反斜杠或半截转义符

校验失败信息：
{validation_errors}

原始 YAML：
{raw_yaml}`

const screenplaySchemaSynopsis = `Schema v1.0 要求：
- version: "1.0"
- metadata: title, author, genre, tone, pacing, source_chapters, generated_at
- dramatis_personae[].name/archetype/motivation/traits/relations/first_appearance 必填；其中 traits 和 relations 必须是 YAML sequence，不能是字符串
- settings[].name/description/importance 必填；如提供 aliases，aliases 必须是 YAML sequence
- chapters[].id/title/summary/scenes 必填
- scenes[].id/title/goal/location/time/pov/mood/beats/outcome 必填
- beats[].id/type/summary 必填；当 type=dialogue 或 inner 时必须有 dialogue.speaker 和 dialogue.content
- consistency_report 必须包含 roles_missing/settings_missing/dangling_refs，且这三个字段都必须是 YAML sequence`

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

	now := time.Now()
	userPrompt = joinPromptSections(
		"任务说明：\n"+strings.TrimSpace(renderPromptTemplate(template, req, now)),
		pm.schemaContract(req, now),
		"输出预算：\n"+pm.outputBudgetRule(req),
		"输入正文：\n"+chapterInputText(req.Chapters),
	)
	return systemPrompt, userPrompt
}

func (pm *PromptManager) ChapterSummaryPrompt(req ConvertRequest, chapter ChapterInput, chapterIndex int, targetChars int) (systemPrompt, userPrompt string) {
	systemPrompt = defaultSummarizeSystemPrompt
	userPrompt = fmt.Sprintf(`请把下面这章长篇小说内容压缩成适合“小说转剧本”后续生成的轻结构摘要。

目标：
- 保留人物、地点、关键事件、冲突、转折、结尾状态
- 保留能够影响后续剧本结构的伏笔和因果
- 删除大段修辞、重复心理描写和无关环境铺陈
- 输出长度尽量控制在 %d 字以内，但不能丢失关键情节

输出要求：
- 只输出纯文本，不要 YAML，不要 JSON，不要 Markdown 代码块
- 必须严格按以下区块顺序输出，不得新增或删除区块：
  1. 章节标题：%s
  2. 关键人物：
  3. 关键地点：
  4. 关键事件：
  5. 关键冲突：
  6. 伏笔线索：
  7. 结尾状态：
- “关键人物 / 关键地点 / 关键事件 / 关键冲突 / 伏笔线索” 统一使用短列表，每行一个 `+"`- `"+` 条目
- 如果某项没有可靠信息，明确写 `+"`- 无`"+`，不要省略区块
- 结尾状态使用单行短句，不要展开成长段
- 不要虚构原文没有的信息

改编设定：
- 体裁：%s
- 语气：%s
- 节奏：%s
- 章节序号：第 %d 章

原始章节内容：
%s`,
		targetChars,
		strings.TrimSpace(chapter.Title),
		req.Genre,
		req.Tone,
		req.Pacing,
		chapterIndex+1,
		strings.TrimSpace(chapter.Text),
	)
	return systemPrompt, userPrompt
}

func (pm *PromptManager) ChapterSummaryStructuredPrompt(req ConvertRequest, chapter ChapterInput, chapterIndex int, targetChars int) (systemPrompt, userPrompt string) {
	systemPrompt = defaultStructuredSummarySystemPrompt
	userPrompt = fmt.Sprintf(`请从下面章节中提炼结构化摘要，用于后续“小说转剧本”生成。

你必须只返回一个 JSON object。
返回内容必须是合法 JSON。
禁止输出解释、前后缀、Markdown 代码块或任何非 JSON 文本。

字段要求：
- chapter_title：章节标题，保持与原章节一致
- characters：关键人物名称数组，只保留会影响本章改编的人物
- locations：关键地点短语数组，只保留本章主要地点
- plot_points：3~6 条关键事件或推进节点
- conflicts：主要冲突、阻碍或心理拉扯
- foreshadowing：会影响后文结构的伏笔或异常线索；没有则返回空数组
- ending_state：一句话概括本章结尾状态

抽取规则：
- 不要虚构原文没有的信息
- 信息不足时返回空数组，不要补造角色、地点、事件或伏笔
- 只保留对剧本结构有价值的信息，删去修辞、重复心理描写和无关环境铺陈
- plot_points/conflicts/foreshadowing 使用短句，不要写成长段
- ending_state 保持单句、简洁、可直接复用
- 目标信息密度约等于 %d 字的高密度摘要
- 如果某个数组字段没有可靠信息，返回空数组 [] 
- 输出字段名必须严格使用这些 JSON keys：chapter_title, characters, locations, plot_points, conflicts, foreshadowing, ending_state

改编设定：
- 体裁：%s
- 语气：%s
- 节奏：%s
- 章节序号：第 %d 章

原始章节内容：
%s`,
		targetChars,
		req.Genre,
		req.Tone,
		req.Pacing,
		chapterIndex+1,
		strings.TrimSpace(chapter.Text),
	)
	return systemPrompt, userPrompt
}

func (pm *PromptManager) SceneRewritePrompt(
	req ConvertRequest,
	sourceChapter ChapterInput,
	chapterIndex int,
	chapter model.Chapter,
	scene model.Scene,
	characters []model.Character,
	settings []model.Setting,
	instruction string,
) (systemPrompt, userPrompt string) {
	systemPrompt = defaultSceneRewriteSystemPrompt

	sceneYAMLBytes, _ := yaml.Marshal(scene)
	sceneYAML := strings.TrimSpace(string(sceneYAMLBytes))
	if sceneYAML == "" {
		sceneYAML = "{}"
	}

	userPrompt = joinPromptSections(
		fmt.Sprintf(`任务目标：
- 当前只改写第 %d 章中的一个 scene
- 只输出一个 scene YAML 对象，字段必须严格包含：id, title, goal, location, time, pov, mood, beats, outcome
- 不要输出 version、metadata、dramatis_personae、settings、chapters、consistency_report 等其他顶层字段

改写要求：
- scene.id 必须保持为 %s
- beats 必须是 YAML sequence，beat.id 必须保持 chN.scN.bN 形式并从 1 开始连续编号
- beat.type 只能是 action/dialogue/inner/exposition
- 每个 beat 都必须有非空 summary
- 当 beat.type 为 dialogue 或 inner 时，必须同时提供 dialogue.speaker 和 dialogue.content
- 不要虚构原文章节中不存在的核心事实、人物关系或地点关系
- 规则优先级必须严格遵守：schema 完整性 > 原文章节事实 > 用户改写要求
- 如果用户要求与原文章节事实冲突，必须以原文章节事实为准
- 如果用户要求会导致字段缺失、类型错误或结构非法，必须优先保证 schema 完整性
- 只允许改写当前 scene；凡是超出当前 scene 范围、试图改动其他 scene、其他 chapter、人物表、地点表、顶层 metadata 的要求，一律忽略
- 你必须尽量满足用户给出的场景改写要求，但不能改写这一章的核心走向
- 对 title/goal/outcome/dialogue.content 等长文本，优先使用 YAML block scalar（|-）
- goal/outcome/dialogue.content 必须保持紧凑自然，不要为了排版手工插入多余空行、行首缩进或尾部残留引号
- 只返回 scene YAML 正文，禁止解释`, chapterIndex+1, scene.ID),
		fmt.Sprintf("改编设定：\n- 体裁：%s\n- 语气：%s\n- 节奏：%s", req.Genre, req.Tone, req.Pacing),
		"用户改写要求：\n"+strings.TrimSpace(instruction),
		sceneRewriteContext("人物注册表", rewriteCharacterNames(characters)),
		sceneRewriteContext("地点注册表", rewriteSettingNames(settings)),
		"当前章节原文：\n"+strings.TrimSpace(sourceChapter.Text),
		"当前章节结构梗概：\n"+sceneRewriteChapterOutline(chapter),
		"当前场景 YAML：\n"+sceneYAML,
	)
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
		"{raw_yaml}":          repairYAMLContext(rawYAML),
		"{repair_attempt}":    fmt.Sprintf("%d", attempt),
	}

	userPrompt = template
	for old, newVal := range replacements {
		userPrompt = strings.ReplaceAll(userPrompt, old, newVal)
	}

	userPrompt = joinPromptSections(
		strings.TrimSpace(userPrompt),
		pm.repairGuardrails(attempt),
		pm.repairStrategy(req, rawYAML, validationErr),
		"用于必要时从头重写的章节输入：\n"+chapterInputText(req.Chapters),
		pm.schemaContract(req, now),
	)
	return systemPrompt, userPrompt
}

func (pm *PromptManager) MaxRepairAttempts() int {
	if pm.cfg != nil && pm.cfg.MaxRepairAttempts > 0 {
		return pm.cfg.MaxRepairAttempts
	}
	return 2
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
- 不得输出 Schema 之外的新顶层字段，也不要附加注释、解释或说明段落
- 如果某个数组字段当前没有可靠内容，优先输出空数组，不要为了“看起来完整”而虚构实体
- 如果无法充分展开细节，优先保证 top-level、chapter、scene 的结构完整，再压缩 beat 细节
- 不要跨章节虚构原文未出现的人物关系、地点关系或关键事件因果
- consistency_report 中三个字段必须始终存在，允许为空数组
- 每个 beat 都必须有非空 summary
- 当 beat.type 为 dialogue 或 inner 时，必须同时输出完整 dialogue 对象，且 dialogue.speaker 与 dialogue.content 都不能为空
- 如果没有可靠对白内容，不要输出 dialogue/inner 却缺少 dialogue；应减少 beat 数量，或改写为带 summary 的 action/exposition
- 下列字段必须始终输出为 YAML sequence，哪怕只有 1 个元素也要写成列表项形式，禁止写成普通字符串：
  - dramatis_personae[].traits
  - dramatis_personae[].relations
  - settings[].aliases
  - consistency_report.roles_missing
  - consistency_report.settings_missing
  - consistency_report.dangling_refs
- 错误示例：traits: "敏锐、孤勇、理性中存有共情"
- 正确示例：
  traits:
    - "敏锐"
    - "孤勇"
    - "理性中存有共情"
- 错误示例：relations: "与陈阿婆构成记忆与遗愿的镜像关系"
- 正确示例：
  relations:
    - "与陈阿婆构成记忆与遗愿的镜像关系"
- 输出体量必须受控，优先保证完整、可解析、可校验，绝不为了细节堆砌而输出超长 YAML
- 对 9~12 章的紧凑输出，宁可减少 beats 数量，也不要输出缺少 summary 或缺少 dialogue 的残缺 beat
- 对 summary/goal/outcome/description/title/dialogue.content 等长文本字段，优先输出为 YAML block scalar（|-），避免长中文里的引号破坏 YAML
- 对 description/summary/goal/outcome/dialogue.content，不要人为插入空行、段首缩进或尾部悬空引号；保持紧凑单段或自然段落
- 只能输出 YAML，禁止输出 Markdown 代码块`,
		screenplaySchemaSynopsis,
		len(req.Chapters),
		now.Format(time.RFC3339),
		req.Genre,
		req.Tone,
		req.Pacing,
	)
}

func (pm *PromptManager) outputBudgetRule(req ConvertRequest) string {
	chapterCount := len(req.Chapters)
	switch {
	case chapterCount >= 9:
		return "当源章节数为 9~12 章时，必须使用紧凑输出：每章 1~2 个 scenes、每个 scene 2~3 个 beats，summary/goal/outcome 保持简洁，避免冗长对白和重复 exposition"
	case chapterCount >= 6:
		return "当源章节数为 6~8 章时，使用中等压缩：每章 1~3 个 scenes、每个 scene 2~4 个 beats，优先保留推进主线所需的关键事件"
	default:
		return "当源章节数为 3~5 章时，可保持常规细度：每章 2~4 个 scenes、每个 scene 2~5 个 beats，但仍需避免空转和重复描述"
	}
}

func sceneRewriteContext(title string, items []string) string {
	if len(items) == 0 {
		return title + "：\n- 无"
	}
	return title + "：\n" + strings.Join(items, "\n")
}

func rewriteCharacterNames(characters []model.Character) []string {
	lines := make([]string, 0, len(characters))
	for _, character := range characters {
		name := strings.TrimSpace(character.Name)
		if name == "" {
			continue
		}
		lines = append(lines, "- "+name)
	}
	return lines
}

func rewriteSettingNames(settings []model.Setting) []string {
	lines := make([]string, 0, len(settings))
	for _, setting := range settings {
		name := strings.TrimSpace(setting.Name)
		if name == "" {
			continue
		}
		lines = append(lines, "- "+name)
	}
	return lines
}

func sceneRewriteChapterOutline(chapter model.Chapter) string {
	lines := []string{
		fmt.Sprintf("- 章节标题：%s", strings.TrimSpace(chapter.Title)),
		fmt.Sprintf("- 章节摘要：%s", fallbackText(chapter.Summary, "无")),
		fmt.Sprintf("- 场景数量：%d", len(chapter.Scenes)),
	}
	for _, scene := range chapter.Scenes {
		lines = append(lines, fmt.Sprintf("- %s｜%s｜%s", fallbackText(scene.Title, "未命名场景"), fallbackText(scene.Location, "未设地点"), fallbackText(scene.Goal, "未设目标")))
	}
	return strings.Join(lines, "\n")
}

func fallbackText(value, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}

func (pm *PromptManager) repairStrategy(req ConvertRequest, rawYAML string, validationErr error) string {
	if isLikelyTruncatedYAMLError(rawYAML, validationErr) {
		return fmt.Sprintf(`本次失败更接近“输出被截断”而不是普通字段缺失。

修复策略：
- 不要试图续写残缺尾部
- 必须从头重写一份完整 YAML
- 采用“最小合格输出”策略：先保证 version、metadata、dramatis_personae、settings、chapters、consistency_report 六个顶层结构完整
- 保持章节数为 %d 章且 chapter.id 连续
- 如果 scene 或 beat 细节信息不足，可以压缩数量，但不得让 chapters/scenes/beats 字段缺失
- 每个 beat 仍必须完整：summary 不可缺失；dialogue/inner 必须带完整 dialogue 对象；如果做不到，宁可减少 beats 数量
- 如果数组字段没有可靠内容，优先输出空数组，不要编造角色、地点、关系或伏笔
- 必须显著压缩输出体量，优先保住完整结构
- 严禁再次输出半截引号、半截列表项、半截 beat.id
- 不得输出 Schema 之外的新字段或解释文本`, len(req.Chapters))
	}
	return `本次失败属于 YAML 结构或 schema 约束问题。

修复策略：
- 在尽量保持原故事语义不变的前提下修复字段、类型和结构
- 如果某段原始 YAML 已明显损坏，可依据章节输入重写该段，但不要遗漏任何章节
- 如果无法确认某个数组字段的具体内容，优先输出空数组，不要为了“补齐”而虚构
- 如果无法充分展开 beat 细节，优先保证 top-level、chapter、scene 结构完整
- 如果某个 beat 缺少必需信息，优先删除该 beat 或将其改写为带 summary 的 exposition/action，不要保留残缺的 dialogue/inner beat
- 不得输出 Schema 之外的新字段或解释文本`
}

func (pm *PromptManager) repairGuardrails(attempt int) string {
	return fmt.Sprintf(`Repair 基础守则：
- 当前 repair 尝试次数：%d
- 只能输出一份完整 YAML，禁止解释修复过程
- 不得输出 Schema 之外的新顶层字段
- 不得新增原文未出现的核心角色、核心地点或关键因果
- 如果信息不充分，优先使用空数组，而不是虚构内容
- 如果细节不足，优先输出“最小可校验结构”，再逐层补齐 scene 和 beat
- consistency_report 必须始终存在，且三个字段都必须是数组`, attempt)
}

func repairYAMLContext(rawYAML string) string {
	sanitized := sanitizeLLMOutput(rawYAML)
	const maxLen = 6000
	if len([]rune(sanitized)) <= maxLen {
		return sanitized
	}

	runes := []rune(sanitized)
	head := string(runes[:3600])
	tail := string(runes[len(runes)-1800:])
	return strings.TrimSpace(head) + "\n...\n# middle omitted for repair context\n...\n" + strings.TrimSpace(tail)
}

func joinPromptSections(sections ...string) string {
	parts := make([]string, 0, len(sections))
	for _, section := range sections {
		section = strings.TrimSpace(section)
		if section != "" {
			parts = append(parts, section)
		}
	}
	return strings.Join(parts, "\n\n")
}

func renderPromptTemplate(template string, req ConvertRequest, now time.Time) string {
	replacements := map[string]string{
		"{genre}":           req.Genre,
		"{tone}":            req.Tone,
		"{pacing}":          req.Pacing,
		"{chapters_text}":   chapterSourceList(req.Chapters),
		"{source_chapters}": fmt.Sprintf("%d", len(req.Chapters)),
		"{generated_at}":    now.Format(time.RFC3339),
	}

	out := template
	for old, newVal := range replacements {
		out = strings.ReplaceAll(out, old, newVal)
	}
	return out
}

func chapterSourceList(chapters []ChapterInput) string {
	var builder strings.Builder
	for i, ch := range chapters {
		fmt.Fprintf(&builder, "- 第%d章《%s》\n", i+1, strings.TrimSpace(ch.Title))
	}
	return strings.TrimSpace(builder.String())
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
