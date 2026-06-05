package service

import (
	"context"
	"time"

	"go.uber.org/zap"
)

type taskLogContextKey struct{}

type taskLogMeta struct {
	TaskID    string
	StartedAt time.Time
}

func WithTaskLogContext(ctx context.Context, taskID string, startedAt time.Time) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, taskLogContextKey{}, taskLogMeta{
		TaskID:    taskID,
		StartedAt: startedAt,
	})
}

func TaskLogFields(ctx context.Context, stage string, fields ...zap.Field) []zap.Field {
	base := make([]zap.Field, 0, len(fields)+3)

	if meta, ok := ctx.Value(taskLogContextKey{}).(taskLogMeta); ok {
		if meta.TaskID != "" {
			base = append(base, zap.String("task_id", meta.TaskID))
		}
		if !meta.StartedAt.IsZero() {
			base = append(base, zap.Int64("elapsed_ms", time.Since(meta.StartedAt).Milliseconds()))
		}
	}

	if stage != "" {
		base = append(base, zap.String("stage", stage))
	}

	base = append(base, fields...)
	return base
}
