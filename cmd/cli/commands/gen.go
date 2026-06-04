package commands

import (
	"github.com/spf13/cobra"
)

// NewGenCmd 创建 gen 命令
func NewGenCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "gen",
		Short: "代码生成相关命令",
		Long:  "从 DDL 生成代码或从代码生成 API 文件",
	}

	// 注册子命令
	cmd.AddCommand(newAllCmd())
	cmd.AddCommand(newAPICmd())

	return cmd
}
