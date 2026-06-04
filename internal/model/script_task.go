package model

import (
	"context"
	"database/sql"
	"time"

	"scene-script/pkg/stores/sqlx"
)

var (
	scriptTaskFieldNames        = "id, task_id, user_id, title, genre, tone, pacing, source_chapters, status, err_msg, created_at, updated_at"
	scriptTaskRowsExpectAutoSet = "task_id, user_id, title, genre, tone, pacing, source_chapters, status, err_msg, created_at, updated_at"
)

type ScriptTask struct {
	ID             int64     `db:"id" json:"id"`
	TaskID         string    `db:"task_id" json:"task_id"`
	UserID         int64     `db:"user_id" json:"user_id"`
	Title          string    `db:"title" json:"title"`
	Genre          string    `db:"genre" json:"genre"`
	Tone           string    `db:"tone" json:"tone"`
	Pacing         string    `db:"pacing" json:"pacing"`
	SourceChapters int       `db:"source_chapters" json:"source_chapters"`
	Status         string    `db:"status" json:"status"`
	ErrMsg         string    `db:"err_msg" json:"err_msg"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at" json:"updated_at"`
}

type ScriptTaskModel interface {
	scriptTaskModel
	// BEGIN: customizable methods (preserved during code regeneration)
	// Add your custom methods here
	// END: customizable methods
}

type scriptTaskModel interface {
	Insert(ctx context.Context, data *ScriptTask) (int64, error)
	FindOne(ctx context.Context, id int64) (*ScriptTask, error)
	Update(ctx context.Context, data *ScriptTask) error
	Delete(ctx context.Context, id int64) error
	Trans(ctx context.Context, fn func(context.Context, ScriptTaskModel) error) error
}

type defaultScriptTaskModel struct {
	conn  sqlx.SqlConn
	table string
}

func NewScriptTaskModel(conn sqlx.SqlConn) ScriptTaskModel {
	return &defaultScriptTaskModel{
		conn:  conn,
		table: "ss_script_task",
	}
}

func (m *defaultScriptTaskModel) Insert(ctx context.Context, data *ScriptTask) (int64, error) {
	query := `INSERT INTO ` + m.table + ` (task_id, user_id, title, genre, tone, pacing, source_chapters, status, err_msg, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	result, err := m.conn.ExecCtx(ctx, query, data.TaskID, data.UserID, data.Title, data.Genre, data.Tone, data.Pacing, data.SourceChapters, data.Status, data.ErrMsg, time.Now(), time.Now())
	if err != nil {
		return 0, err
	}

	return result.LastInsertId()
}

func (m *defaultScriptTaskModel) FindOne(ctx context.Context, id int64) (*ScriptTask, error) {
	query := `SELECT ` + scriptTaskFieldNames + ` FROM ` + m.table + ` WHERE id = ?`

	var data ScriptTask
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

func (m *defaultScriptTaskModel) Update(ctx context.Context, data *ScriptTask) error {
	query := `UPDATE ` + m.table + ` SET task_id = ?, user_id = ?, title = ?, genre = ?, tone = ?, pacing = ?, source_chapters = ?, status = ?, err_msg = ?, updated_at = ? WHERE id = ?`

	_, err := m.conn.ExecCtx(ctx, query, data.TaskID, data.UserID, data.Title, data.Genre, data.Tone, data.Pacing, data.SourceChapters, data.Status, data.ErrMsg, time.Now(), data.ID)
	return err
}

func (m *defaultScriptTaskModel) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM ` + m.table + ` WHERE id = ?`

	_, err := m.conn.ExecCtx(ctx, query, id)
	return err
}

func (m *defaultScriptTaskModel) Trans(ctx context.Context, fn func(context.Context, ScriptTaskModel) error) error {
	return m.conn.TransactCtx(ctx, func(ctx context.Context, conn sqlx.SqlConn) error {
		transModel := &defaultScriptTaskModel{
			conn:  conn,
			table: m.table,
		}
		return fn(ctx, transModel)
	})
}
