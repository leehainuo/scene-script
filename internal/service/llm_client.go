package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	einoOpenAI "github.com/cloudwego/eino-ext/components/model/openai"
	einoModel "github.com/cloudwego/eino/components/model"
	einoSchema "github.com/cloudwego/eino/schema"
	"github.com/eino-contrib/jsonschema"
	orderedmap "github.com/wk8/go-ordered-map/v2"
	"go.uber.org/zap"

	"scene-script/config"
	"scene-script/pkg/logn"
)

// LLMResponse - Unified text generation response.
type LLMResponse struct {
	Content string
	Usage   *einoSchema.TokenUsage
}

// LLMProvider - Abstracts model invocation behind a stable interface.
type LLMProvider interface {
	GenerateScript(ctx context.Context, systemPrompt, userPrompt string) (*LLMResponse, error)
}

type StructuredChapterSummary struct {
	ChapterTitle string   `json:"chapter_title"`
	Characters   []string `json:"characters"`
	Locations    []string `json:"locations"`
	PlotPoints   []string `json:"plot_points"`
	Conflicts    []string `json:"conflicts"`
	Foreshadow   []string `json:"foreshadowing"`
	EndingState  string   `json:"ending_state"`
}

type StructuredChapterSummaryResponse struct {
	Summary StructuredChapterSummary
	Usage   *einoSchema.TokenUsage
}

type StructuredSummaryProvider interface {
	GenerateStructuredChapterSummary(ctx context.Context, systemPrompt, userPrompt string) (*StructuredChapterSummaryResponse, error)
}

// LLMClient - Eino based OpenAI-compatible client for Qwen.
type LLMClient struct {
	config                 *config.LLMConf
	model                  einoModel.BaseChatModel
	structuredSummaryModel einoModel.BaseChatModel
}

// NewLLMClient - Create a new Eino-backed client.
func NewLLMClient(cfg *config.LLMConf) (*LLMClient, error) {
	if cfg == nil {
		return nil, fmt.Errorf("llm config is required")
	}
	if strings.TrimSpace(cfg.API.Key) == "" {
		return nil, fmt.Errorf("llm api key is required")
	}
	if strings.TrimSpace(cfg.API.Endpoint) == "" {
		return nil, fmt.Errorf("llm endpoint is required")
	}
	if strings.TrimSpace(cfg.API.Model) == "" {
		return nil, fmt.Errorf("llm model is required")
	}

	timeout := 120 * time.Second
	if cfg.API.TimeoutSeconds > 0 {
		timeout = time.Duration(cfg.API.TimeoutSeconds) * time.Second
	}

	chatModel, err := newOpenAIChatModel(cfg, timeout, nil)
	if err != nil {
		return nil, fmt.Errorf("create eino chat model failed: %w", err)
	}

	structuredSummaryModel, err := newOpenAIChatModel(cfg, timeout, buildSummaryResponseFormat())
	if err != nil {
		return nil, fmt.Errorf("create structured summary model failed: %w", err)
	}

	return &LLMClient{
		config:                 cfg,
		model:                  chatModel,
		structuredSummaryModel: structuredSummaryModel,
	}, nil
}

// GenerateScript - Generate YAML with Eino ChatModel over an OpenAI-compatible endpoint.
func (c *LLMClient) GenerateScript(ctx context.Context, systemPrompt, userPrompt string) (*LLMResponse, error) {
	return c.generateWithModel(ctx, c.model, systemPrompt, userPrompt)
}

func (c *LLMClient) GenerateStructuredChapterSummary(ctx context.Context, systemPrompt, userPrompt string) (*StructuredChapterSummaryResponse, error) {
	resp, err := c.generateWithModel(ctx, c.structuredSummaryModel, systemPrompt, userPrompt)
	if err != nil {
		return nil, err
	}

	var summary StructuredChapterSummary
	if err := json.Unmarshal([]byte(resp.Content), &summary); err != nil {
		return nil, NewConvertError(ConvertErrorLLM, "structured summary unmarshal failed", err)
	}
	summary.normalize()

	return &StructuredChapterSummaryResponse{
		Summary: summary,
		Usage:   resp.Usage,
	}, nil
}

func (c *LLMClient) generateWithModel(ctx context.Context, chatModel einoModel.BaseChatModel, systemPrompt, userPrompt string) (*LLMResponse, error) {
	startedAt := time.Now()
	logn.Debug("llm generate start",
		TaskLogFields(ctx, "llm_request",
			zap.String("model", c.config.API.Model),
			zap.Int("system_prompt_len", len(systemPrompt)),
			zap.Int("user_prompt_len", len(userPrompt)),
		)...,
	)
	msgs := []*einoSchema.Message{
		einoSchema.SystemMessage(systemPrompt),
		einoSchema.UserMessage(userPrompt),
	}

	opts := make([]einoModel.Option, 0, 3)
	if c.config.API.MaxTokens > 0 {
		opts = append(opts, einoModel.WithMaxTokens(c.config.API.MaxTokens))
	}
	if c.config.API.TopP > 0 {
		opts = append(opts, einoModel.WithTopP(c.config.API.TopP))
	}
	if c.config.API.Temperature > 0 {
		opts = append(opts, einoModel.WithTemperature(c.config.API.Temperature))
	}

	resp, err := chatModel.Generate(ctx, msgs, opts...)
	if err != nil {
		logn.Error("llm generate failed",
			TaskLogFields(ctx, "llm_failed",
				zap.String("model", c.config.API.Model),
				zap.Int64("llm_elapsed_ms", time.Since(startedAt).Milliseconds()),
				zap.Error(err),
			)...,
		)
		return nil, NewConvertError(ConvertErrorLLM, "llm generation failed", err)
	}

	content := strings.TrimSpace(resp.Content)
	if content == "" {
		logn.Warn("llm returned empty content",
			TaskLogFields(ctx, "llm_empty",
				zap.String("model", c.config.API.Model),
				zap.Int64("llm_elapsed_ms", time.Since(startedAt).Milliseconds()),
			)...,
		)
		return nil, NewConvertError(ConvertErrorLLM, "llm returned empty content", nil)
	}

	var usage *einoSchema.TokenUsage
	if resp.ResponseMeta != nil {
		usage = resp.ResponseMeta.Usage
	}
	logn.Debug("llm generate done",
		TaskLogFields(ctx, "llm_done",
			zap.String("model", c.config.API.Model),
			zap.Int64("llm_elapsed_ms", time.Since(startedAt).Milliseconds()),
			zap.Int("content_len", len(content)),
			zap.Any("usage", usage),
		)...,
	)

	return &LLMResponse{
		Content: content,
		Usage:   usage,
	}, nil
}

func newOpenAIChatModel(cfg *config.LLMConf, timeout time.Duration, responseFormat *einoOpenAI.ChatCompletionResponseFormat) (einoModel.BaseChatModel, error) {
	return einoOpenAI.NewChatModel(context.Background(), &einoOpenAI.ChatModelConfig{
		APIKey:         cfg.API.Key,
		BaseURL:        strings.TrimRight(cfg.API.Endpoint, "/"),
		Model:          cfg.API.Model,
		Timeout:        timeout,
		ResponseFormat: responseFormat,
	})
}

func buildSummaryResponseFormat() *einoOpenAI.ChatCompletionResponseFormat {
	stringArray := func(description string) *jsonschema.Schema {
		return &jsonschema.Schema{
			Type:        string(einoSchema.Array),
			Description: description,
			Items: &jsonschema.Schema{
				Type: string(einoSchema.String),
			},
		}
	}

	return &einoOpenAI.ChatCompletionResponseFormat{
		Type: einoOpenAI.ChatCompletionResponseFormatTypeJSONSchema,
		JSONSchema: &einoOpenAI.ChatCompletionResponseFormatJSONSchema{
			Name:        "chapter_summary",
			Description: "structured chapter summary for long-form novel to screenplay conversion",
			Strict:      false,
			JSONSchema: &jsonschema.Schema{
				Type: string(einoSchema.Object),
				Properties: orderedmap.New[string, *jsonschema.Schema](
					orderedmap.WithInitialData(
						orderedmap.Pair[string, *jsonschema.Schema]{
							Key: "chapter_title",
							Value: &jsonschema.Schema{
								Type:        string(einoSchema.String),
								Description: "chapter title",
							},
						},
						orderedmap.Pair[string, *jsonschema.Schema]{
							Key:   "characters",
							Value: stringArray("key characters"),
						},
						orderedmap.Pair[string, *jsonschema.Schema]{
							Key:   "locations",
							Value: stringArray("key locations"),
						},
						orderedmap.Pair[string, *jsonschema.Schema]{
							Key:   "plot_points",
							Value: stringArray("key events and plot points"),
						},
						orderedmap.Pair[string, *jsonschema.Schema]{
							Key:   "conflicts",
							Value: stringArray("key conflicts"),
						},
						orderedmap.Pair[string, *jsonschema.Schema]{
							Key:   "foreshadowing",
							Value: stringArray("foreshadowing clues"),
						},
						orderedmap.Pair[string, *jsonschema.Schema]{
							Key: "ending_state",
							Value: &jsonschema.Schema{
								Type:        string(einoSchema.String),
								Description: "chapter ending state",
							},
						},
					),
				),
			},
		},
	}
}

func (s *StructuredChapterSummary) normalize() {
	s.ChapterTitle = strings.TrimSpace(s.ChapterTitle)
	s.EndingState = strings.TrimSpace(s.EndingState)
	s.Characters = normalizeStringList(s.Characters)
	s.Locations = normalizeStringList(s.Locations)
	s.PlotPoints = normalizeStringList(s.PlotPoints)
	s.Conflicts = normalizeStringList(s.Conflicts)
	s.Foreshadow = normalizeStringList(s.Foreshadow)
}

func normalizeStringList(items []string) []string {
	normalized := make([]string, 0, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		normalized = append(normalized, item)
	}
	return normalized
}
