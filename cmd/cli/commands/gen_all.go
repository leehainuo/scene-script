package commands

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"scene-script/cmd/cli/internal/astutil"
	"scene-script/cmd/cli/internal/codegen"
	"scene-script/cmd/cli/internal/parser"
)

// newAllCmd 创建 generate all 子命令
func newAllCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "all",
		Short: "从 DDL 生成全套代码",
		Long:  "解析 DDL SQL 文件，生成完整的 CRUD 代码（Types/Handler/Logic）",
		RunE:  runAll,
	}

	cmd.Flags().String("src", "", "DDL SQL 文件路径（必需）")
	cmd.Flags().StringP("output", "o", ".", "代码输出目录")
	cmd.Flags().String("prefix", "", "表名前缀（例如：sys_, t_, tb_），如不指定则自动识别")
	cmd.Flags().String("version", "v1", "API 版本（v1, v2, v3...）")
	cmd.MarkFlagRequired("src")

	return cmd
}

func runAll(cmd *cobra.Command, args []string) error {
	ddlPath, _ := cmd.Flags().GetString("src")
	outputDir, _ := cmd.Flags().GetString("output")
	tablePrefix, _ := cmd.Flags().GetString("prefix")
	apiVersion, _ := cmd.Flags().GetString("version")

	fmt.Println("🚀 Starting code generation from DDL...")
	fmt.Println()

	// 1. 解析 DDL
	fmt.Println("📖 Parsing DDL file...")
	tables, err := parser.ParseDDLFile(ddlPath)
	if err != nil {
		return fmt.Errorf("解析 DDL 失败: %w", err)
	}

	fmt.Printf("✅ Found %d tables\n", len(tables))
	for _, table := range tables {
		fmt.Printf("   - %s (%d columns)\n", table.Name, len(table.Columns))
	}
	fmt.Println()

	// 2. 生成代码
	gen := codegen.NewCodeGenerator(tables, tablePrefix)

	// 2.1 生成 Types
	fmt.Println("📝 Generating Types...")
	typesFiles := gen.GenerateTypes()
	typesDir := filepath.Join(outputDir, "internal/types")
	os.MkdirAll(typesDir, 0755)
	for filename, content := range typesFiles {
		path := filepath.Join(typesDir, filename)
		if err := astutil.WriteFile(path, content, false); err != nil {
			fmt.Printf("❌ Failed to write %s: %v\n", filename, err)
			continue
		}
	}
	fmt.Println()

	// 2.2 生成 Handlers
	fmt.Println("📝 Generating Handlers...")
	handlerFiles := gen.GenerateHandlers()
	for _, table := range tables {
		moduleName := toModuleName(table.Name, tablePrefix)
		handlerDir := filepath.Join(outputDir, "internal/handler", moduleName)
		os.MkdirAll(handlerDir, 0755)

		for filename, content := range handlerFiles {
			if strings.Contains(filename, moduleName) {
				path := filepath.Join(handlerDir, filename)
				if err := astutil.WriteFile(path, content, false); err != nil {
					fmt.Printf("❌ Failed to write %s: %v\n", filename, err)
					continue
				}
			}
		}
	}
	fmt.Println()

	// 2.3 生成 Logics
	fmt.Println("📝 Generating Logics...")
	logicFiles := gen.GenerateLogics()
	for _, table := range tables {
		moduleName := toModuleName(table.Name, tablePrefix)
		logicDir := filepath.Join(outputDir, "internal/logic", moduleName)
		os.MkdirAll(logicDir, 0755)

		for filename, content := range logicFiles {
			if strings.Contains(filename, moduleName) {
				path := filepath.Join(logicDir, filename)
				if err := astutil.WriteFile(path, content, false); err != nil {
					fmt.Printf("❌ Failed to write %s: %v\n", filename, err)
					continue
				}
			}
		}
	}
	fmt.Println()

	// 2.4 生成 Models
	fmt.Println("📝 Generating Models...")
	modelFiles := gen.GenerateModels()
	modelDir := filepath.Join(outputDir, "internal/model")
	os.MkdirAll(modelDir, 0755)
	for filename, content := range modelFiles {
		path := filepath.Join(modelDir, filename)
		if err := astutil.WriteFile(path, content, false); err != nil {
			fmt.Printf("❌ Failed to write %s: %v\n", filename, err)
			continue
		}
	}
	fmt.Println()

	// 2.5 更新 svc (追加 Model 注册)
	fmt.Println("📝 Updating ServiceContext...")
	svcPath := filepath.Join(outputDir, "internal/svc/svc.go")
	if _, err := os.Stat(svcPath); err == nil {
		if err := codegen.UpdateServiceContext(svcPath, tables, tablePrefix); err != nil {
			fmt.Printf("⚠️  Failed to update svc: %v\n", err)
		} else {
			fmt.Println("✅ Updated ServiceContext")
		}
	} else {
		fmt.Println("⚠️  svc.go not found, skipping")
	}
	fmt.Println()

	// 2.6 更新 router (追加路由注册)
	fmt.Println("📝 Updating Router...")
	routerPath := filepath.Join(outputDir, "internal/router/api", apiVersion, apiVersion+".go")
	if err := codegen.EnsureRouterFile(routerPath, apiVersion); err != nil {
		fmt.Printf("⚠️  Failed to ensure router file: %v\n", err)
	} else {
		if err := codegen.UpdateRouter(routerPath, tables, apiVersion, tablePrefix); err != nil {
			fmt.Printf("⚠️  Failed to update router: %v\n", err)
		} else {
			fmt.Println("✅ Updated Router")
		}
	}

	// 2.7 确保版本在主 router.go 中注册
	mainRouterPath := filepath.Join(outputDir, "internal/router/router.go")
	if err := codegen.EnsureVersionRegistered(mainRouterPath, apiVersion); err != nil {
		fmt.Printf("⚠️  Failed to register version in router.go: %v\n", err)
	} else {
		fmt.Printf("✅ Registered %s in router.go\n", apiVersion)
	}
	fmt.Println()

	// 3. 自动生成 .api 文件（只生成当前模块）
	fmt.Println("📝 Generating .api files...")
	handlerDirPath := filepath.Join(outputDir, "internal/handler")
	typesDirPath := filepath.Join(outputDir, "internal/types")
	routerDirPath := filepath.Join(outputDir, "internal/router")
	apiOutputDir := filepath.Join(outputDir, "api/desc", apiVersion)

	if err := generateAPIFiles(handlerDirPath, typesDirPath, routerDirPath, apiOutputDir, apiVersion, tables); err != nil {
		fmt.Printf("⚠️  Failed to generate API files: %v\n", err)
	} else {
		fmt.Println("✅ Generated API files")
	}
	fmt.Println()

	fmt.Println("🎉 Code generation completed!")
	fmt.Printf("📂 Output directory: %s\n", outputDir)

	return nil
}

// generateAPIFiles 生成 API 文件（只生成当前模块）
func generateAPIFiles(handlerDir, typesDir, routerDir, outputDir, apiVersion string, tables []parser.TableDef) error {
	// 提取当前生成的模块名列表
	currentModules := make(map[string]bool)
	for _, table := range tables {
		moduleName := toModuleName(table.Name, "")
		currentModules[moduleName] = true
	}

	// 1. 解析 Types（只解析当前模块）
	types := []parser.TypeDef{}
	for module := range currentModules {
		moduleTypesPath := filepath.Join(typesDir, module+".go")
		if _, err := os.Stat(moduleTypesPath); err == nil {
			moduleTypes, err := parser.ParseTypesDir(typesDir)
			if err == nil {
				// 过滤出当前模块的类型
				for _, t := range moduleTypes {
					if strings.Contains(strings.ToLower(t.Name), module) {
						types = append(types, t)
					}
				}
			}
		}
	}

	// 2. 解析 Handlers（只解析当前模块）
	handlers := []parser.HandlerDef{}
	for module := range currentModules {
		moduleHandlerPath := filepath.Join(handlerDir, module)
		if _, err := os.Stat(moduleHandlerPath); err == nil {
			allHandlers, err := parser.ParseHandlersDir(handlerDir)
			if err == nil {
				// 过滤出当前模块的 handlers
				for _, h := range allHandlers {
					if h.Group == module {
						handlers = append(handlers, h)
					}
				}
			}
		}
	}

	// 3. 解析 Routes（只解析当前版本的路由文件）
	versionRouterPath := filepath.Join(routerDir, "api", apiVersion, apiVersion+".go")
	routes := []parser.RouteDef{}

	if _, err := os.Stat(versionRouterPath); err == nil {
		versionRoutes, err := parser.ParseRouterFile(versionRouterPath)
		if err != nil {
			return fmt.Errorf("解析版本路由文件失败: %w", err)
		}
		routes = versionRoutes
	}

	// 过滤出当前模块的路由
	filteredRoutes := []parser.RouteDef{}
	for _, route := range routes {
		if currentModules[route.Group] {
			filteredRoutes = append(filteredRoutes, route)
		}
	}

	// 4. 生成 .api 文件
	apiGen := codegen.NewAPIGenerator(types, handlers, filteredRoutes, apiVersion)
	apiFiles, err := apiGen.Generate()
	if err != nil {
		return fmt.Errorf("生成 API 文件失败: %w", err)
	}

	// 5. 写入文件（只写入当前模块的 .api 文件）
	os.MkdirAll(outputDir, 0755)
	for filename, content := range apiFiles {
		moduleName := strings.TrimSuffix(filename, ".api")

		// 只写入当前模块的文件
		if !currentModules[moduleName] {
			continue
		}

		path := filepath.Join(outputDir, filename)
		if err := astutil.WriteFile(path, content, false); err != nil {
			return fmt.Errorf("写入 %s 失败: %w", filename, err)
		}
		fmt.Printf("✅ Created api/desc/%s/%s\n", apiVersion, filename)
		fmt.Printf("   ✅ Generated %s\n", filename)
	}

	return nil
}

func toModuleName(tableName string, customPrefix string) string {
	if tableName == "" {
		return ""
	}

	name := tableName

	// 如果指定了自定义前缀，优先使用
	if customPrefix != "" && strings.HasPrefix(name, customPrefix) {
		name = strings.TrimPrefix(name, customPrefix)
	} else {
		// 去除常见表前缀
		prefixes := []string{"sys_", "t_", "tb_", "tbl_"}
		for _, prefix := range prefixes {
			if strings.HasPrefix(name, prefix) {
				name = strings.TrimPrefix(name, prefix)
				break
			}
		}
	}

	// 去除复数后缀 s
	if strings.HasSuffix(name, "s") && !strings.HasSuffix(name, "ss") {
		name = strings.TrimSuffix(name, "s")
	}

	return name
}
