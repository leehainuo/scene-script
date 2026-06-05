package model

import "time"

// ScriptYAML - Complete script YAML structure
type ScriptYAML struct {
	Version           string            `yaml:"version"`
	Metadata          ScriptMetadata    `yaml:"metadata"`
	DramatisPersonae  []Character       `yaml:"dramatis_personae"`
	Settings          []Setting         `yaml:"settings"`
	Chapters          []Chapter         `yaml:"chapters"`
	ConsistencyReport ConsistencyReport `yaml:"consistency_report"`
}

// ScriptMetadata - Script metadata
type ScriptMetadata struct {
	Title          string `yaml:"title"`
	Author         string `yaml:"author"`
	Genre          string `yaml:"genre"`
	Tone           string `yaml:"tone"`
	Pacing         string `yaml:"pacing"`
	SourceChapters int    `yaml:"source_chapters"`
	GeneratedAt    string `yaml:"generated_at"`
}

// Character - Character definition
type Character struct {
	Name            string   `yaml:"name"`
	Archetype       string   `yaml:"archetype"`
	Motivation      string   `yaml:"motivation"`
	Traits          []string `yaml:"traits"`
	Relations       []string `yaml:"relations"`
	FirstAppearance string   `yaml:"first_appearance"`
}

// Setting - Location/setting definition
type Setting struct {
	Name        string   `yaml:"name"`
	Description string   `yaml:"description"`
	Importance  string   `yaml:"importance"`
	Aliases     []string `yaml:"aliases,omitempty"`
}

// Chapter - Chapter structure
type Chapter struct {
	ID      string  `yaml:"id"`
	Title   string  `yaml:"title"`
	Summary string  `yaml:"summary"`
	Scenes  []Scene `yaml:"scenes"`
}

// Scene - Scene structure
type Scene struct {
	ID       string `yaml:"id"`
	Title    string `yaml:"title"`
	Goal     string `yaml:"goal"`
	Location string `yaml:"location"`
	Time     string `yaml:"time"`
	POV      string `yaml:"pov"`
	Mood     string `yaml:"mood"`
	Beats    []Beat `yaml:"beats"`
	Outcome  string `yaml:"outcome"`
}

// Beat - Story beat/shot
type Beat struct {
	ID       string    `yaml:"id"`
	Type     string    `yaml:"type"` // action|dialogue|inner|exposition
	Summary  string    `yaml:"summary"`
	Dialogue *Dialogue `yaml:"dialogue,omitempty"`
}

// Dialogue - Dialogue line
type Dialogue struct {
	Speaker string `yaml:"speaker"`
	Content string `yaml:"content"`
}

// ConsistencyReport - Consistency check report
type ConsistencyReport struct {
	RolesMissing    []string `yaml:"roles_missing"`
	SettingsMissing []string `yaml:"settings_missing"`
	DanglingRefs    []string `yaml:"dangling_refs"`
}

// ConvertRequest - Request for script conversion
type ConvertRequest struct {
	Chapters []ChapterInput `json:"chapters"`
	Genre    string         `json:"genre"`
	Tone     string         `json:"tone"`
	Pacing   string         `json:"pacing"`
}

// ChapterInput - Chapter input
type ChapterInput struct {
	Title string `json:"title"`
	Text  string `json:"text"`
}

// ConvertResponse - Response for script conversion
type ConvertResponse struct {
	ID                string            `json:"id"`
	YAML              string            `json:"yaml"`
	Summary           ScriptSummary     `json:"summary"`
	ConsistencyReport ConsistencyReport `json:"consistency_report"`
}

// ScriptSummary - Script summary statistics
type ScriptSummary struct {
	Chapters   int `json:"chapters"`
	Scenes     int `json:"scenes"`
	Beats      int `json:"beats"`
	Characters int `json:"characters"`
	Settings   int `json:"settings"`
}

// ScriptTaskData - Script task data for API response
type ScriptTaskData struct {
	ID                string            `json:"id"`
	UserID            int64             `json:"user_id"`
	Title             string            `json:"title"`
	Genre             string            `json:"genre"`
	Tone              string            `json:"tone"`
	Pacing            string            `json:"pacing"`
	SourceChapters    int               `json:"source_chapters"`
	YAML              string            `json:"yaml"`
	ConsistencyReport ConsistencyReport `json:"consistency_report"`
	CreatedAt         time.Time         `json:"created_at"`
	UpdatedAt         time.Time         `json:"updated_at"`
}
