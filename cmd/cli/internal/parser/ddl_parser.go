package parser

import (
	"bufio"
	"os"
	"regexp"
	"strings"
)

// TableDef 表定义
type TableDef struct {
	Name    string
	Comment string
	Columns []ColumnDef
	Indexes []IndexDef
}

// ColumnDef 列定义
type ColumnDef struct {
	Name         string
	Type         string
	GoType       string // 映射到 Go 类型
	Nullable     bool
	IsPrimaryKey bool
	IsAutoIncr   bool
	Default      string
	Comment      string
	JSONTag      string
	ValidateTag  string
}

// IndexDef 索引定义
type IndexDef struct {
	Name     string
	Columns  []string
	IsUnique bool
}

// ParseDDLFile 解析 DDL 文件
func ParseDDLFile(filepath string) ([]TableDef, error) {
	file, err := os.Open(filepath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var tables []TableDef
	var currentTable *TableDef
	var inCreateTable bool

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// 跳过注释和空行
		if line == "" || strings.HasPrefix(line, "--") || strings.HasPrefix(line, "/*") {
			continue
		}

		// 检测 CREATE TABLE
		if strings.HasPrefix(strings.ToUpper(line), "CREATE TABLE") {
			inCreateTable = true
			tableName := extractTableName(line)
			currentTable = &TableDef{
				Name:    tableName,
				Columns: []ColumnDef{},
				Indexes: []IndexDef{},
			}
			continue
		}

		// 解析列定义
		if inCreateTable && currentTable != nil {
			// 表结束
			if strings.Contains(line, ");") || strings.HasPrefix(line, ")") {
				inCreateTable = false
				tables = append(tables, *currentTable)
				currentTable = nil
				continue
			}

			// 解析列
			if !strings.HasPrefix(strings.ToUpper(line), "PRIMARY KEY") &&
				!strings.HasPrefix(strings.ToUpper(line), "UNIQUE KEY") &&
				!strings.HasPrefix(strings.ToUpper(line), "KEY") &&
				!strings.HasPrefix(strings.ToUpper(line), "INDEX") &&
				!strings.HasPrefix(line, ")") {

				column := parseColumn(line)
				if column.Name != "" {
					currentTable.Columns = append(currentTable.Columns, column)
				}
			}

			// 解析索引
			if strings.HasPrefix(strings.ToUpper(line), "UNIQUE KEY") ||
				strings.HasPrefix(strings.ToUpper(line), "KEY") ||
				strings.HasPrefix(strings.ToUpper(line), "INDEX") {

				index := parseIndex(line)
				if index.Name != "" {
					currentTable.Indexes = append(currentTable.Indexes, index)
				}
			}
		}
	}

	return tables, scanner.Err()
}

// extractTableName 提取表名
func extractTableName(line string) string {
	// CREATE TABLE `users` (
	// CREATE TABLE IF NOT EXISTS `users` (
	re := regexp.MustCompile("`([^`]+)`")
	matches := re.FindStringSubmatch(line)
	if len(matches) > 1 {
		return matches[1]
	}

	// 使用正则提取 CREATE TABLE [IF NOT EXISTS] tablename
	// 支持: CREATE TABLE users ( 或 CREATE TABLE IF NOT EXISTS users (
	re2 := regexp.MustCompile(`(?i)CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)`)
	matches2 := re2.FindStringSubmatch(line)
	if len(matches2) > 1 {
		return strings.ToLower(matches2[1])
	}

	return ""
}

// parseColumn 解析列定义
func parseColumn(line string) ColumnDef {
	line = strings.TrimRight(line, ",")
	parts := strings.Fields(line)

	if len(parts) < 2 {
		return ColumnDef{}
	}

	column := ColumnDef{
		Name: strings.Trim(parts[0], "`"),
	}

	// 解析类型
	columnType := strings.ToLower(parts[1])
	column.Type = columnType
	column.GoType = mapSQLTypeToGo(columnType)
	column.JSONTag = toSnakeCase(column.Name)

	// 解析属性
	lineUpper := strings.ToUpper(line)
	column.Nullable = !strings.Contains(lineUpper, "NOT NULL")
	column.IsPrimaryKey = strings.Contains(lineUpper, "PRIMARY KEY")
	column.IsAutoIncr = strings.Contains(lineUpper, "AUTO_INCREMENT")

	// 解析 COMMENT
	if strings.Contains(line, "COMMENT") {
		re := regexp.MustCompile(`COMMENT\s+'([^']+)'`)
		matches := re.FindStringSubmatch(line)
		if len(matches) > 1 {
			column.Comment = matches[1]
		}
	}

	// 生成验证标签
	column.ValidateTag = generateValidateTag(column)

	return column
}

// parseIndex 解析索引定义
func parseIndex(line string) IndexDef {
	index := IndexDef{}

	// UNIQUE KEY `idx_username` (`username`)
	re := regexp.MustCompile("`([^`]+)`")
	matches := re.FindAllStringSubmatch(line, -1)

	if len(matches) > 0 {
		index.Name = matches[0][1]
		index.IsUnique = strings.Contains(strings.ToUpper(line), "UNIQUE")

		// 提取列名
		if len(matches) > 1 {
			for i := 1; i < len(matches); i++ {
				index.Columns = append(index.Columns, matches[i][1])
			}
		}
	}

	return index
}

// mapSQLTypeToGo 将 SQL 类型映射到 Go 类型
func mapSQLTypeToGo(sqlType string) string {
	sqlType = strings.ToLower(sqlType)

	if strings.Contains(sqlType, "int") {
		if strings.Contains(sqlType, "bigint") {
			return "int64"
		}
		if strings.Contains(sqlType, "tinyint(1)") {
			return "bool"
		}
		return "int"
	}

	if strings.Contains(sqlType, "varchar") || strings.Contains(sqlType, "text") ||
		strings.Contains(sqlType, "char") {
		return "string"
	}

	if strings.Contains(sqlType, "decimal") || strings.Contains(sqlType, "float") ||
		strings.Contains(sqlType, "double") {
		return "float64"
	}

	if strings.Contains(sqlType, "timestamp") || strings.Contains(sqlType, "datetime") ||
		strings.Contains(sqlType, "date") {
		return "time.Time"
	}

	if strings.Contains(sqlType, "json") {
		return "string"
	}

	return "string"
}

// generateValidateTag 生成验证标签
func generateValidateTag(column ColumnDef) string {
	var tags []string

	if !column.Nullable && !column.IsPrimaryKey && !column.IsAutoIncr {
		tags = append(tags, "required")
	}

	// 字符串类型长度限制
	if column.GoType == "string" && strings.Contains(column.Type, "varchar") {
		re := regexp.MustCompile(`varchar\((\d+)\)`)
		matches := re.FindStringSubmatch(column.Type)
		if len(matches) > 1 {
			tags = append(tags, "max="+matches[1])
		}
	}

	// email 字段
	if strings.Contains(strings.ToLower(column.Name), "email") {
		tags = append(tags, "email")
	}

	if len(tags) == 0 {
		return ""
	}

	return strings.Join(tags, ",")
}

// toSnakeCase 转换为 snake_case
func toSnakeCase(s string) string {
	re := regexp.MustCompile("([a-z0-9])([A-Z])")
	snake := re.ReplaceAllString(s, "${1}_${2}")
	return strings.ToLower(snake)
}

// ToCamelCase 转换为 CamelCase，正确处理缩写词（ID, URL, HTTP 等）
func ToCamelCase(s string) string {
	if s == "" {
		return ""
	}

	// 特殊缩写词映射（全大写）
	initialisms := map[string]string{
		"id":    "ID",
		"url":   "URL",
		"http":  "HTTP",
		"https": "HTTPS",
		"api":   "API",
		"json":  "JSON",
		"xml":   "XML",
		"html":  "HTML",
		"css":   "CSS",
		"sql":   "SQL",
		"db":    "DB",
		"ip":    "IP",
		"tcp":   "TCP",
		"udp":   "UDP",
	}

	parts := strings.Split(s, "_")
	for i := range parts {
		if len(parts[i]) == 0 {
			continue
		}
		lowerPart := strings.ToLower(parts[i])
		// 检查是否是缩写词
		if upper, ok := initialisms[lowerPart]; ok {
			parts[i] = upper
		} else {
			// 普通单词，首字母大写
			parts[i] = strings.ToUpper(parts[i][:1]) + parts[i][1:]
		}
	}
	return strings.Join(parts, "")
}
