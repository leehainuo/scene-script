package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	einoModel "github.com/cloudwego/eino/components/model"
	einoSchema "github.com/cloudwego/eino/schema"
	einoOpenAI "github.com/cloudwego/eino-ext/components/model/openai"
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

// LLMClient - Eino based OpenAI-compatible client for Qwen.
type LLMClient struct {
	config *config.LLMConf
	model  einoModel.BaseChatModel
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

	chatModel, err := einoOpenAI.NewChatModel(context.Background(), &einoOpenAI.ChatModelConfig{
		APIKey:  cfg.API.Key,
		BaseURL: strings.TrimRight(cfg.API.Endpoint, "/"),
		Model:   cfg.API.Model,
		Timeout: timeout,
	})
	if err != nil {
		return nil, fmt.Errorf("create eino chat model failed: %w", err)
	}

	return &LLMClient{
		config: cfg,
		model:  chatModel,
	}, nil
}

// GenerateScript - Generate YAML with Eino ChatModel over an OpenAI-compatible endpoint.
func (c *LLMClient) GenerateScript(ctx context.Context, systemPrompt, userPrompt string) (*LLMResponse, error) {
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

	resp, err := c.model.Generate(ctx, msgs, opts...)
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
