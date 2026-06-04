package codegen

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// EnsureRouterFile 确保版本路由文件存在，如果不存在则创建
func EnsureRouterFile(routerPath string, apiVersion string) error {
	// 检查文件是否存在
	if _, err := os.Stat(routerPath); err == nil {
		// 文件已存在，无需创建
		return nil
	}

	// 确保目录存在
	dir := filepath.Dir(routerPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("创建目录失败: %w", err)
	}

	// 生成函数名：RegisterV1, RegisterV2, etc.
	registerFuncName := "Register" + strings.ToUpper(apiVersion[:1]) + apiVersion[1:]

	// 生成初始路由文件内容
	content := fmt.Sprintf(`package %s

import (
	"github.com/gin-gonic/gin"

	"scene-script/internal/handler/auth"
	"scene-script/internal/handler/ping"
	"scene-script/internal/middleware"
	"scene-script/internal/svc"
)

// %s - Register %s routes
func %s(r *gin.Engine, svc *svc.ServiceContext) {
	// Health check
	r.GET("/ping", ping.PingHandler(svc))

	// API %s route group
	%s := r.Group("/api/%s")
	{
		%s.POST("/login", auth.LoginHandler(svc))
		%s.POST("/refresh", auth.RefreshHandler(svc))

		// Protected routes (auth required)
		protected := %s.Group("")
		protected.Use(middleware.AuthMiddleware(svc))
		{
			// Auth routes
			protected.POST("/logout", auth.LogoutHandler(svc))
		}
	}
}
`, apiVersion, registerFuncName, apiVersion, registerFuncName, apiVersion, apiVersion, apiVersion, apiVersion, apiVersion, apiVersion)

	// 写入文件
	if err := os.WriteFile(routerPath, []byte(content), 0644); err != nil {
		return fmt.Errorf("写入文件失败: %w", err)
	}

	fmt.Printf("✅ Created %s/%s.go\n", apiVersion, apiVersion)
	return nil
}
