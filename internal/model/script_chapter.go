package model

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"scene-script/pkg/stores/sqlx"
)

var (
	scriptChapterFieldNames        = "id, task_id, chapter_index, chapter_title, chapter_text, created_at, updated_at"
	scriptChapterRowsExpectAutoSet = "task_id, chapter_index, chapter_title, chapter_text, created_at, updated_at"
)

type ScriptChapter struct {
	ID           int64     `db:"id" json:"id"`
	TaskID       string    `db:"task_id" json:"task_id"`
	ChapterIndex int       `db:"chapter_index" json:"chapter_index"`
	ChapterTitle string    `db:"chapter_title" json:"chapter_title"`
	ChapterText  string    `db:"chapter_text" json:"chapter_text"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

type ScriptChapterModel interface {
	scriptChapterModel
	// BEGIN: customizable methods (preserved during code regeneration)
	InsertBatch(ctx context.Context, rows []*ScriptChapter) error
	// END: customizable methods
}

type scriptChapterModel interface {
	Insert(ctx context.Context, data *ScriptChapter) (int64, error)
	FindOne(ctx context.Context, id int64) (*ScriptChapter, error)
	Update(ctx context.Context, data *ScriptChapter) error
	Delete(ctx context.Context, id int64) error
	Trans(ctx context.Context, fn func(context.Context, ScriptChapterModel) error) error
}

type defaultScriptChapterModel struct {
	conn  sqlx.SqlConn
	table string
}

func NewScriptChapterModel(conn sqlx.SqlConn) ScriptChapterModel {
	return &defaultScriptChapterModel{
		conn:  conn,
		table: "ss_script_chapter",
	}
}

func (m *defaultScriptChapterModel) Insert(ctx context.Context, data *ScriptChapter) (int64, error) {
	query := `INSERT INTO ` + m.table + ` (task_id, chapter_index, chapter_title, chapter_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`

	result, err := m.conn.ExecCtx(ctx, query, data.TaskID, data.ChapterIndex, data.ChapterTitle, data.ChapterText, time.Now(), time.Now())
	if err != nil {
		return 0, err
	}

	return result.LastInsertId()
}

func (m *defaultScriptChapterModel) FindOne(ctx context.Context, id int64) (*ScriptChapter, error) {
	query := `SELECT ` + scriptChapterFieldNames + ` FROM ` + m.table + ` WHERE id = ?`

	var data ScriptChapter
	err := m.conn.QueryRowCtx(ctx, &data, query, id)

	switch err {
	case nil:
		return &data, nil
	case sql.ErrNoRows:
		return nil, ErrNotFound
	default:
		return nil, err
	}
}

func (m *defaultScriptChapterModel) Update(ctx context.Context, data *ScriptChapter) error {
	query := `UPDATE ` + m.table + ` SET task_id = ?, chapter_index = ?, chapter_title = ?, chapter_text = ?, updated_at = ? WHERE id = ?`

	_, err := m.conn.ExecCtx(ctx, query, data.TaskID, data.ChapterIndex, data.ChapterTitle, data.ChapterText, time.Now(), data.ID)
	return err
}

func (m *defaultScriptChapterModel) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM ` + m.table + ` WHERE id = ?`

	_, err := m.conn.ExecCtx(ctx, query, id)
	return err
}

func (m *defaultScriptChapterModel) Trans(ctx context.Context, fn func(context.Context, ScriptChapterModel) error) error {
	return m.conn.TransactCtx(ctx, func(ctx context.Context, conn sqlx.SqlConn) error {
		transModel := &defaultScriptChapterModel{
			conn:  conn,
			table: m.table,
		}
		return fn(ctx, transModel)
	})
}

// BEGIN: customizable methods (preserved during code regeneration)

func (m *defaultScriptChapterModel) InsertBatch(ctx context.Context, rows []*ScriptChapter) error {
	if len(rows) == 0 {
		return nil
	}

	placeholders := make([]string, 0, len(rows))
	args := make([]any, 0, len(rows)*6)
	now := time.Now()
	for _, row := range rows {
		placeholders = append(placeholders, "(?, ?, ?, ?, ?, ?)")
		args = append(args, row.TaskID, row.ChapterIndex, row.ChapterTitle, row.ChapterText, now, now)
	}

	query := fmt.Sprintf(
		"INSERT INTO %s (task_id, chapter_index, chapter_title, chapter_text, created_at, updated_at) VALUES %s",
		m.table,
		strings.Join(placeholders, ", "),
	)

	_, err := m.conn.ExecCtx(ctx, query, args...)
	return err
}

// END: customizable methods
