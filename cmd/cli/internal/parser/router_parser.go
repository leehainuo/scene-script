package parser

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
)

// RouteDef 路由定义
type RouteDef struct {
	Method     string   // POST, GET, PUT, DELETE
	Path       string   // /api/v1/login
	Handler    string   // LoginHandler
	Middleware []string // Auth, Cors 等
	Group      string   // auth, user
}

// ParseRouterFile 解析单个 router 文件
func ParseRouterFile(filepath string) ([]RouteDef, error) {
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, filepath, nil, parser.ParseComments)
	if err != nil {
		return nil, err
	}

	var routes []RouteDef
	currentMiddleware := []string{}
	pathPrefix := ""

	ast.Inspect(node, func(n ast.Node) bool {
		// 查找路由注册：v1.POST("/login", auth.LoginHandler(svc))
		// 或 users.POST("", user.CreateUserHandler(svc))
		if callExpr, ok := n.(*ast.CallExpr); ok {
			if selExpr, ok := callExpr.Fun.(*ast.SelectorExpr); ok {
				method := selExpr.Sel.Name

				// 检测路由组：users := rg.Group("/users")
				if method == "Group" && len(callExpr.Args) > 0 {
					if basicLit, ok := callExpr.Args[0].(*ast.BasicLit); ok {
						pathPrefix = strings.Trim(basicLit.Value, `"`)
					}
				}

				// 检查是否是 HTTP 方法
				if isHTTPMethod(method) && len(callExpr.Args) >= 2 {
					route := RouteDef{
						Method:     strings.ToUpper(method),
						Middleware: currentMiddleware,
					}

					// 提取路径
					path := ""
					if basicLit, ok := callExpr.Args[0].(*ast.BasicLit); ok {
						path = strings.Trim(basicLit.Value, `"`)
					}

					// 组合前缀和路径
					if pathPrefix != "" && path != "" {
						route.Path = pathPrefix + "/" + path
					} else if pathPrefix != "" {
						route.Path = pathPrefix
					} else {
						route.Path = path
					}

					// 清理路径
					route.Path = strings.ReplaceAll(route.Path, "//", "/")

					// 提取 Handler：auth.LoginHandler(svc)
					if handlerCall, ok := callExpr.Args[1].(*ast.CallExpr); ok {
						if selExpr, ok := handlerCall.Fun.(*ast.SelectorExpr); ok {
							route.Handler = selExpr.Sel.Name
							if ident, ok := selExpr.X.(*ast.Ident); ok {
								route.Group = ident.Name
							}
						}
					}

					routes = append(routes, route)
				}

				// 检测中间件：protected.Use(middleware.AuthMiddleware(svc))
				if method == "Use" && len(callExpr.Args) > 0 {
					if middlewareCall, ok := callExpr.Args[0].(*ast.CallExpr); ok {
						if selExpr, ok := middlewareCall.Fun.(*ast.SelectorExpr); ok {
							middlewareName := selExpr.Sel.Name
							// 移除 Middleware 后缀
							middlewareName = strings.TrimSuffix(middlewareName, "Middleware")
							currentMiddleware = append(currentMiddleware, middlewareName)
						}
					}
				}
			}
		}

		return true
	})

	return routes, nil
}

// ParseRoutersDir 解析整个 routers 目录
func ParseRoutersDir(dir string) ([]RouteDef, error) {
	var allRoutes []RouteDef

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// 只处理 .go 文件
		if info.IsDir() || !strings.HasSuffix(path, ".go") {
			return nil
		}

		routes, err := ParseRouterFile(path)
		if err != nil {
			return err
		}

		allRoutes = append(allRoutes, routes...)
		return nil
	})

	return allRoutes, err
}
