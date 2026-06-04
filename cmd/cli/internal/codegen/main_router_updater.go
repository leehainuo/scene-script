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
)

// EnsureVersionRegistered 确保版本在主 router.go 中注册
func EnsureVersionRegistered(routerFilePath string, apiVersion string) error {
	// 读取现有文件
	fset := token.NewFileSet()
	node, err := goparser.ParseFile(fset, routerFilePath, nil, goparser.ParseComments)
	if err != nil {
		return fmt.Errorf("解析 router.go 失败: %w", err)
	}

	// 生成导入别名：v1, v2, etc.
	importAlias := apiVersion
	importPath := fmt.Sprintf("scene-script/internal/router/api/%s", apiVersion)

	// 生成注册函数调用：RegisterV1, RegisterV2, etc.
	registerFuncName := "Register" + strings.ToUpper(apiVersion[:1]) + apiVersion[1:]

	// 1. 检查并添加 import
	if !hasVersionImport(node, importPath) {
		addVersionImport(node, importAlias, importPath)
	}

	// 2. 检查并添加注册调用
	if !hasVersionRegisterCall(node, importAlias, registerFuncName) {
		addVersionRegisterCall(node, importAlias, registerFuncName)
	}

	// 写回文件
	var buf bytes.Buffer
	if err := printer.Fprint(&buf, fset, node); err != nil {
		return err
	}

	// 格式化
	formatted, err := format.Source(buf.Bytes())
	if err != nil {
		return err
	}

	return os.WriteFile(routerFilePath, formatted, 0644)
}

// hasVersionImport 检查是否已导入版本包
func hasVersionImport(node *ast.File, importPath string) bool {
	for _, imp := range node.Imports {
		if imp.Path != nil && strings.Trim(imp.Path.Value, `"`) == importPath {
			return true
		}
	}
	return false
}

// addVersionImport 添加版本包导入
func addVersionImport(node *ast.File, alias string, importPath string) {
	newImport := &ast.ImportSpec{
		Name: ast.NewIdent(alias),
		Path: &ast.BasicLit{
			Kind:  token.STRING,
			Value: fmt.Sprintf(`"%s"`, importPath),
		},
	}

	// 查找现有的 import 声明
	for _, decl := range node.Decls {
		genDecl, ok := decl.(*ast.GenDecl)
		if !ok || genDecl.Tok != token.IMPORT {
			continue
		}

		// 添加到现有 import 块
		genDecl.Specs = append(genDecl.Specs, newImport)
		return
	}

	// 如果没有 import 块，创建一个新的
	newGenDecl := &ast.GenDecl{
		Tok:   token.IMPORT,
		Specs: []ast.Spec{newImport},
	}
	node.Decls = append([]ast.Decl{newGenDecl}, node.Decls...)
}

// hasVersionRegisterCall 检查是否已有版本注册调用
func hasVersionRegisterCall(node *ast.File, alias string, funcName string) bool {
	for _, decl := range node.Decls {
		funcDecl, ok := decl.(*ast.FuncDecl)
		if !ok || funcDecl.Name.Name != "Setup" {
			continue
		}

		// 遍历函数体
		for _, stmt := range funcDecl.Body.List {
			exprStmt, ok := stmt.(*ast.ExprStmt)
			if !ok {
				continue
			}

			callExpr, ok := exprStmt.X.(*ast.CallExpr)
			if !ok {
				continue
			}

			selExpr, ok := callExpr.Fun.(*ast.SelectorExpr)
			if !ok {
				continue
			}

			ident, ok := selExpr.X.(*ast.Ident)
			if !ok {
				continue
			}

			// 检查是否是 v1.RegisterV1, v2.RegisterV2 等
			if ident.Name == alias && selExpr.Sel.Name == funcName {
				return true
			}
		}
	}
	return false
}

// addVersionRegisterCall 添加版本注册调用
func addVersionRegisterCall(node *ast.File, alias string, funcName string) {
	for _, decl := range node.Decls {
		funcDecl, ok := decl.(*ast.FuncDecl)
		if !ok || funcDecl.Name.Name != "Setup" {
			continue
		}

		// 创建新的调用语句：v1.RegisterV1(r, svc)
		newCall := &ast.ExprStmt{
			X: &ast.CallExpr{
				Fun: &ast.SelectorExpr{
					X:   ast.NewIdent(alias),
					Sel: ast.NewIdent(funcName),
				},
				Args: []ast.Expr{
					ast.NewIdent("r"),
					ast.NewIdent("svc"),
				},
			},
		}

		// 查找最后一个 Register 调用的位置
		lastRegisterIndex := -1
		for i, stmt := range funcDecl.Body.List {
			if exprStmt, ok := stmt.(*ast.ExprStmt); ok {
				if callExpr, ok := exprStmt.X.(*ast.CallExpr); ok {
					if selExpr, ok := callExpr.Fun.(*ast.SelectorExpr); ok {
						if strings.Contains(selExpr.Sel.Name, "Register") {
							// 找到 Register 调用
							lastRegisterIndex = i
						}
					}
				}
			}
		}

		// 在最后一个 Register 调用之后插入
		if lastRegisterIndex >= 0 {
			insertIndex := lastRegisterIndex + 1
			funcDecl.Body.List = append(
				funcDecl.Body.List[:insertIndex],
				append([]ast.Stmt{newCall}, funcDecl.Body.List[insertIndex:]...)...,
			)
		} else {
			// 如果没有找到 Register 调用，在 return 之前插入
			for i := len(funcDecl.Body.List) - 1; i >= 0; i-- {
				if _, ok := funcDecl.Body.List[i].(*ast.ReturnStmt); ok {
					funcDecl.Body.List = append(
						funcDecl.Body.List[:i],
						append([]ast.Stmt{newCall}, funcDecl.Body.List[i:]...)...,
					)
					break
				}
			}
		}

		return
	}
}
