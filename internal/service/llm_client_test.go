package service

import (
	"testing"

	"scene-script/config"
)

func TestYAMLGenerationProfileForQwenDisablesThinkingAndSetsSeed(t *testing.T) {
	profile := yamlGenerationProfile(&config.LLMConf{
		API: config.LLMAPIConf{
			Model:    "qwen3.6-flash",
			Endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
		},
	})

	if profile.seed == nil || *profile.seed != 7 {
		t.Fatalf("expected deterministic seed to be set, got %#v", profile.seed)
	}
	if profile.extraFields == nil {
		t.Fatal("expected qwen profile extra fields to be set")
	}
	if got, ok := profile.extraFields["enable_thinking"]; !ok || got != false {
		t.Fatalf("expected enable_thinking=false, got %#v", profile.extraFields)
	}
}

func TestYAMLGenerationProfileForGenericProviderKeepsExtraFieldsEmpty(t *testing.T) {
	profile := yamlGenerationProfile(&config.LLMConf{
		API: config.LLMAPIConf{
			Model:    "gpt-4.1-mini",
			Endpoint: "https://api.openai.com/v1",
		},
	})

	if profile.seed == nil || *profile.seed != 7 {
		t.Fatalf("expected deterministic seed to be set, got %#v", profile.seed)
	}
	if len(profile.extraFields) != 0 {
		t.Fatalf("expected no provider-specific extra fields, got %#v", profile.extraFields)
	}
}
