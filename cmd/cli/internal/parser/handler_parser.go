package parser

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
)

// HandlerDef Handler 定义
type HandlerDef struct {
	Name        string
	Comment     string
	Package     string
	Group       string // 从包名推断，如 auth, user
	RequestType string
	LogicType   string
	LogicMethod string
	FilePath    string
}

// ParseHandlerFile 解析单个 handler 文件
func ParseHandlerFile(filepath string) ([]HandlerDef, error) {
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, filepath, nil, parser.ParseComments)
	if err != nil {
		return nil, err
	}

	var handlers []HandlerDef

	for _, decl := range node.Decls {
		funcDecl, ok := decl.(*ast.FuncDecl)
		if !ok {
			continue
		}

		// 检查是否是 Handler 函数（返回 gin.HandlerFunc）
		if !isHandlerFunc(funcDecl) {
			continue
		}

		handler := HandlerDef{
			Name:     funcDecl.Name.Name,
			Comment:  extractComment(funcDecl.Doc),
			Package:  node.Name.Name,
			Group:    node.Name.Name, // 包名就是 group
			FilePath: filepath,
		}

		// 解析函数体，提取 req 类型和 logic 调用
		ast.Inspect(funcDecl.Body, func(n ast.Node) bool {
			// 查找 var req types.XXX
			if valueSpec, ok := n.(*ast.ValueSpec); ok {
				if len(valueSpec.Names) > 0 && valueSpec.Names[0].Name == "req" {
					handler.RequestType = exprToString(valueSpec.Type)
					// 移除 types. 前缀
					handler.RequestType = strings.TrimPrefix(handler.RequestType, "types.")
				}
			}

			// 查找 l := xxx.NewXXXLogic(...)
			if assignStmt, ok := n.(*ast.AssignStmt); ok {
				if len(assignStmt.Rhs) > 0 {
					if callExpr, ok := assignStmt.Rhs[0].(*ast.CallExpr); ok {
						if selExpr, ok := callExpr.Fun.(*ast.SelectorExpr); ok {
							if strings.HasPrefix(selExpr.Sel.Name, "New") && strings.HasSuffix(selExpr.Sel.Name, "Logic") {
								handler.LogicType = selExpr.Sel.Name
							}
						}
					}
				}
			}

			// 查找 l.XXX(&req) 获取 Logic 方法名
			if callExpr, ok := n.(*ast.CallExpr); ok {
				if selExpr, ok := callExpr.Fun.(*ast.SelectorExpr); ok {
					if ident, ok := selExpr.X.(*ast.Ident); ok && ident.Name == "l" {
						handler.LogicMethod = selExpr.Sel.Name
					}
				}
			}

			return true
		})

		handlers = append(handlers, handler)
	}

	return handlers, nil
}

// ParseHandlersDir 解析整个 handlers 目录
func ParseHandlersDir(dir string) ([]HandlerDef, error) {
	var allHandlers []HandlerDef

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// 跳过 router.go
		if strings.HasSuffix(path, "router.go") {
			return nil
		}

		// 只处理 .go 文件
		if info.IsDir() || !strings.HasSuffix(path, ".go") {
			return nil
		}

		handlers, err := ParseHandlerFile(path)
		if err != nil {
			return err
		}

		allHandlers = append(allHandlers, handlers...)
		return nil
	})

	return allHandlers, err
}
