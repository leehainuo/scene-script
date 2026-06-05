package service

import (
	"context"
	"strings"
	"testing"

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
	for _, want := range []string{"悬疑", "压抑", "medium", "第一章"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("prompt missing %q: %s", want, prompt)
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
}

func TestConvertWithLongFormSummarization(t *testing.T) {
	validYAML := "version: \"1.0\"\nmetadata:\n  title: \"旧宅疑云\"\n  author: \"未知作者\"\n  genre: \"悬疑\"\n  tone: \"压抑\"\n  pacing: \"medium\"\n  source_chapters: 3\n  generated_at: \"2025-06-05T12:30:00Z\"\ndramatis_personae:\n  - name: \"张三\"\n    archetype: \"主角\"\n    motivation: \"查明真相\"\n    traits: [\"冷静\"]\n    relations: []\n    first_appearance: \"Chapter 1\"\nsettings:\n  - name: \"旧宅\"\n    description: \"废弃多年的老宅\"\n    importance: \"high\"\nchapters:\n  - id: \"ch1\"\n    title: \"第一章\"\n    summary: \"张三回到旧宅。\"\n    scenes: []\n  - id: \"ch2\"\n    title: \"第二章\"\n    summary: \"调查逐步深入。\"\n    scenes: []\n  - id: \"ch3\"\n    title: \"第三章\"\n    summary: \"危险开始逼近。\"\n    scenes: []\nconsistency_report:\n  roles_missing: []\n  settings_missing: []\n  dangling_refs: []\n"
	llm := &fakeLLMProvider{
		responses: []string{
			"章节标题：第一章\n张三回到旧宅，发现失踪多年的线索。",
			"章节标题：第二章\n张三调查旧宅，并怀疑李四隐瞒真相。",
			"章节标题：第三章\n张三准备对质，危险逐步逼近。",
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
