package logn

import (
	"context"
	"fmt"
	"os"
	"sync/atomic"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// LogConf - Log configuration
type LogConf struct {
	Level      string `mapstructure:"level"`       // debug, info, warn, error
	Format     string `mapstructure:"format"`      // json, console
	OutputPath string `mapstructure:"output_path"` // stdout, file path
}

var logger atomic.Value

const (
	levelDebug = "debug"
	levelInfo  = "info"
	levelWarn  = "warn"
	levelError = "error"

	formatJSON    = "json"
	formatConsole = "console"

	outputStdout = "stdout"

	callerSkip = 2
)

func Init(c LogConf) error {
	// Get encoder
	encoder := getEncoder(c.Format)

	// Get writer
	writer, err := getWriter(c.OutputPath)
	if err != nil {
		return fmt.Errorf("failed to get writer: %w", err)
	}

	// Get level
	level := getLevel(c.Level)

	// Create core
	core := zapcore.NewCore(encoder, writer, level)

	// Create logger
	logger.Store(zap.New(core, zap.AddCaller(), zap.AddCallerSkip(callerSkip)))

	return nil
}

// getEncoder returns a zapcore.Encoder based on the format string
func getEncoder(format string) zapcore.Encoder {
	// encoder config
	c := zapcore.EncoderConfig{
		TimeKey:        "time",
		LevelKey:       "level",
		NameKey:        "logger",
		CallerKey:      "caller",
		MessageKey:     "msg",
		StacktraceKey:  "stacktrace",
		LineEnding:     zapcore.DefaultLineEnding,
		EncodeLevel:    zapcore.LowercaseLevelEncoder,
		EncodeTime:     zapcore.ISO8601TimeEncoder,
		EncodeDuration: zapcore.SecondsDurationEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
	}

	switch format {
	case formatJSON:
		return zapcore.NewJSONEncoder(c)
	case formatConsole:
		return zapcore.NewConsoleEncoder(c)
	default:
		return zapcore.NewJSONEncoder(c)
	}
}

// getWriter returns a zapcore.WriteSyncer for the given output path
func getWriter(output string) (zapcore.WriteSyncer, error) {
	switch output {
	case outputStdout:
		return zapcore.AddSync(os.Stdout), nil
	default:
		// Treat as file path
		file, err := os.OpenFile(output, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
		if err != nil {
			return nil, fmt.Errorf("failed to open file: %w", err)
		}
		return zapcore.AddSync(file), nil
	}
}

// getLevel converts a string level to zapcore.Level
func getLevel(level string) zapcore.Level {
	switch level {
	case levelDebug:
		return zapcore.DebugLevel
	case levelInfo:
		return zapcore.InfoLevel
	case levelWarn:
		return zapcore.WarnLevel
	case levelError:
		return zapcore.ErrorLevel
	default:
		return zapcore.InfoLevel
	}
}

// -- Global utility functions.

// Info
func Info(msg string, fields ...zap.Field) {
	getLogger().Info(msg, fields...)
}

// Warn
func Warn(msg string, fields ...zap.Field) {
	getLogger().Warn(msg, fields...)
}

// Error
func Error(msg string, fields ...zap.Field) {
	getLogger().Error(msg, fields...)
}

// Debug
func Debug(msg string, fields ...zap.Field) {
	getLogger().Debug(msg, fields...)
}

func getLogger() *zap.Logger {
	return logger.Load().(*zap.Logger)
}

// Logger is a logger that can be used with context
type Logger struct {
	logger *zap.Logger
	ctx    context.Context
}

const (
	TraceIDKey = "trace_id"
	SpanIDKey  = "span_id"
)

// WithContext creates a new logger with the given context
func WithContext(ctx context.Context) *Logger {
	return &Logger{
		logger: getLogger(),
		ctx:    ctx,
	}
}

// Info
func (l *Logger) Info(msg string, fields ...zap.Field) {
	l.logger.Info(msg, append(l.contextFields(), fields...)...)
}

// Debug
func (l *Logger) Debug(msg string, fields ...zap.Field) {
	l.logger.Debug(msg, append(l.contextFields(), fields...)...)
}

// Warn
func (l *Logger) Warn(msg string, fields ...zap.Field) {
	l.logger.Warn(msg, append(l.contextFields(), fields...)...)
}

// Error
func (l *Logger) Error(msg string, fields ...zap.Field) {
	l.logger.Error(msg, append(l.contextFields(), fields...)...)
}

// contextFields extracts trace_id and span_id from context
func (l *Logger) contextFields() []zap.Field {
	if l.ctx == nil {
		return nil
	}

	var fields []zap.Field

	// trace_id
	if traceID, ok := l.ctx.Value(TraceIDKey).(string); ok && traceID != "" {
		fields = append(fields, zap.String("trace", traceID))
	}

	// span_id
	if spanID, ok := l.ctx.Value(SpanIDKey).(string); ok && spanID != "" {
		fields = append(fields, zap.String("span", spanID))
	}

	return fields
}
