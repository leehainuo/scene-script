package commands

import (
	"fmt"

	"github.com/spf13/cobra"

	"scene-script/pkg/utils/crypton"
)

// NewHashPasswordCmd 创建生成密码哈希的命令
func NewHashPasswordCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "hashpass [password]",
		Short: "生成密码的 bcrypt 哈希",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			password := args[0]
			hash, err := crypton.HashPassword(password)
			if err != nil {
				fmt.Printf("❌ 生成失败: %v\n", err)
				return
			}
			fmt.Printf("✅ 密码: %s\n", password)
			fmt.Printf("✅ 哈希: %s\n", hash)
			fmt.Printf("\n📋 SQL 更新语句:\n")
			fmt.Printf("UPDATE sys_user SET password = '%s' WHERE username = 'admin';\n", hash)
		},
	}
}
