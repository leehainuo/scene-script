package codegen

import (
	"bytes"
	"fmt"
	"strings"

	"scene-script/cmd/cli/internal/parser"
)

// APIGenerator .api 文件生成器
type APIGenerator struct {
	types      []parser.TypeDef
	handlers   []parser.HandlerDef
	routes     []parser.RouteDef
	apiVersion string // API 版本（v1, v2, etc.）
}

// ModuleData 模块数据
type ModuleData struct {
	Types    []parser.TypeDef
	Handlers []parser.HandlerDef
	Routes   []parser.RouteDef
}

// NewAPIGenerator 创建生成器
func NewAPIGenerator(types []parser.TypeDef, handlers []parser.HandlerDef, routes []parser.RouteDef, apiVersion string) *APIGenerator {
	return &APIGenerator{
		types:      types,
		handlers:   handlers,
		routes:     routes,
		apiVersion: apiVersion,
	}
}

// Generate 生成 .api 文件
func (g *APIGenerator) Generate() (map[string]string, error) {
	// 按模块（group）分组
	grouped := g.groupByModule()

	apiFiles := make(map[string]string)

	for module, data := range grouped {
		content := g.generateAPIFile(module, data)
		apiFiles[module+".api"] = content
	}

	return apiFiles, nil
}

// groupByModule 按模块分组
func (g *APIGenerator) groupByModule() map[string]ModuleData {
	grouped := make(map[string]ModuleData)

	// 从 handlers 提取模块
	for _, handler := range g.handlers {
		module := handler.Group
		data := grouped[module]
		data.Handlers = append(data.Handlers, handler)
		grouped[module] = data
	}

	// 关联 routes
	for _, route := range g.routes {
		module := route.Group
		data := grouped[module]
		data.Routes = append(data.Routes, route)
		grouped[module] = data
	}

	// 关联 types（根据命名规则推断）
	for _, typeDef := range g.types {
		// 从类型名推断模块，如 LoginReq -> login -> auth
		for module := range grouped {
			// 简单匹配：如果 handler 中使用了这个类型，就归属该模块
			for _, handler := range grouped[module].Handlers {
				if strings.Contains(handler.RequestType, typeDef.Name) {
					data := grouped[module]
					data.Types = append(data.Types, typeDef)
					grouped[module] = data
					break
				}
			}
		}
	}

	return grouped
}

// generateAPIFile 生成单个 .api 文件
func (g *APIGenerator) generateAPIFile(module string, data ModuleData) string {
	var buf bytes.Buffer

	// 1. Header
	buf.WriteString("syntax = \"v1\"\n\n")
	buf.WriteString("info (\n")
	buf.WriteString(fmt.Sprintf("    title: \"%s服务\"\n", module))
	buf.WriteString(fmt.Sprintf("    desc: \"%s相关接口\"\n", module))
	buf.WriteString("    author: \"scene-script-cli\"\n")
	buf.WriteString(fmt.Sprintf("    version: \"%s.0\"\n", g.apiVersion))
	buf.WriteString(")\n\n")

	// 2. Types
	if len(data.Types) > 0 {
		buf.WriteString("// Types\n\n")
		for _, typeDef := range data.Types {
			buf.WriteString(g.generateTypeDefinition(typeDef))
			buf.WriteString("\n")
		}
	}

	// 3. Services
	if len(data.Routes) > 0 {
		buf.WriteString("// Services\n\n")

		// 按中间件分组
		publicRoutes := []parser.RouteDef{}
		protectedRoutes := []parser.RouteDef{}

		for _, route := range data.Routes {
			if len(route.Middleware) > 0 {
				protectedRoutes = append(protectedRoutes, route)
			} else {
				publicRoutes = append(publicRoutes, route)
			}
		}

		// 生成 public routes
		if len(publicRoutes) > 0 {
			buf.WriteString("@server (\n")
			buf.WriteString(fmt.Sprintf("    prefix: /api/%s\n", g.apiVersion))
			buf.WriteString(fmt.Sprintf("    group: %s\n", module))
			buf.WriteString(")\n")
			buf.WriteString("service scenescript {\n")

			for _, route := range publicRoutes {
				buf.WriteString(g.generateRouteDefinition(route, data.Handlers))
			}

			buf.WriteString("}\n\n")
		}

		// 生成 protected routes
		if len(protectedRoutes) > 0 {
			buf.WriteString("@server (\n")
			buf.WriteString(fmt.Sprintf("    prefix: /api/%s\n", g.apiVersion))
			buf.WriteString(fmt.Sprintf("    group: %s\n", module))
			buf.WriteString(fmt.Sprintf("    middleware: %s\n", strings.Join(protectedRoutes[0].Middleware, ", ")))
			buf.WriteString(")\n")
			buf.WriteString("service scenescript {\n")

			for _, route := range protectedRoutes {
				buf.WriteString(g.generateRouteDefinition(route, data.Handlers))
			}

			buf.WriteString("}\n")
		}
	}

	return buf.String()
}

// generateTypeDefinition 生成类型定义
func (g *APIGenerator) generateTypeDefinition(typeDef parser.TypeDef) string {
	var buf bytes.Buffer

	if typeDef.Comment != "" {
		buf.WriteString(fmt.Sprintf("// %s\n", typeDef.Comment))
	}

	buf.WriteString(fmt.Sprintf("type %s {\n", typeDef.Name))

	for _, field := range typeDef.Fields {
		tags := ""
		if field.JSONTag != "" {
			tags += fmt.Sprintf(" `json:\"%s\"", field.JSONTag)
		}
		if field.Validate != "" {
			tags += fmt.Sprintf(" validate:\"%s\"", field.Validate)
		}
		if tags != "" {
			tags += "`"
		}

		buf.WriteString(fmt.Sprintf("    %s %s%s\n", field.Name, field.Type, tags))
	}

	buf.WriteString("}\n")

	return buf.String()
}

// generateRouteDefinition 生成路由定义
func (g *APIGenerator) generateRouteDefinition(route parser.RouteDef, handlers []parser.HandlerDef) string {
	var buf bytes.Buffer

	handler := strings.TrimSuffix(route.Handler, "Handler")
	handler = strings.ToLower(handler[:1]) + handler[1:]

	// 查找对应的 handler 定义
	var handlerDef *parser.HandlerDef
	for i := range handlers {
		if handlers[i].Name == route.Handler {
			handlerDef = &handlers[i]
			break
		}
	}

	if handlerDef != nil && handlerDef.Comment != "" {
		buf.WriteString(fmt.Sprintf("    @doc \"%s\"\n", handlerDef.Comment))
	}

	buf.WriteString(fmt.Sprintf("    @handler %s\n", handler))

	method := strings.ToLower(route.Method)
	path := route.Path

	reqType := ""
	respType := ""

	if handlerDef != nil {
		reqType = handlerDef.RequestType
		// 推断响应类型（从请求类型）
		respType = inferResponseType(reqType)
	}

	if reqType != "" && respType != "" {
		buf.WriteString(fmt.Sprintf("    %s %s (%s) returns (%s)\n", method, path, reqType, respType))
	} else if reqType != "" {
		buf.WriteString(fmt.Sprintf("    %s %s (%s)\n", method, path, reqType))
	} else {
		buf.WriteString(fmt.Sprintf("    %s %s\n", method, path))
	}

	buf.WriteString("\n")

	return buf.String()
}

// inferResponseType 推断响应类型
func inferResponseType(reqType string) string {
	if reqType == "" {
		return ""
	}
	// LoginReq -> LoginResp
	// CreateUserReq -> CreateUserResp
	if strings.HasSuffix(reqType, "Req") {
		return strings.TrimSuffix(reqType, "Req") + "Resp"
	}
	return ""
}
