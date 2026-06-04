package config

import (
	"fmt"

	"scene-script/pkg/logn"
	"scene-script/pkg/stores/redis"
	"scene-script/pkg/stores/sqlx"
	"scene-script/pkg/token"

	"github.com/spf13/viper"
)

// Config - Configuration
type Config struct {
	App    AppConf         `mapstructure:"scene_script"`
	Server ServerConf      `mapstructure:"server"`
	MySQL  sqlx.MySQLConf  `mapstructure:"mysql"`
	Redis  redis.RedisConf `mapstructure:"redis"`
	JWT    token.JWTConf   `mapstructure:"jwt"`
	Log    logn.LogConf    `mapstructure:"log"`
	LLM    LLMConf         `mapstructure:"llm"`
}

// LLMConf - LLM configuration for Qwen OpenAPI
type LLMConf struct {
	API    LLMAPIConf    `mapstructure:"api"`
	Prompt LLMPromptConf `mapstructure:"prompt"`
}

// LLMAPIConf - LLM API configuration
type LLMAPIConf struct {
	Key            string  `mapstructure:"key"`
	Endpoint       string  `mapstructure:"endpoint"`
	Model          string  `mapstructure:"model"`
	TimeoutSeconds int     `mapstructure:"timeout_seconds"`
	MaxTokens      int     `mapstructure:"max_tokens"`
	TopP           float32 `mapstructure:"top_p"`
	Temperature    float32 `mapstructure:"temperature"`
}

// LLMPromptConf - LLM prompt configuration
type LLMPromptConf struct {
	System            string `mapstructure:"system"`
	Template          string `mapstructure:"template"`
	RepairSystem      string `mapstructure:"repair_system"`
	RepairTemplate    string `mapstructure:"repair_template"`
	MaxRepairAttempts int    `mapstructure:"max_repair_attempts"`
}

// AppConf - Application configuration
type AppConf struct {
	Name string `mapstructure:"name"`
	Env  string `mapstructure:"env"`
}

// ServerConf - Server configuration
type ServerConf struct {
	Host         string `mapstructure:"host"`
	Port         int    `mapstructure:"port"`
	ReadTimeout  int    `mapstructure:"read_timeout"`
	WriteTimeout int    `mapstructure:"write_timeout"`
}

// ConfigType - Configuration file type
const ConfigType = "yaml"

// Init - Initialize configuration
func Init(path string) (*Config, error) {
	v := viper.New()
	v.SetConfigFile(path)
	v.SetConfigType(ConfigType)

	// Read config file - Option
	if err := v.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	// Enable environment variable override
	v.AutomaticEnv()

	// Unmarshal config
	c := &Config{}
	if err := v.Unmarshal(c); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return c, nil
}
