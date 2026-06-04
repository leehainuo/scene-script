package parser

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
)

// TypeDef 类型定义
type TypeDef struct {
	Name     string
	Fields   []Field
	Comment  string
	Package  string
	FilePath string
}

// Field 字段定义
type Field struct {
	Name     string
	Type     string
	JSONTag  string
	Validate string
	Comment  string
}

// ParseTypesFile 解析单个 types 文件
func ParseTypesFile(filepath string) ([]TypeDef, error) {
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, filepath, nil, parser.ParseComments)
	if err != nil {
		return nil, err
	}

	var types []TypeDef

	// 遍历所有声明
	for _, decl := range node.Decls {
		genDecl, ok := decl.(*ast.GenDecl)
		if !ok || genDecl.Tok != token.TYPE {
			continue
		}

		for _, spec := range genDecl.Specs {
			typeSpec, ok := spec.(*ast.TypeSpec)
			if !ok {
				continue
			}

			structType, ok := typeSpec.Type.(*ast.StructType)
			if !ok {
				continue
			}

			typeDef := TypeDef{
				Name:     typeSpec.Name.Name,
				Comment:  extractComment(genDecl.Doc),
				Package:  node.Name.Name,
				FilePath: filepath,
			}

			// 解析字段
			for _, field := range structType.Fields.List {
				for _, name := range field.Names {
					f := Field{
						Name:    name.Name,
						Type:    exprToString(field.Type),
						Comment: extractComment(field.Comment),
					}

					// 解析 tag
					if field.Tag != nil {
						tagValue := field.Tag.Value
						f.JSONTag = extractJSONTag(tagValue)
						f.Validate = extractValidateTag(tagValue)
					}

					typeDef.Fields = append(typeDef.Fields, f)
				}
			}

			types = append(types, typeDef)
		}
	}

	return types, nil
}

// ParseTypesDir 解析整个 types 目录
func ParseTypesDir(dir string) ([]TypeDef, error) {
	var allTypes []TypeDef

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// 只处理 .go 文件
		if info.IsDir() || !strings.HasSuffix(path, ".go") {
			return nil
		}

		types, err := ParseTypesFile(path)
		if err != nil {
			return err
		}

		allTypes = append(allTypes, types...)
		return nil
	})

	return allTypes, err
}
