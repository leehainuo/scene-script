package service

import (
	"fmt"
	"regexp"
	"strings"
)

var genericChapterTitlePattern = regexp.MustCompile(`^(第[0-9一二三四五六七八九十百千两零〇]+[章节回幕集篇卷]|chapter\s*\d+|chap\.\s*\d+|序章|楔子|前言|引子|正文|尾声|终章)\s*$`)

func BuildInitialTaskTitle(chapters []ChapterInput, genre string) string {
	for _, chapter := range chapters {
		title := strings.TrimSpace(chapter.Title)
		if title == "" || isGenericTaskTitle(title) {
			continue
		}
		return title
	}

	genre = strings.TrimSpace(genre)
	if genre != "" {
		return fmt.Sprintf("%s剧本草稿（%d章）", genre, len(chapters))
	}
	return fmt.Sprintf("未命名剧本（%d章）", len(chapters))
}

func ResolveFinalTaskTitle(currentTitle, generatedTitle string) string {
	generatedTitle = strings.TrimSpace(generatedTitle)
	if generatedTitle != "" && !isGenericTaskTitle(generatedTitle) {
		return generatedTitle
	}
	return strings.TrimSpace(currentTitle)
}

func isGenericTaskTitle(title string) bool {
	normalized := strings.ToLower(strings.TrimSpace(title))
	if normalized == "" {
		return true
	}
	return genericChapterTitlePattern.MatchString(normalized)
}
