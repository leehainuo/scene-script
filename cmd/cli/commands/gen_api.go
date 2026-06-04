package commands

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"scene-script/cmd/cli/internal/codegen"
	"scene-script/cmd/cli/internal/parser"
)

// newAPICmd 创建 reverse api 子命令
func newAPICmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "api",
		Short: "从现有代码生成 .api 文件",
		Long:  "解析 handler/types/router 代码，生成符合 goctl 规范的 .api 文件",
		RunE:  runAPI,
	}

	cmd.Flags().String("handler", "./internal/handler", "Handler 目录")
	cmd.Flags().String("types", "./internal/types", "Types 目录")
	cmd.Flags().String("router", "./internal/router", "Router 目录")
	cmd.Flags().StringP("output", "o", "./api/desc", "输出目录")
	cmd.Flags().String("version", "v1", "API 版本")
	cmd.Flags().String("module", "", "指定模块名（可选，如：product）")

	return cmd
}

func runAPI(cmd *cobra.Command, args []string) error {
	handlerDir, _ := cmd.Flags().GetString("handler")
	typesDir, _ := cmd.Flags().GetString("types")
	routerDir, _ := cmd.Flags().GetString("router")
	baseOutputDir, _ := cmd.Flags().GetString("output")
	apiVersion, _ := cmd.Flags().GetString("version")
	targetModule, _ := cmd.Flags().GetString("module")

	// 输出目录自动带版本
	outputDir := filepath.Join(baseOutputDir, apiVersion)

	fmt.Println("🚀 Starting reverse generation...")
	if targetModule != "" {
		fmt.Printf("🎯 Target module: %s\n", targetModule)
	}
	fmt.Println()

	// 1. 解析 Routes（从路由文件提取实际注册的模块）
	fmt.Println("📖 Parsing routes...")
	versionRouterPath := filepath.Join(routerDir, "api", apiVersion, apiVersion+".go")
	routes := []parser.RouteDef{}

	if _, err := os.Stat(versionRouterPath); err == nil {
		versionRoutes, err := parser.ParseRouterFile(versionRouterPath)
		if err != nil {
			return fmt.Errorf("解析版本路由文件失败: %w", err)
		}
		routes = versionRoutes
	} else {
		return fmt.Errorf("版本路由文件不存在: %s", versionRouterPath)
	}
	fmt.Printf("✅ Found %d routes\n", len(routes))

	// 提取路由中实际使用的模块
	routeModules := make(map[string]bool)
	for _, route := range routes {
		if route.Group != "" {
			routeModules[route.Group] = true
		}
	}

	// 如果指定了模块，验证该模块是否存在于路由中
	if targetModule != "" {
		if !routeModules[targetModule] {
			return fmt.Errorf("模块 '%s' 未在 %s 中注册", targetModule, versionRouterPath)
		}
		// 只保留指定模块
		routeModules = map[string]bool{targetModule: true}
	}

	fmt.Printf("📋 Modules in %s: %v\n", apiVersion, getKeys(routeModules))
	fmt.Println()

	// 2. 解析 Handlers（只解析路由中使用的模块）
	fmt.Println("📖 Parsing handlers...")
	allHandlers, err := parser.ParseHandlersDir(handlerDir)
	if err != nil {
		return fmt.Errorf("解析 Handlers 失败: %w", err)
	}

	// 只保留路由中使用的模块的 handlers
	handlers := []parser.HandlerDef{}
	for _, h := range allHandlers {
		if routeModules[h.Group] {
			handlers = append(handlers, h)
		}
	}
	fmt.Printf("✅ Found %d handlers (from %d modules)\n", len(handlers), len(routeModules))

	// 3. 解析 Types（从 handlers 提取实际使用的类型）
	fmt.Println("📖 Parsing types...")
	allTypes, err := parser.ParseTypesDir(typesDir)
	if err != nil {
		return fmt.Errorf("解析 Types 失败: %w", err)
	}

	// 从 handlers 中提取实际使用的类型名
	usedTypes := make(map[string]bool)
	for _, h := range handlers {
		if h.RequestType != "" {
			usedTypes[h.RequestType] = true
		}
	}

	// 只保留 handlers 实际使用的 types
	types := []parser.TypeDef{}
	for _, t := range allTypes {
		if usedTypes[t.Name] {
			types = append(types, t)
		}
	}
	fmt.Printf("✅ Found %d types (used by handlers)\n", len(types))
	fmt.Println()

	// 4. 生成 .api 文件
	fmt.Println("📝 Generating .api files...")
	gen := codegen.NewAPIGenerator(types, handlers, routes, apiVersion)
	apiFiles, err := gen.Generate()
	if err != nil {
		return fmt.Errorf("生成 .api 文件失败: %w", err)
	}

	// 5. 写入文件（只写入路由中注册的模块）
	os.MkdirAll(outputDir, 0755)
	for filename, content := range apiFiles {
		moduleName := strings.TrimSuffix(filename, ".api")

		// 只写入路由中注册的模块
		if !routeModules[moduleName] {
			continue
		}

		filePath := filepath.Join(outputDir, filename)
		if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
			fmt.Printf("❌ Failed to write %s: %v\n", filename, err)
			continue
		}
		fmt.Printf("✅ Generated %s\n", filePath)
	}

	fmt.Println()
	fmt.Println("🎉 Reverse generation completed!")
	fmt.Printf("📂 Output directory: %s\n", outputDir)

	return nil
}

// getKeys - Get all keys from map
func getKeys(m map[string]bool) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}
