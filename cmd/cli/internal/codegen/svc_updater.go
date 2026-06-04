package codegen

import (
	"bytes"
	"fmt"
	"go/ast"
	"go/format"
	goparser "go/parser"
	"go/printer"
	"go/token"
	"os"
	"strings"

	"scene-script/cmd/cli/internal/parser"
)

// UpdateServiceContext 更新 svc.go 文件，追加新的 Model
func UpdateServiceContext(svcPath string, tables []parser.TableDef) error {
	// 读取现有文件
	fset := token.NewFileSet()
	node, err := goparser.ParseFile(fset, svcPath, nil, goparser.ParseComments)
	if err != nil {
		return fmt.Errorf("解析 svc 文件失败: %w", err)
	}

	// 遍历表，添加 Model
	for _, table := range tables {
		moduleName := toModuleName(table.Name)
		entityName := parser.ToCamelCase(moduleName)
		modelName := entityName + "Model"

		// 检查是否已存在
		if hasModelField(node, modelName) {
			continue
		}

		// 1. 添加 import
		addImportIfNeeded(node, "scene-script/internal/model")

		// 2. 在 ServiceContext 结构体中添加字段
		addModelField(node, modelName)

		// 3. 在 NewServiceContext 函数中添加初始化
		addModelInit(node, modelName, entityName)
	}

	// 写回文件
	var buf bytes.Buffer
	if err := printer.Fprint(&buf, fset, node); err != nil {
		return err
	}

	// 使用 format.Source 格式化
	formatted, err := format.Source(buf.Bytes())
	if err != nil {
		return err
	}

	formattedStr := string(formatted)
	formattedStr = strings.ReplaceAll(formattedStr, "conn), ", "conn),\n\t\t")

	return os.WriteFile(svcPath, []byte(formattedStr), 0644)
}

// hasModelField 检查是否已有该 Model 字段
func hasModelField(node *ast.File, modelName string) bool {
	for _, decl := range node.Decls {
		genDecl, ok := decl.(*ast.GenDecl)
		if !ok || genDecl.Tok != token.TYPE {
			continue
		}

		for _, spec := range genDecl.Specs {
			typeSpec, ok := spec.(*ast.TypeSpec)
			if !ok || typeSpec.Name.Name != "ServiceContext" {
				continue
			}

			structType, ok := typeSpec.Type.(*ast.StructType)
			if !ok {
				continue
			}

			for _, field := range structType.Fields.List {
				for _, name := range field.Names {
					if name.Name == modelName {
						return true
					}
				}
			}
		}
	}
	return false
}

// addImportIfNeeded 添加 import（如果不存在）
func addImportIfNeeded(node *ast.File, importPath string) {
	importValue := `"` + importPath + `"`

	// 检查是否已存在
	for _, imp := range node.Imports {
		if imp.Path.Value == importValue {
			return
		}
	}

	// 找到 import 声明
	for _, decl := range node.Decls {
		genDecl, ok := decl.(*ast.GenDecl)
		if !ok || genDecl.Tok != token.IMPORT {
			continue
		}

		// 添加新的 import spec
		newSpec := &ast.ImportSpec{
			Path: &ast.BasicLit{
				Kind:  token.STRING,
				Value: importValue,
			},
		}
		genDecl.Specs = append(genDecl.Specs, newSpec)
		node.Imports = append(node.Imports, newSpec)
		return
	}
}

// addModelField 在 ServiceContext 中添加 Model 字段
func addModelField(node *ast.File, modelName string) {
	for _, decl := range node.Decls {
		genDecl, ok := decl.(*ast.GenDecl)
		if !ok || genDecl.Tok != token.TYPE {
			continue
		}

		for _, spec := range genDecl.Specs {
			typeSpec, ok := spec.(*ast.TypeSpec)
			if !ok || typeSpec.Name.Name != "ServiceContext" {
				continue
			}

			structType, ok := typeSpec.Type.(*ast.StructType)
			if !ok {
				continue
			}

			// 添加字段到 Models 注释之后
			newField := &ast.Field{
				Names: []*ast.Ident{ast.NewIdent(modelName)},
				Type: &ast.SelectorExpr{
					X:   ast.NewIdent("model"),
					Sel: ast.NewIdent(modelName),
				},
			}

			structType.Fields.List = append(structType.Fields.List, newField)
			return
		}
	}
}

// addModelInit 在 NewServiceContext 中添加 Model 初始化
func addModelInit(node *ast.File, modelName, entityName string) {
	for _, decl := range node.Decls {
		funcDecl, ok := decl.(*ast.FuncDecl)
		if !ok || funcDecl.Name.Name != "NewServiceContext" {
			continue
		}

		// 找到 return 语句
		ast.Inspect(funcDecl.Body, func(n ast.Node) bool {
			returnStmt, ok := n.(*ast.ReturnStmt)
			if !ok || len(returnStmt.Results) == 0 {
				return true
			}

			unaryExpr, ok := returnStmt.Results[0].(*ast.UnaryExpr)
			if !ok || unaryExpr.Op != token.AND {
				return true
			}

			compositeLit, ok := unaryExpr.X.(*ast.CompositeLit)
			if !ok {
				return true
			}

			// 检查 Elts 是否为空或最后一个元素是否已有逗号
			if len(compositeLit.Elts) > 0 {
				// 确保之前的元素有逗号分隔
				if lastElt, ok := compositeLit.Elts[len(compositeLit.Elts)-1].(*ast.KeyValueExpr); ok {
					_ = lastElt // 确保类型正确
				}
			}

			// 添加 Model 初始化
			newElt := &ast.KeyValueExpr{
				Key: ast.NewIdent(modelName),
				Value: &ast.CallExpr{
					Fun: &ast.SelectorExpr{
						X:   ast.NewIdent("model"),
						Sel: ast.NewIdent("New" + entityName + "Model"),
					},
					Args: []ast.Expr{ast.NewIdent("conn")},
				},
			}

			// 将新元素追加到 Elts 列表
			compositeLit.Elts = append(compositeLit.Elts, newElt)
			return false
		})
	}
}
