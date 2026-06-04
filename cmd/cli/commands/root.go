package commands

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var version = "v0.1.0"

// NewRootCmd 创建根命令
func NewRootCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "scene-script",
		Short:   "Scene Script 项目代码生成器",
		Long:    "一站式代码生成工具：从 DDL 生成 Scene Script 项目的 CRUD 代码和 API 文件",
		Version: version,
	}

	return cmd
}

// Execute 执行命令
func Execute() {
	rootCmd := NewRootCmd()

	// 注册子命令
	rootCmd.AddCommand(NewGenCmd())
	rootCmd.AddCommand(NewHashPasswordCmd())

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
