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

	"golang.org/x/text/cases"
	"golang.org/x/text/language"
)

// UpdateRouter 更新 router/api/{version}/{version}.go 文件，追加新的路由
func UpdateRouter(routerPath string, tables []parser.TableDef, apiVersion string, customPrefix string) error {
	// 读取现有文件
	fset := token.NewFileSet()
	node, err := goparser.ParseFile(fset, routerPath, nil, goparser.ParseComments)
	if err != nil {
		return fmt.Errorf("解析 router 文件失败: %w", err)
	}

	// 计算 Register 函数名 (RegisterV1, RegisterV2, etc.)
	registerFuncName := "Register" + strings.ToUpper(apiVersion[:1]) + apiVersion[1:]

	// 遍历表，添加路由
	for _, table := range tables {
		moduleName := toModuleName(table.Name, customPrefix)
		entityName := parser.ToCamelCase(moduleName)

		// 检查是否已存在
		if hasRouteFunction(node, moduleName) {
			continue
		}

		// 1. 添加 import
		addImportIfNeeded(node, "scene-script/internal/handler/"+moduleName)

		// 2. 在 Register 函数中调用注册函数
		addRouteCall(node, moduleName, registerFuncName, apiVersion)

		// 3. 添加 register{Module}Routes 函数
		addRouteFunction(node, moduleName, entityName)
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

	// 手动确保函数之间有空行
	formattedStr := string(formatted)
	formattedStr = strings.ReplaceAll(formattedStr, "}\nfunc register", "}\n\nfunc register")

	return os.WriteFile(routerPath, []byte(formattedStr), 0644)
}

// hasRouteFunction 检查是否已有路由注册函数
func hasRouteFunction(node *ast.File, moduleName string) bool {
	funcName := "register" + toTitle(moduleName) + "Routes"
	for _, decl := range node.Decls {
		funcDecl, ok := decl.(*ast.FuncDecl)
		if !ok {
			continue
		}
		if funcDecl.Name.Name == funcName {
			return true
		}
	}
	return false
}

// addRouteCall 在 Register 函数中添加路由调用
func addRouteCall(node *ast.File, moduleName, registerFuncName, apiVersion string) {
	funcName := "register" + toTitle(moduleName) + "Routes"

	for _, decl := range node.Decls {
		funcDecl, ok := decl.(*ast.FuncDecl)
		if !ok || funcDecl.Name.Name != registerFuncName {
			continue
		}

		// 遍历函数体，找到路由组的 BlockStmt
		for _, stmt := range funcDecl.Body.List {
			// 查找 v1 := r.Group("/api/v1") 后面的 BlockStmt
			if blockStmt, ok := stmt.(*ast.BlockStmt); ok {
				// 检查是否已经添加过这个函数调用
				for _, s := range blockStmt.List {
					if exprStmt, ok := s.(*ast.ExprStmt); ok {
						if callExpr, ok := exprStmt.X.(*ast.CallExpr); ok {
							if ident, ok := callExpr.Fun.(*ast.Ident); ok && ident.Name == funcName {
								return
							}
						}
					}
				}

				// 生成调用：registerRoleRoutes(v1, svc)
				newCall := &ast.ExprStmt{
					X: &ast.CallExpr{
						Fun: ast.NewIdent(funcName),
						Args: []ast.Expr{
							ast.NewIdent(apiVersion),
							ast.NewIdent("svc"),
						},
					},
				}

				blockStmt.List = append([]ast.Stmt{newCall}, blockStmt.List...)
				return
			}
		}
	}
}

func toTitle(s string) string {
	return cases.Title(language.Und).String(s)
}

// addRouteFunction 添加路由注册函数
func addRouteFunction(node *ast.File, moduleName, entityName string) {
	funcName := "register" + toTitle(moduleName) + "Routes"
	pluralName := moduleName + "s"
	routePath := "/" + pluralName

	// 创建函数
	newFunc := &ast.FuncDecl{
		Name: ast.NewIdent(funcName),
		Type: &ast.FuncType{
			Params: &ast.FieldList{
				List: []*ast.Field{
					{
						Names: []*ast.Ident{ast.NewIdent("r")},
						Type: &ast.StarExpr{
							X: &ast.SelectorExpr{
								X:   ast.NewIdent("gin"),
								Sel: ast.NewIdent("RouterGroup"),
							},
						},
					},
					{
						Names: []*ast.Ident{ast.NewIdent("svc")},
						Type: &ast.StarExpr{
							X: &ast.SelectorExpr{
								X:   ast.NewIdent("svc"),
								Sel: ast.NewIdent("ServiceContext"),
							},
						},
					},
				},
			},
		},
		Body: &ast.BlockStmt{
			List: []ast.Stmt{
				// {moduleName}s := r.Group("/{moduleName}s")
				&ast.AssignStmt{
					Lhs: []ast.Expr{ast.NewIdent(pluralName)},
					Tok: token.DEFINE,
					Rhs: []ast.Expr{
						&ast.CallExpr{
							Fun: &ast.SelectorExpr{
								X:   ast.NewIdent("r"),
								Sel: ast.NewIdent("Group"),
							},
							Args: []ast.Expr{
								&ast.BasicLit{
									Kind:  token.STRING,
									Value: `"` + routePath + `"`,
								},
							},
						},
					},
				},
				// Block with CRUD routes
				&ast.BlockStmt{
					List: []ast.Stmt{
						// POST
						&ast.ExprStmt{
							X: &ast.CallExpr{
								Fun: &ast.SelectorExpr{
									X:   ast.NewIdent(pluralName),
									Sel: ast.NewIdent("POST"),
								},
								Args: []ast.Expr{
									&ast.BasicLit{Kind: token.STRING, Value: `""`},
									&ast.CallExpr{
										Fun: &ast.SelectorExpr{
											X:   ast.NewIdent(moduleName),
											Sel: ast.NewIdent("Create" + entityName + "Handler"),
										},
										Args: []ast.Expr{ast.NewIdent("svc")},
									},
								},
							},
						},
						// GET
						&ast.ExprStmt{
							X: &ast.CallExpr{
								Fun: &ast.SelectorExpr{
									X:   ast.NewIdent(pluralName),
									Sel: ast.NewIdent("GET"),
								},
								Args: []ast.Expr{
									&ast.BasicLit{Kind: token.STRING, Value: `"/:id"`},
									&ast.CallExpr{
										Fun: &ast.SelectorExpr{
											X:   ast.NewIdent(moduleName),
											Sel: ast.NewIdent("Get" + entityName + "Handler"),
										},
										Args: []ast.Expr{ast.NewIdent("svc")},
									},
								},
							},
						},
						// PUT
						&ast.ExprStmt{
							X: &ast.CallExpr{
								Fun: &ast.SelectorExpr{
									X:   ast.NewIdent(pluralName),
									Sel: ast.NewIdent("PUT"),
								},
								Args: []ast.Expr{
									&ast.BasicLit{Kind: token.STRING, Value: `"/:id"`},
									&ast.CallExpr{
										Fun: &ast.SelectorExpr{
											X:   ast.NewIdent(moduleName),
											Sel: ast.NewIdent("Update" + entityName + "Handler"),
										},
										Args: []ast.Expr{ast.NewIdent("svc")},
									},
								},
							},
						},
						// DELETE
						&ast.ExprStmt{
							X: &ast.CallExpr{
								Fun: &ast.SelectorExpr{
									X:   ast.NewIdent(pluralName),
									Sel: ast.NewIdent("DELETE"),
								},
								Args: []ast.Expr{
									&ast.BasicLit{Kind: token.STRING, Value: `"/:id"`},
									&ast.CallExpr{
										Fun: &ast.SelectorExpr{
											X:   ast.NewIdent(moduleName),
											Sel: ast.NewIdent("Delete" + entityName + "Handler"),
										},
										Args: []ast.Expr{ast.NewIdent("svc")},
									},
								},
							},
						},
					},
				},
			},
		},
	}

	// 在函数前添加空行（通过在 Decls 之间留空实现）
	node.Decls = append(node.Decls, newFunc)
}
