package parser

import (
	"go/ast"
	"strings"
)

// extractComment 提取注释文本
func extractComment(doc *ast.CommentGroup) string {
	if doc == nil {
		return ""
	}
	var comments []string
	for _, comment := range doc.List {
		text := strings.TrimPrefix(comment.Text, "//")
		text = strings.TrimPrefix(text, "/*")
		text = strings.TrimSuffix(text, "*/")
		text = strings.TrimSpace(text)
		if text != "" {
			comments = append(comments, text)
		}
	}
	return strings.Join(comments, " ")
}

// exprToString 将表达式转换为字符串
func exprToString(expr ast.Expr) string {
	switch t := expr.(type) {
	case *ast.Ident:
		return t.Name
	case *ast.SelectorExpr:
		return exprToString(t.X) + "." + t.Sel.Name
	case *ast.StarExpr:
		return "*" + exprToString(t.X)
	case *ast.ArrayType:
		return "[]" + exprToString(t.Elt)
	case *ast.MapType:
		return "map[" + exprToString(t.Key) + "]" + exprToString(t.Value)
	case *ast.InterfaceType:
		return "interface{}"
	default:
		return ""
	}
}

// parseStructTag 解析 struct tag
func parseStructTag(tag string) map[string]string {
	result := make(map[string]string)
	tag = strings.Trim(tag, "`")
	
	parts := strings.Fields(tag)
	for _, part := range parts {
		kv := strings.SplitN(part, ":", 2)
		if len(kv) == 2 {
			key := kv[0]
			value := strings.Trim(kv[1], `"`)
			result[key] = value
		}
	}
	
	return result
}

// isHTTPMethod 检查是否是 HTTP 方法
func isHTTPMethod(method string) bool {
	httpMethods := []string{"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"}
	upper := strings.ToUpper(method)
	for _, m := range httpMethods {
		if upper == m {
			return true
		}
	}
	return false
}

// isHandlerFunc 检查是否是 Handler 函数
func isHandlerFunc(funcDecl *ast.FuncDecl) bool {
	if funcDecl.Type == nil || funcDecl.Type.Results == nil {
		return false
	}
	
	// 检查返回值是否是 gin.HandlerFunc
	for _, result := range funcDecl.Type.Results.List {
		if sel, ok := result.Type.(*ast.SelectorExpr); ok {
			if ident, ok := sel.X.(*ast.Ident); ok {
				if ident.Name == "gin" && sel.Sel.Name == "HandlerFunc" {
					return true
				}
			}
		}
	}
	
	return false
}

// extractJSONTag 从 tag 中提取 json 标签
func extractJSONTag(tag string) string {
	tags := parseStructTag(tag)
	jsonTag := tags["json"]
	// 移除 omitempty 等选项
	if idx := strings.Index(jsonTag, ","); idx > 0 {
		jsonTag = jsonTag[:idx]
	}
	return jsonTag
}

// extractValidateTag 从 tag 中提取 validate 标签
func extractValidateTag(tag string) string {
	tags := parseStructTag(tag)
	return tags["validate"]
}
