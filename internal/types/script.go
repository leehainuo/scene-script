package types

import (
	"time"

	"scene-script/internal/model"
)

type ConvertScriptChapter struct {
	Title string `json:"title" validate:"required"`
	Text  string `json:"text" validate:"required"`
}

type ConvertScriptReq struct {
	Chapters []ConvertScriptChapter `json:"chapters" validate:"required,min=3,max=12,dive"`
	Genre    string                 `json:"genre" validate:"required,max=64"`
	Tone     string                 `json:"tone" validate:"required,max=64"`
	Pacing   string                 `json:"pacing" validate:"required,oneof=fast medium slow"`
}

type ConvertScriptResp struct {
	ID        string `json:"id"`
	Status    string `json:"status"`
	DetailURL string `json:"detail_url"`
	EventURL  string `json:"event_url"`
}

type ListScriptReq struct {
	Page     int `form:"page" validate:"omitempty,min=1"`
	PageSize int `form:"page_size" validate:"omitempty,min=1,max=100"`
}

type ScriptTaskItem struct {
	ID             string    `json:"id"`
	Title          string    `json:"title"`
	Genre          string    `json:"genre"`
	Tone           string    `json:"tone"`
	Pacing         string    `json:"pacing"`
	SourceChapters int       `json:"source_chapters"`
	Status         string    `json:"status"`
	ErrMsg         string    `json:"err_msg,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type ListScriptResp struct {
	Items    []ScriptTaskItem `json:"items"`
	Page     int              `json:"page"`
	PageSize int              `json:"page_size"`
	Total    int64            `json:"total"`
}

type GetScriptReq struct {
	ID string `json:"id" validate:"required,max=64"`
}

type SaveScriptResultReq struct {
	ID   string `json:"id" validate:"required,max=64"`
	YAML string `json:"yaml" validate:"required"`
}

type DeleteScriptReq struct {
	ID string `json:"id" validate:"required,max=64"`
}

type DeleteScriptResp struct {
	ID string `json:"id"`
}

type RetryScriptReq struct {
	ID string `json:"id" validate:"required,max=64"`
}

type ScriptTaskMeta struct {
	ID             string    `json:"id"`
	Title          string    `json:"title"`
	Genre          string    `json:"genre"`
	Tone           string    `json:"tone"`
	Pacing         string    `json:"pacing"`
	SourceChapters int       `json:"source_chapters"`
	Status         string    `json:"status"`
	ErrMsg         string    `json:"err_msg,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type GetScriptResp struct {
	ID                string                  `json:"id"`
	YAML              string                  `json:"yaml,omitempty"`
	Summary           model.ScriptSummary     `json:"summary"`
	ConsistencyReport model.ConsistencyReport `json:"consistency_report"`
	Metadata          ScriptTaskMeta          `json:"metadata"`
}
