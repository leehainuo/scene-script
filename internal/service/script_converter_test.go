package service

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"scene-script/config"
	"scene-script/internal/model"
)

type fakeLLMProvider struct {
	responses []string
	err       error
	calls     int
}

func (f *fakeLLMProvider) GenerateScript(ctx context.Context, systemPrompt, userPrompt string) (*LLMResponse, error) {
	if f.err != nil {
		return nil, f.err
	}
	f.calls++
	if len(f.responses) == 0 {
		return &LLMResponse{Content: ""}, nil
	}
	idx := f.calls - 1
	if idx >= len(f.responses) {
		idx = len(f.responses) - 1
	}
	return &LLMResponse{Content: f.responses[idx]}, nil
}

type fakeStructuredLLMProvider struct {
	fakeLLMProvider
	structuredResp  *StructuredChapterSummaryResponse
	structuredErr   error
	structuredCalls int
}

func (f *fakeStructuredLLMProvider) GenerateStructuredChapterSummary(ctx context.Context, systemPrompt, userPrompt string) (*StructuredChapterSummaryResponse, error) {
	if f.structuredErr != nil {
		return nil, f.structuredErr
	}
	f.structuredCalls++
	if f.structuredResp == nil {
		return nil, fmt.Errorf("no structured response configured")
	}
	return f.structuredResp, nil
}

type fakeYAMLLLMProvider struct {
	fakeLLMProvider
	yamlResponses []string
	yamlCalls     int
}

func (f *fakeYAMLLLMProvider) GenerateYAMLScript(ctx context.Context, systemPrompt, userPrompt string) (*LLMResponse, error) {
	f.yamlCalls++
	if len(f.yamlResponses) == 0 {
		return &LLMResponse{Content: ""}, nil
	}
	idx := f.yamlCalls - 1
	if idx >= len(f.yamlResponses) {
		idx = len(f.yamlResponses) - 1
	}
	return &LLMResponse{Content: f.yamlResponses[idx]}, nil
}

type fakeConcurrentLLMProvider struct {
	mu        sync.Mutex
	active    int
	maxActive int
	calls     int
	delay     time.Duration
}

func (f *fakeConcurrentLLMProvider) GenerateScript(ctx context.Context, systemPrompt, userPrompt string) (*LLMResponse, error) {
	f.mu.Lock()
	f.active++
	if f.active > f.maxActive {
		f.maxActive = f.active
	}
	f.calls++
	callIndex := f.calls - 1
	f.mu.Unlock()

	time.Sleep(f.delay)

	f.mu.Lock()
	f.active--
	f.mu.Unlock()

	_ = callIndex
	title := extractSummaryTitle(userPrompt)
	if title == "" {
		title = "未知章节"
	}
	resp := fmt.Sprintf("章节标题：%s\n关键人物：\n- 角色\n关键地点：\n- 地点\n关键事件：\n- 事件\n关键冲突：\n- 冲突\n伏笔线索：\n- 线索\n结尾状态：状态", title)
	return &LLMResponse{Content: resp}, nil
}

func extractSummaryTitle(userPrompt string) string {
	const marker = "1. 章节标题："
	start := strings.Index(userPrompt, marker)
	if start == -1 {
		return ""
	}
	start += len(marker)
	end := strings.Index(userPrompt[start:], "\n")
	if end == -1 {
		return strings.TrimSpace(userPrompt[start:])
	}
	return strings.TrimSpace(userPrompt[start : start+end])
}

func testConverter(t *testing.T, contents ...string) *ScriptConverter {
	t.Helper()

	converter, err := NewScriptConverter(&config.LLMConf{
		Prompt: config.LLMPromptConf{
			System:            "system",
			Template:          "体裁: {genre}\n语气: {tone}\n节奏: {pacing}\n\n小说内容:\n{chapters_text}",
			MaxRepairAttempts: 1,
		},
	}, &fakeLLMProvider{responses: contents})
	if err != nil {
		t.Fatalf("new converter failed: %v", err)
	}
	return converter
}

func TestValidateConsistency(t *testing.T) {
	converter := testConverter(t, "")

	script := &model.ScriptYAML{
		DramatisPersonae: []model.Character{
			{Name: "张三", Archetype: "主角"},
			{Name: "李四", Archetype: "配角"},
		},
		Settings: []model.Setting{
			{Name: "公寓", Importance: "high"},
			{Name: "办公室", Importance: "medium"},
		},
		Chapters: []model.Chapter{
			{
				ID: "ch1",
				Scenes: []model.Scene{
					{
						ID:       "ch1.sc1",
						Location: "公寓",
						POV:      "张三",
						Beats: []model.Beat{
							{
								ID:      "ch1.sc1.b1",
								Type:    "dialogue",
								Summary: "张三开口",
								Dialogue: &model.Dialogue{
									Speaker: "张三",
									Content: "你好",
								},
							},
						},
					},
					{
						ID:       "ch1.sc2",
						Location: "咖啡厅",
						POV:      "王五",
						Beats: []model.Beat{
							{
								ID:      "ch1.sc2.b1",
								Type:    "dialogue",
								Summary: "陌生人说话",
								Dialogue: &model.Dialogue{
									Speaker: "王五",
									Content: "hello",
								},
							},
						},
					},
				},
			},
		},
	}

	report := converter.validateConsistency(script)
	if len(report.RolesMissing) != 1 || report.RolesMissing[0] != "王五" {
		t.Fatalf("unexpected missing roles: %#v", report.RolesMissing)
	}
	if len(report.SettingsMissing) != 1 || report.SettingsMissing[0] != "咖啡厅" {
		t.Fatalf("unexpected missing settings: %#v", report.SettingsMissing)
	}
	if len(report.DanglingRefs) != 2 {
		t.Fatalf("unexpected dangling refs: %#v", report.DanglingRefs)
	}
	if !strings.Contains(strings.Join(report.DanglingRefs, ","), "李四") {
		t.Fatalf("expected dangling refs to include 李四, got %#v", report.DanglingRefs)
	}
}

func TestGenerateSummary(t *testing.T) {
	converter := testConverter(t, "")

	script := &model.ScriptYAML{
		DramatisPersonae: []model.Character{{Name: "张三"}, {Name: "李四"}},
		Settings:         []model.Setting{{Name: "公寓"}, {Name: "办公室"}, {Name: "咖啡厅"}},
		Chapters: []model.Chapter{
			{
				ID: "ch1",
				Scenes: []model.Scene{
					{ID: "ch1.sc1", Beats: []model.Beat{{Type: "dialogue"}, {Type: "action"}}},
					{ID: "ch1.sc2", Beats: []model.Beat{{Type: "inner"}}},
				},
			},
			{
				ID: "ch2",
				Scenes: []model.Scene{
					{ID: "ch2.sc1", Beats: []model.Beat{{Type: "exposition"}, {Type: "dialogue"}, {Type: "action"}}},
				},
			},
		},
	}

	summary := converter.generateSummary(script)
	if summary.Chapters != 2 || summary.Scenes != 3 || summary.Beats != 6 || summary.Characters != 2 || summary.Settings != 3 {
		t.Fatalf("unexpected summary: %#v", summary)
	}
}

func TestBuildPrompt(t *testing.T) {
	converter := testConverter(t, "")
	req := ConvertRequest{
		Chapters: []ChapterInput{
			{Title: "第一章", Text: "内容1"},
			{Title: "第二章", Text: "内容2"},
		},
		Genre:  "悬疑",
		Tone:   "压抑",
		Pacing: "medium",
	}

	prompt := converter.buildPrompt(req)
	for _, want := range []string{
		"悬疑",
		"压抑",
		"medium",
		"第一章",
		"任务说明：",
		"输出预算：",
		"输入正文：",
		"traits 和 relations 必须是 YAML sequence",
		`错误示例：traits: "敏锐、孤勇、理性中存有共情"`,
		"不得输出 Schema 之外的新顶层字段",
		"如果某个数组字段当前没有可靠内容，优先输出空数组",
		"每个 beat 都必须有非空 summary",
		"如果没有可靠对白内容，不要输出 dialogue/inner 却缺少 dialogue",
	} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("prompt missing %q: %s", want, prompt)
		}
	}
}

func TestBuildPromptIncludesCompactBudgetForTwelveChapters(t *testing.T) {
	converter := testConverter(t, "")
	req := ConvertRequest{
		Genre:  "悬疑",
		Tone:   "压抑",
		Pacing: "medium",
	}
	for i := 0; i < 12; i++ {
		req.Chapters = append(req.Chapters, ChapterInput{
			Title: fmt.Sprintf("第%d章", i+1),
			Text:  "章节摘要",
		})
	}

	prompt := converter.buildPrompt(req)
	if !strings.Contains(prompt, "当源章节数为 9~12 章时，必须使用紧凑输出") {
		t.Fatalf("expected compact budget rule in prompt, got %s", prompt)
	}
	if !strings.Contains(prompt, "- 第1章《第1章》") {
		t.Fatalf("expected chapter list in task section, got %s", prompt)
	}
}

func TestChapterSummaryPromptUsesStructuredSections(t *testing.T) {
	pm := NewPromptManager(&config.LLMPromptConf{})
	req := ConvertRequest{
		Genre:  "悬疑",
		Tone:   "压抑",
		Pacing: "medium",
	}
	systemPrompt, userPrompt := pm.ChapterSummaryPrompt(req, ChapterInput{
		Title: "第一章",
		Text:  "张三回到旧宅，发现遗失已久的钥匙。",
	}, 0, 500)

	if !strings.Contains(systemPrompt, "结构化摘要") {
		t.Fatalf("expected structured summary system prompt, got %s", systemPrompt)
	}
	for _, want := range []string{
		"关键人物：",
		"关键地点：",
		"关键事件：",
		"关键冲突：",
		"伏笔线索：",
		"结尾状态：",
		"`- 无`",
	} {
		if !strings.Contains(userPrompt, want) {
			t.Fatalf("expected summary prompt to contain %q, got %s", want, userPrompt)
		}
	}
}

func TestChapterSummaryStructuredPromptExplicitlyRequiresJSON(t *testing.T) {
	pm := NewPromptManager(&config.LLMPromptConf{})
	req := ConvertRequest{
		Genre:  "悬疑",
		Tone:   "压抑",
		Pacing: "medium",
	}

	systemPrompt, userPrompt := pm.ChapterSummaryStructuredPrompt(req, ChapterInput{
		Title: "第一章",
		Text:  "张三回到旧宅，发现旧钥匙。",
	}, 0, 500)

	for _, want := range []string{
		"JSON object",
		"合法 JSON",
		"只返回一个 JSON object",
		"chapter_title, characters, locations, plot_points, conflicts, foreshadowing, ending_state",
	} {
		if !strings.Contains(systemPrompt, want) && !strings.Contains(userPrompt, want) {
			t.Fatalf("expected structured summary prompts to contain %q, system=%s user=%s", want, systemPrompt, userPrompt)
		}
	}
}

func TestConvertSanitizesAndNormalizesYAML(t *testing.T) {
	raw := "```yaml\nversion: \"1.0\"\nmetadata:\n  title: \"测试小说\"\n  author: \"作者甲\"\n  genre: \"悬疑\"\n  tone: \"压抑\"\n  pacing: \"medium\"\n  source_chapters: 3\n  generated_at: \"2025-06-05T12:30:00Z\"\ndramatis_personae:\n  - name: \"张三\"\n    archetype: \"主角\"\n    motivation: \"调查真相\"\n    traits: [\"冷静\"]\n    relations: []\n    first_appearance: \"Chapter 1\"\nsettings:\n  - name: \"旧宅\"\n    description: \"年久失修的老房子\"\n    importance: \"high\"\nchapters:\n  - id: \"ch1\"\n    title: \"第一章\"\n    summary: \"张三来到旧宅，发现“神秘钥匙”。\"\n    scenes:\n      - id: \"ch1.sc1\"\n        title: \"到达旧宅\"\n        goal: \"张三进入旧宅\"\n        location: \"旧宅\"\n        time: \"Night\"\n        pov: \"张三\"\n        mood: \"紧张\"\n        beats:\n          - id: \"ch1.sc1.b1\"\n            type: \"dialogue\"\n            summary: \"张三自语\"\n            dialogue:\n              speaker: \"张三\"\n              content: \"线索就在这里。\"\n        outcome: \"张三带着线索离开旧宅。\"\n  - id: \"ch2\"\n    title: \"第二章\"\n    summary: \"张三研究钥匙。\"\n    scenes: []\n  - id: \"ch3\"\n    title: \"第三章\"\n    summary: \"张三准备行动。\"\n    scenes: []\nconsistency_report:\n  roles_missing: []\n  settings_missing: []\n  dangling_refs: []\n```"
	converter := testConverter(t, raw)

	result, err := converter.Convert(context.Background(), ConvertRequest{
		Chapters: []ChapterInput{
			{Title: "第一章", Text: "内容1"},
			{Title: "第二章", Text: "内容2"},
			{Title: "第三章", Text: "内容3"},
		},
		Genre:  "悬疑",
		Tone:   "压抑",
		Pacing: "medium",
	})
	if err != nil {
		t.Fatalf("convert failed: %v", err)
	}

	if strings.Contains(result.YAML, "```") {
		t.Fatalf("yaml should be normalized without fences: %s", result.YAML)
	}
	if result.Summary.Chapters != 3 || result.Summary.Scenes != 1 || result.Summary.Beats != 1 {
		t.Fatalf("unexpected summary: %#v", result.Summary)
	}
	if len(result.ConsistencyReport.DanglingRefs) == 0 {
		t.Fatalf("expected dangling refs to be generated, got %#v", result.ConsistencyReport)
	}
	if !strings.Contains(result.YAML, "consistency_report:") {
		t.Fatalf("expected normalized yaml to include consistency report: %s", result.YAML)
	}
}

func TestConvertRejectsInvalidVersion(t *testing.T) {
	converter := testConverter(t, "version: \"2.0\"\nmetadata:\n  title: \"x\"\n  author: \"y\"\n  genre: \"悬疑\"\n  tone: \"压抑\"\n  pacing: \"medium\"\n  source_chapters: 3\n  generated_at: \"2025-06-05T12:30:00Z\"\ndramatis_personae: []\nsettings: []\nchapters: []\nconsistency_report:\n  roles_missing: []\n  settings_missing: []\n  dangling_refs: []\n")

	_, err := converter.Convert(context.Background(), ConvertRequest{
		Chapters: []ChapterInput{
			{Title: "第一章", Text: "内容1"},
			{Title: "第二章", Text: "内容2"},
			{Title: "第三章", Text: "内容3"},
		},
		Genre:  "悬疑",
		Tone:   "压抑",
		Pacing: "medium",
	})
	if err == nil {
		t.Fatal("expected schema validation error")
	}

	convertErr, ok := err.(*ConvertError)
	if !ok {
		t.Fatalf("expected ConvertError, got %T", err)
	}
	if convertErr.Code != ConvertErrorSchema {
		t.Fatalf("unexpected error code: %s", convertErr.Code)
	}
}

func TestConvertRepairsSchemaViolations(t *testing.T) {
	invalid := "version: \"1.0\"\nmetadata:\n  genre: \"悬疑\"\n  tone: \"压抑\"\n  pacing: \"medium\"\ndramatis_personae:\n  - name: \"张三\"\nsettings:\n  - name: \"旧宅\"\n    description: \"老房子\"\nchapters:\n  - id: \"chapter-1\"\n    title: \"第一章\"\nconsistency_report:\n  roles_missing: []\n  settings_missing: []\n  dangling_refs: []\n"
	valid := "version: \"1.0\"\nmetadata:\n  title: \"旧宅疑云\"\n  author: \"未知作者\"\n  genre: \"悬疑\"\n  tone: \"压抑\"\n  pacing: \"medium\"\n  source_chapters: 3\n  generated_at: \"2025-06-05T12:30:00Z\"\ndramatis_personae:\n  - name: \"张三\"\n    archetype: \"主角\"\n    motivation: \"查明匿名来信背后的真相\"\n    traits: [\"冷静\", \"执着\"]\n    relations: [\"与李四互相试探\"]\n    first_appearance: \"Chapter 1\"\n  - name: \"李四\"\n    archetype: \"配角\"\n    motivation: \"隐瞒旧宅秘密\"\n    traits: [\"谨慎\"]\n    relations: [\"与张三关系紧张\"]\n    first_appearance: \"Chapter 2\"\nsettings:\n  - name: \"旧宅\"\n    description: \"年久失修、藏有秘密的老宅\"\n    importance: \"high\"\nchapters:\n  - id: \"ch1\"\n    title: \"第一章\"\n    summary: \"张三收到匿名来信，决定回到旧宅调查真相。\"\n    scenes:\n      - id: \"ch1.sc1\"\n        title: \"归来\"\n        goal: \"张三回到旧宅寻找线索\"\n        location: \"旧宅\"\n        time: \"Night\"\n        pov: \"张三\"\n        mood: \"紧张\"\n        beats:\n          - id: \"ch1.sc1.b1\"\n            type: \"action\"\n            summary: \"张三推开旧宅大门\"\n        outcome: \"张三在旧宅发现异常痕迹。\"\n  - id: \"ch2\"\n    title: \"第二章\"\n    summary: \"张三在地下室发现钥匙，并开始怀疑李四。\"\n    scenes: []\n  - id: \"ch3\"\n    title: \"第三章\"\n    summary: \"张三与李四对质，危险也逐渐逼近。\"\n    scenes: []\nconsistency_report:\n  roles_missing: []\n  settings_missing: []\n  dangling_refs: []\n"

	converter := testConverter(t, invalid, valid)
	result, err := converter.Convert(context.Background(), ConvertRequest{
		Chapters: []ChapterInput{
			{Title: "第一章", Text: "张三收到一封匿名来信，决定回到旧宅调查真相。"},
			{Title: "第二章", Text: "张三在旧宅地下室发现一把奇怪的钥匙，并怀疑李四隐瞒了什么。"},
			{Title: "第三章", Text: "张三和李四对质，真相逐渐浮出水面，但更大的危险也逼近。"},
		},
		Genre:  "悬疑",
		Tone:   "压抑",
		Pacing: "medium",
	})
	if err != nil {
		t.Fatalf("expected repair flow to succeed, got %v", err)
	}
	if !strings.Contains(result.YAML, "title: 旧宅疑云") {
		t.Fatalf("expected repaired yaml, got %s", result.YAML)
	}
	if result.Summary.Chapters != 3 {
		t.Fatalf("unexpected summary after repair: %#v", result.Summary)
	}
}

func TestSanitizeQuotedYAMLTextConvertsBrokenQuotedSummary(t *testing.T) {
	raw := "chapters:\n  - id: \"ch1\"\n    title: \"第一章\"\n    summary: \"他抖开油纸包，墨迹晕染：‘我封他们进钟，因钟能困住时间…可困住我的，是他们的时辰。’”\n    scenes: []\n"

	sanitized := sanitizeQuotedYAMLText(raw)

	if !strings.Contains(sanitized, "summary: |-") {
		t.Fatalf("expected summary to be rewritten as block scalar, got %s", sanitized)
	}
	if !strings.Contains(sanitized, "  他抖开油纸包") {
		t.Fatalf("expected rewritten block scalar body, got %s", sanitized)
	}
}

func TestSanitizeQuotedYAMLTextDecodesEscapedSummaryContent(t *testing.T) {
	raw := "chapters:\n  - id: \"ch1\"\n    title: \"第一章\"\n    summary: \"沈砚进入老宅。\\n\\n他看见薄木棺。\\\"异样\\\"升起。\"\n    scenes: []\n"

	sanitized := sanitizeQuotedYAMLText(raw)

	if strings.Contains(sanitized, `\n`) {
		t.Fatalf("expected escaped newlines to be decoded, got %s", sanitized)
	}
	if strings.Contains(sanitized, `\"`) {
		t.Fatalf("expected escaped quotes to be decoded, got %s", sanitized)
	}
	if !strings.Contains(sanitized, "summary: |-") {
		t.Fatalf("expected summary to be rewritten as block scalar, got %s", sanitized)
	}
	if !strings.Contains(sanitized, "  他看见薄木棺。\"异样\"升起。") {
		t.Fatalf("expected decoded summary body, got %s", sanitized)
	}
}

func TestSanitizeQuotedYAMLTextTrimsDanglingTerminalQuote(t *testing.T) {
	raw := "chapters:\n  - id: \"ch1\"\n    title: \"第一章\"\n    summary: \"沈砚进山执行文物清点任务。\\n\\n推门入内，见厅堂中央摆放着同样被银钉钉死的薄木棺，悬念陡升。\\\"\"\n    scenes: []\n"

	sanitized := sanitizeQuotedYAMLText(raw)

	if strings.Contains(sanitized, `悬念陡升。"`) {
		t.Fatalf("expected dangling terminal quote to be trimmed, got %s", sanitized)
	}
	if !strings.Contains(sanitized, "  推门入内，见厅堂中央摆放着同样被银钉钉死的薄木棺，悬念陡升。") {
		t.Fatalf("expected cleaned summary body, got %s", sanitized)
	}
}

func TestNormalizeScriptTextFieldsCompactsNarrativeText(t *testing.T) {
	script := &model.ScriptYAML{
		Version: "1.0",
		Metadata: model.ScriptMetadata{
			Title: "测试作品",
		},
		Settings: []model.Setting{
			{
				Name:        "民宿",
				Description: "山下的简易住宿点。\n\n\n       沈砚休整之地，也是过渡空间。\n\n       曾发生银钉异动。\\\"",
				Importance:  "high",
			},
		},
		Chapters: []model.Chapter{
			{
				ID:      "ch1",
				Title:   "第一章",
				Summary: "第一段。\n\n\n       第二段。\\\"",
				Scenes: []model.Scene{
					{
						ID:       "ch1.sc1",
						Title:    "场景一",
						Goal:     "先靠近。\n\n再确认。\\\"",
						Location: "老屋",
						Time:     "夜",
						POV:      "沈砚",
						Mood:     "压抑",
						Beats: []model.Beat{
							{
								ID:      "ch1.sc1.b1",
								Type:    "action",
								Summary: "观察棺木。\n\n继续靠近。\\\"",
							},
						},
						Outcome: "确认异常。\n\n危险逼近。\\\"",
					},
				},
			},
		},
	}

	fixed := normalizeScriptTextFields(script)
	if fixed == 0 {
		t.Fatalf("expected text normalization fixes")
	}
	if got := script.Settings[0].Description; got != "山下的简易住宿点。 沈砚休整之地，也是过渡空间。 曾发生银钉异动。" {
		t.Fatalf("unexpected setting description normalization: %q", got)
	}
	if got := script.Chapters[0].Summary; got != "第一段。 第二段。" {
		t.Fatalf("unexpected chapter summary normalization: %q", got)
	}
	if got := script.Chapters[0].Scenes[0].Goal; got != "先靠近。 再确认。" {
		t.Fatalf("unexpected scene goal normalization: %q", got)
	}
}

func TestSanitizeKnownSequenceScalarsConvertsCharacterFields(t *testing.T) {
	raw := "dramatis_personae:\n  - name: \"苏晚\"\n    archetype: \"调查者\"\n    motivation: \"搜集怪谈素材，揭开异常现象背后的真相\"\n    traits: \"敏锐、孤勇、理性中存有共情\"\n    relations: \"与陈阿婆构成记忆与遗愿的镜像关系\"\n    first_appearance: \"ch1\"\n"

	sanitized := sanitizeKnownSequenceScalars(raw)

	for _, want := range []string{
		"traits:",
		`- "敏锐"`,
		`- "孤勇"`,
		`- "理性中存有共情"`,
		"relations:",
		`- "与陈阿婆构成记忆与遗愿的镜像关系"`,
	} {
		if !strings.Contains(sanitized, want) {
			t.Fatalf("expected sanitized yaml to contain %q, got %s", want, sanitized)
		}
	}
}

func TestNormalizeChapterSummaryBuildsStructuredFallback(t *testing.T) {
	normalized := normalizeChapterSummary("第一章", "张三回到旧宅，发现失踪多年的线索。")

	for _, want := range []string{
		"章节标题：第一章",
		"关键人物：",
		"关键地点：",
		"关键事件：",
		"- 张三回到旧宅，发现失踪多年的线索。",
		"关键冲突：",
		"伏笔线索：",
		"结尾状态：无",
	} {
		if !strings.Contains(normalized, want) {
			t.Fatalf("expected normalized summary to contain %q, got %s", want, normalized)
		}
	}
}

func TestNormalizeChapterSummaryPreservesStructuredSections(t *testing.T) {
	raw := "章节标题：第一章\n关键人物：\n- 张三\n关键地点：\n- 旧宅\n关键事件：\n- 张三进入旧宅\n关键冲突：\n- 张三怀疑李四隐瞒真相\n伏笔线索：\n- 旧钥匙再次出现\n结尾状态：张三决定继续调查。"

	normalized := normalizeChapterSummary("第一章", raw)

	for _, want := range []string{
		"章节标题：第一章",
		"关键人物：\n- 张三",
		"关键地点：\n- 旧宅",
		"关键事件：\n- 张三进入旧宅",
		"关键冲突：\n- 张三怀疑李四隐瞒真相",
		"伏笔线索：\n- 旧钥匙再次出现",
		"结尾状态：张三决定继续调查。",
	} {
		if !strings.Contains(normalized, want) {
			t.Fatalf("expected normalized structured summary to contain %q, got %s", want, normalized)
		}
	}
}

func TestNormalizeStructuredChapterSummaryBuildsSectionedText(t *testing.T) {
	normalized := normalizeStructuredChapterSummary("第一章", StructuredChapterSummary{
		ChapterTitle: "第一章：归来",
		Characters:   []string{"张三"},
		Locations:    []string{"旧宅"},
		PlotPoints:   []string{"张三回到旧宅", "发现失踪多年的线索"},
		Conflicts:    []string{"张三怀疑线索真假"},
		Foreshadow:   []string{"旧钥匙再次出现"},
		EndingState:  "张三决定继续追查。",
	})

	for _, want := range []string{
		"章节标题：第一章：归来",
		"关键人物：\n- 张三",
		"关键地点：\n- 旧宅",
		"关键事件：\n- 张三回到旧宅\n- 发现失踪多年的线索",
		"关键冲突：\n- 张三怀疑线索真假",
		"伏笔线索：\n- 旧钥匙再次出现",
		"结尾状态：张三决定继续追查。",
	} {
		if !strings.Contains(normalized, want) {
			t.Fatalf("expected normalized structured summary to contain %q, got %s", want, normalized)
		}
	}
}

func TestValidateRequestRejectsTooManyChapters(t *testing.T) {
	converter := testConverter(t, "")
	req := ConvertRequest{
		Genre:  "悬疑",
		Tone:   "压抑",
		Pacing: "medium",
	}
	for i := 0; i < 13; i++ {
		req.Chapters = append(req.Chapters, ChapterInput{
			Title: fmt.Sprintf("第%d章", i+1),
			Text:  "内容",
		})
	}

	err := converter.validateRequest(req)
	if err == nil {
		t.Fatal("expected chapter count validation error")
	}
	if !strings.Contains(err.Error(), "between 3 and 12") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBuildInitialTaskTitle(t *testing.T) {
	tests := []struct {
		name     string
		chapters []ChapterInput
		genre    string
		want     string
	}{
		{
			name: "prefer first non generic chapter title",
			chapters: []ChapterInput{
				{Title: "第一章"},
				{Title: "钟楼来信"},
				{Title: "第三章"},
			},
			genre: "悬疑",
			want:  "钟楼来信",
		},
		{
			name: "fallback to genre draft title",
			chapters: []ChapterInput{
				{Title: "第一章"},
				{Title: "第二章"},
				{Title: "第三章"},
			},
			genre: "悬疑",
			want:  "悬疑剧本草稿（3章）",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := BuildInitialTaskTitle(tc.chapters, tc.genre)
			if got != tc.want {
				t.Fatalf("unexpected task title: want %q, got %q", tc.want, got)
			}
		})
	}
}

func TestResolveFinalTaskTitle(t *testing.T) {
	if got := ResolveFinalTaskTitle("悬疑剧本草稿（3章）", "旧宅疑云"); got != "旧宅疑云" {
		t.Fatalf("expected generated title to win, got %q", got)
	}

	if got := ResolveFinalTaskTitle("悬疑剧本草稿（3章）", "第一章"); got != "悬疑剧本草稿（3章）" {
		t.Fatalf("expected generic generated title to be ignored, got %q", got)
	}
}

func TestShouldUseLongFormMode(t *testing.T) {
	converter := testConverter(t, "")

	shortReq := ConvertRequest{
		Chapters: []ChapterInput{
			{Title: "第一章", Text: strings.Repeat("短文本", 200)},
			{Title: "第二章", Text: strings.Repeat("短文本", 200)},
			{Title: "第三章", Text: strings.Repeat("短文本", 200)},
		},
		Genre:  "悬疑",
		Tone:   "压抑",
		Pacing: "medium",
	}
	if converter.shouldUseLongFormMode(shortReq) {
		t.Fatal("expected short request not to use long form mode")
	}

	longReq := ConvertRequest{
		Chapters: []ChapterInput{
			{Title: "第一章", Text: strings.Repeat("很长的正文。", 2200)},
			{Title: "第二章", Text: strings.Repeat("很长的正文。", 200)},
			{Title: "第三章", Text: strings.Repeat("很长的正文。", 200)},
		},
		Genre:  "悬疑",
		Tone:   "压抑",
		Pacing: "medium",
	}
	if !converter.shouldUseLongFormMode(longReq) {
		t.Fatal("expected long request to use long form mode")
	}

	manyChaptersReq := ConvertRequest{
		Genre:  "悬疑",
		Tone:   "压抑",
		Pacing: "medium",
	}
	for i := 0; i < 8; i++ {
		manyChaptersReq.Chapters = append(manyChaptersReq.Chapters, ChapterInput{
			Title: fmt.Sprintf("第%d章", i+1),
			Text:  strings.Repeat("中等长度正文。", 100),
		})
	}
	if !converter.shouldUseLongFormMode(manyChaptersReq) {
		t.Fatal("expected 8 chapters request to use long form mode")
	}
}

func TestConvertWithLongFormSummarization(t *testing.T) {
	validYAML := "version: \"1.0\"\nmetadata:\n  title: \"旧宅疑云\"\n  author: \"未知作者\"\n  genre: \"悬疑\"\n  tone: \"压抑\"\n  pacing: \"medium\"\n  source_chapters: 3\n  generated_at: \"2025-06-05T12:30:00Z\"\ndramatis_personae:\n  - name: \"张三\"\n    archetype: \"主角\"\n    motivation: \"查明真相\"\n    traits: [\"冷静\"]\n    relations: []\n    first_appearance: \"Chapter 1\"\nsettings:\n  - name: \"旧宅\"\n    description: \"废弃多年的老宅\"\n    importance: \"high\"\nchapters:\n  - id: \"ch1\"\n    title: \"第一章\"\n    summary: \"张三回到旧宅。\"\n    scenes: []\n  - id: \"ch2\"\n    title: \"第二章\"\n    summary: \"调查逐步深入。\"\n    scenes: []\n  - id: \"ch3\"\n    title: \"第三章\"\n    summary: \"危险开始逼近。\"\n    scenes: []\nconsistency_report:\n  roles_missing: []\n  settings_missing: []\n  dangling_refs: []\n"
	llm := &fakeLLMProvider{
		responses: []string{
			"章节标题：第一章\n关键人物：\n- 张三\n关键地点：\n- 旧宅\n关键事件：\n- 张三回到旧宅，发现失踪多年的线索。\n关键冲突：\n- 张三不确定旧宅里的线索是否可信\n伏笔线索：\n- 失踪多年的线索重新出现\n结尾状态：张三决定继续追查。",
			"章节标题：第二章\n关键人物：\n- 张三\n- 李四\n关键地点：\n- 旧宅\n关键事件：\n- 张三调查旧宅，并怀疑李四隐瞒真相。\n关键冲突：\n- 张三与李四互相试探\n伏笔线索：\n- 李四的异常反应\n结尾状态：怀疑进一步加深。",
			"章节标题：第三章\n关键人物：\n- 张三\n关键地点：\n- 旧宅\n关键事件：\n- 张三准备对质，危险逐步逼近。\n关键冲突：\n- 真相逼近前的心理拉扯\n伏笔线索：\n- 危险正在靠近\n结尾状态：对质一触即发。",
			validYAML,
		},
	}
	converter, err := NewScriptConverter(&config.LLMConf{
		Prompt: config.LLMPromptConf{
			System:            "system",
			Template:          "体裁: {genre}\n语气: {tone}\n节奏: {pacing}\n\n小说内容:\n{chapters_text}",
			MaxRepairAttempts: 1,
		},
	}, llm)
	if err != nil {
		t.Fatalf("new converter failed: %v", err)
	}

	var stages []string
	result, err := converter.ConvertWithProgress(context.Background(), ConvertRequest{
		Chapters: []ChapterInput{
			{Title: "第一章", Text: strings.Repeat("旧宅正文。", 2200)},
			{Title: "第二章", Text: strings.Repeat("调查正文。", 2200)},
			{Title: "第三章", Text: strings.Repeat("对质正文。", 2200)},
		},
		Genre:  "悬疑",
		Tone:   "压抑",
		Pacing: "medium",
	}, func(progress ConvertProgress) {
		stages = append(stages, progress.Stage)
	})
	if err != nil {
		t.Fatalf("convert failed: %v", err)
	}

	if llm.calls != 4 {
		t.Fatalf("expected 4 llm calls (3 summarize + 1 generate), got %d", llm.calls)
	}
	if !strings.Contains(strings.Join(stages, ","), ScriptTaskStageSummarizing) {
		t.Fatalf("expected progress to include summarizing, got %#v", stages)
	}
	if result.Summary.Chapters != 3 {
		t.Fatalf("unexpected summary: %#v", result.Summary)
	}
}

func TestCompressLongFormRequestPrefersStructuredSummaryWhenAvailable(t *testing.T) {
	llm := &fakeStructuredLLMProvider{
		structuredResp: &StructuredChapterSummaryResponse{
			Summary: StructuredChapterSummary{
				ChapterTitle: "第一章：归来",
				Characters:   []string{"张三"},
				Locations:    []string{"旧宅"},
				PlotPoints:   []string{"张三回到旧宅"},
				Conflicts:    []string{"张三怀疑旧宅中的线索"},
				Foreshadow:   []string{"失踪多年的钥匙再次出现"},
				EndingState:  "张三决定继续调查。",
			},
		},
	}
	converter, err := NewScriptConverter(&config.LLMConf{
		Prompt: config.LLMPromptConf{
			System:            "system",
			Template:          "小说内容:\n{chapters_text}",
			MaxRepairAttempts: 1,
		},
	}, llm)
	if err != nil {
		t.Fatalf("new converter failed: %v", err)
	}

	req := ConvertRequest{
		Chapters: []ChapterInput{
			{Title: "第一章", Text: strings.Repeat("旧宅线索。", 3000)},
			{Title: "第二章", Text: strings.Repeat("第二章调查。", 3000)},
			{Title: "第三章", Text: strings.Repeat("第三章对质。", 3000)},
			{Title: "第四章", Text: strings.Repeat("第四章推进。", 3000)},
			{Title: "第五章", Text: strings.Repeat("第五章推进。", 3000)},
			{Title: "第六章", Text: strings.Repeat("第六章推进。", 3000)},
			{Title: "第七章", Text: strings.Repeat("第七章推进。", 3000)},
			{Title: "第八章", Text: strings.Repeat("第八章推进。", 3000)},
		},
		Genre:  "悬疑",
		Tone:   "压抑",
		Pacing: "medium",
	}

	compressed, _, err := converter.compressLongFormRequest(context.Background(), req)
	if err != nil {
		t.Fatalf("compressLongFormRequest failed: %v", err)
	}
	if llm.structuredCalls == 0 {
		t.Fatalf("expected structured summary generation to be used")
	}
	if llm.calls != 0 {
		t.Fatalf("expected text summary fallback to be skipped, got %d calls", llm.calls)
	}
	if !strings.Contains(compressed.Chapters[0].Text, "章节标题：第一章：归来") {
		t.Fatalf("expected structured summary to be normalized, got %s", compressed.Chapters[0].Text)
	}
}

func TestCompressLongFormRequestFallsBackToTextSummaryWhenStructuredFails(t *testing.T) {
	llm := &fakeStructuredLLMProvider{
		structuredErr: fmt.Errorf("provider does not support response_format"),
		fakeLLMProvider: fakeLLMProvider{
			responses: []string{
				"章节标题：第一章\n关键人物：\n- 张三\n关键地点：\n- 旧宅\n关键事件：\n- 张三回到旧宅\n关键冲突：\n- 张三心存怀疑\n伏笔线索：\n- 旧钥匙出现\n结尾状态：张三决定继续调查。",
				"章节标题：第二章\n关键人物：\n- 张三\n关键地点：\n- 旧宅\n关键事件：\n- 张三继续调查\n关键冲突：\n- 李四开始回避\n伏笔线索：\n- 李四的异常反应\n结尾状态：怀疑加深。",
				"章节标题：第三章\n关键人物：\n- 张三\n关键地点：\n- 旧宅\n关键事件：\n- 张三准备对质\n关键冲突：\n- 真相逼近\n伏笔线索：\n- 危险靠近\n结尾状态：冲突升级。",
				"章节标题：第四章\n关键人物：\n- 张三\n关键地点：\n- 旧宅\n关键事件：\n- 第四章推进\n关键冲突：\n- 无\n伏笔线索：\n- 无\n结尾状态：无",
				"章节标题：第五章\n关键人物：\n- 张三\n关键地点：\n- 旧宅\n关键事件：\n- 第五章推进\n关键冲突：\n- 无\n伏笔线索：\n- 无\n结尾状态：无",
				"章节标题：第六章\n关键人物：\n- 张三\n关键地点：\n- 旧宅\n关键事件：\n- 第六章推进\n关键冲突：\n- 无\n伏笔线索：\n- 无\n结尾状态：无",
				"章节标题：第七章\n关键人物：\n- 张三\n关键地点：\n- 旧宅\n关键事件：\n- 第七章推进\n关键冲突：\n- 无\n伏笔线索：\n- 无\n结尾状态：无",
				"章节标题：第八章\n关键人物：\n- 张三\n关键地点：\n- 旧宅\n关键事件：\n- 第八章推进\n关键冲突：\n- 无\n伏笔线索：\n- 无\n结尾状态：无",
			},
		},
	}
	converter, err := NewScriptConverter(&config.LLMConf{
		Prompt: config.LLMPromptConf{
			System:            "system",
			Template:          "小说内容:\n{chapters_text}",
			MaxRepairAttempts: 1,
		},
	}, llm)
	if err != nil {
		t.Fatalf("new converter failed: %v", err)
	}

	req := ConvertRequest{
		Chapters: []ChapterInput{
			{Title: "第一章", Text: strings.Repeat("旧宅线索。", 3000)},
			{Title: "第二章", Text: strings.Repeat("第二章调查。", 3000)},
			{Title: "第三章", Text: strings.Repeat("第三章对质。", 3000)},
			{Title: "第四章", Text: strings.Repeat("第四章推进。", 3000)},
			{Title: "第五章", Text: strings.Repeat("第五章推进。", 3000)},
			{Title: "第六章", Text: strings.Repeat("第六章推进。", 3000)},
			{Title: "第七章", Text: strings.Repeat("第七章推进。", 3000)},
			{Title: "第八章", Text: strings.Repeat("第八章推进。", 3000)},
		},
		Genre:  "悬疑",
		Tone:   "压抑",
		Pacing: "medium",
	}

	compressed, _, err := converter.compressLongFormRequest(context.Background(), req)
	if err != nil {
		t.Fatalf("compressLongFormRequest failed: %v", err)
	}
	if llm.calls == 0 {
		t.Fatalf("expected text summary fallback to be used")
	}
	if !strings.Contains(compressed.Chapters[0].Text, "章节标题：第一章") {
		t.Fatalf("expected fallback text summary to be normalized, got %s", compressed.Chapters[0].Text)
	}
}

func TestCompressLongFormRequestProcessesChaptersConcurrently(t *testing.T) {
	llm := &fakeConcurrentLLMProvider{
		delay: 25 * time.Millisecond,
	}
	converter, err := NewScriptConverter(&config.LLMConf{
		Prompt: config.LLMPromptConf{
			System:            "system",
			Template:          "小说内容:\n{chapters_text}",
			MaxRepairAttempts: 1,
		},
	}, llm)
	if err != nil {
		t.Fatalf("new converter failed: %v", err)
	}

	req := ConvertRequest{
		Chapters: []ChapterInput{
			{Title: "第一章", Text: strings.Repeat("内容1。", 3000)},
			{Title: "第二章", Text: strings.Repeat("内容2。", 3000)},
			{Title: "第三章", Text: strings.Repeat("内容3。", 3000)},
			{Title: "第四章", Text: strings.Repeat("内容4。", 3000)},
			{Title: "第五章", Text: strings.Repeat("内容5。", 3000)},
			{Title: "第六章", Text: strings.Repeat("内容6。", 3000)},
			{Title: "第七章", Text: strings.Repeat("内容7。", 3000)},
			{Title: "第八章", Text: strings.Repeat("内容8。", 3000)},
		},
		Genre:  "悬疑",
		Tone:   "压抑",
		Pacing: "medium",
	}

	compressed, _, err := converter.compressLongFormRequest(context.Background(), req)
	if err != nil {
		t.Fatalf("compressLongFormRequest failed: %v", err)
	}
	if llm.maxActive <= 1 {
		t.Fatalf("expected concurrent summarization, maxActive=%d", llm.maxActive)
	}
	if !strings.Contains(compressed.Chapters[0].Text, "章节标题：第一章") {
		t.Fatalf("expected first chapter summary to stay in place, got %s", compressed.Chapters[0].Text)
	}
	if !strings.Contains(compressed.Chapters[7].Text, "章节标题：第八章") {
		t.Fatalf("expected last chapter summary to stay in place, got %s", compressed.Chapters[7].Text)
	}
}

func TestGenerateYAMLScriptPrefersSpecializedProvider(t *testing.T) {
	provider := &fakeYAMLLLMProvider{
		yamlResponses: []string{"version: \"1.0\""},
		fakeLLMProvider: fakeLLMProvider{
			responses: []string{"plain-text"},
		},
	}
	converter, err := NewScriptConverter(&config.LLMConf{
		Prompt: config.LLMPromptConf{
			System:            "system",
			Template:          "小说内容:\n{chapters_text}",
			MaxRepairAttempts: 1,
		},
	}, provider)
	if err != nil {
		t.Fatalf("new converter failed: %v", err)
	}

	resp, err := converter.generateYAMLScript(context.Background(), "system", "user")
	if err != nil {
		t.Fatalf("generateYAMLScript failed: %v", err)
	}
	if provider.yamlCalls != 1 {
		t.Fatalf("expected yaml provider to be used once, got %d", provider.yamlCalls)
	}
	if provider.calls != 0 {
		t.Fatalf("expected default text generator to be skipped, got %d calls", provider.calls)
	}
	if resp.Content != "version: \"1.0\"" {
		t.Fatalf("unexpected yaml response: %s", resp.Content)
	}
}

func TestRepairPromptFlagsTruncation(t *testing.T) {
	pm := NewPromptManager(&config.LLMPromptConf{})
	req := ConvertRequest{
		Chapters: []ChapterInput{
			{Title: "第一章", Text: "章节标题：第一章\n线索出现。"},
			{Title: "第二章", Text: "章节标题：第二章\n调查升级。"},
			{Title: "第三章", Text: "章节标题：第三章\n危险逼近。"},
		},
		Genre:  "悬疑",
		Tone:   "压抑",
		Pacing: "medium",
	}

	_, prompt := pm.RepairPrompt(req, "chapters:\n  - id: \"", fmt.Errorf("yaml parse failed: could not find end character of double-quoted text"), 1)
	for _, want := range []string{
		"Repair 基础守则：",
		"本次失败更接近“输出被截断”",
		"采用“最小合格输出”策略",
		"如果数组字段没有可靠内容，优先输出空数组",
		"不得输出 Schema 之外的新字段或解释文本",
		"用于必要时从头重写的章节输入",
	} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("expected repair prompt to contain %q, got %s", want, prompt)
		}
	}
}

func TestRepairPromptAddsConservativeRulesForSchemaErrors(t *testing.T) {
	pm := NewPromptManager(&config.LLMPromptConf{})
	req := ConvertRequest{
		Chapters: []ChapterInput{
			{Title: "第一章", Text: "第一章正文"},
			{Title: "第二章", Text: "第二章正文"},
			{Title: "第三章", Text: "第三章正文"},
		},
		Genre:  "悬疑",
		Tone:   "压抑",
		Pacing: "medium",
	}

	_, prompt := pm.RepairPrompt(req, "version: \"1.0\"\nchapters:\n  - id: chapter-1", fmt.Errorf("chapters[0].id must match chN"), 2)
	for _, want := range []string{
		"Repair 基础守则：",
		"当前 repair 尝试次数：2",
		"如果信息不充分，优先使用空数组，而不是虚构内容",
		"本次失败属于 YAML 结构或 schema 约束问题。",
		"如果无法确认某个数组字段的具体内容，优先输出空数组",
		"如果无法充分展开 beat 细节，优先保证 top-level、chapter、scene 结构完整",
		"如果某个 beat 缺少必需信息，优先删除该 beat 或将其改写为带 summary 的 exposition/action",
		"不得输出 Schema 之外的新字段或解释文本",
	} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("expected schema repair prompt to contain %q, got %s", want, prompt)
		}
	}
}

func TestNormalizeMalformedBeatsRepairsAndDropsInvalidEntries(t *testing.T) {
	script := &model.ScriptYAML{
		Chapters: []model.Chapter{
			{
				ID:      "ch1",
				Title:   "第一章",
				Summary: "摘要",
				Scenes: []model.Scene{
					{
						ID:       "ch1.sc1",
						Title:    "场景一",
						Goal:     "目标",
						Location: "旧宅",
						Time:     "Night",
						POV:      "张三",
						Mood:     "紧张",
						Outcome:  "收尾",
						Beats: []model.Beat{
							{
								ID:       "ch1.sc1.b1",
								Type:     "dialogue",
								Dialogue: &model.Dialogue{Speaker: "张三", Content: "门后有人。"},
							},
							{
								ID:      "ch1.sc1.b2",
								Type:    "inner",
								Summary: "张三意识到不对劲",
							},
							{
								ID:   "ch1.sc1.b3",
								Type: "dialogue",
							},
						},
					},
				},
			},
		},
	}

	fixed, dropped := normalizeMalformedBeats(script)
	if fixed == 0 {
		t.Fatalf("expected malformed beats to be fixed")
	}
	if dropped != 1 {
		t.Fatalf("expected 1 beat to be dropped, got %d", dropped)
	}
	beats := script.Chapters[0].Scenes[0].Beats
	if len(beats) != 2 {
		t.Fatalf("expected 2 beats after normalization, got %d", len(beats))
	}
	if beats[0].Summary == "" {
		t.Fatalf("expected summary to be derived from dialogue content")
	}
	if beats[1].Type != "exposition" || beats[1].Dialogue != nil {
		t.Fatalf("expected incomplete inner beat to downgrade to exposition, got %#v", beats[1])
	}
}
