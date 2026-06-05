package model

import (
	"context"
	"database/sql"
	"time"

	"scene-script/pkg/stores/sqlx"
)

var (
	scriptResultFieldNames        = "id, task_id, yaml, summary_json, consistency_json, generated_at, created_at, updated_at"
	scriptResultRowsExpectAutoSet = "task_id, yaml, summary_json, consistency_json, generated_at, created_at, updated_at"
)

type ScriptResult struct {
	ID              int64     `db:"id" json:"id"`
	TaskID          string    `db:"task_id" json:"task_id"`
	Yaml            string    `db:"yaml" json:"yaml"`
	SummaryJSON     string    `db:"summary_json" json:"summary_json"`
	ConsistencyJSON string    `db:"consistency_json" json:"consistency_json"`
	GeneratedAt     time.Time `db:"generated_at" json:"generated_at"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time `db:"updated_at" json:"updated_at"`
}

type ScriptResultModel interface {
	scriptResultModel
	// BEGIN: customizable methods (preserved during code regeneration)
	FindByTaskID(ctx context.Context, taskID string) (*ScriptResult, error)
	DeleteByTaskID(ctx context.Context, taskID string) error
	// END: customizable methods
}

type scriptResultModel interface {
	Insert(ctx context.Context, data *ScriptResult) (int64, error)
	FindOne(ctx context.Context, id int64) (*ScriptResult, error)
	Update(ctx context.Context, data *ScriptResult) error
	Delete(ctx context.Context, id int64) error
	Trans(ctx context.Context, fn func(context.Context, ScriptResultModel) error) error
}

type defaultScriptResultModel struct {
	conn  sqlx.SqlConn
	table string
}

func NewScriptResultModel(conn sqlx.SqlConn) ScriptResultModel {
	return &defaultScriptResultModel{
		conn:  conn,
		table: "ss_script_result",
	}
}

func (m *defaultScriptResultModel) Insert(ctx context.Context, data *ScriptResult) (int64, error) {
	query := `INSERT INTO ` + m.table + ` (task_id, yaml, summary_json, consistency_json, generated_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`

	result, err := m.conn.ExecCtx(ctx, query, data.TaskID, data.Yaml, data.SummaryJSON, data.ConsistencyJSON, data.GeneratedAt, time.Now(), time.Now())
	if err != nil {
		return 0, err
	}

	return result.LastInsertId()
}

func (m *defaultScriptResultModel) FindOne(ctx context.Context, id int64) (*ScriptResult, error) {
	query := `SELECT ` + scriptResultFieldNames + ` FROM ` + m.table + ` WHERE id = ?`

	var data ScriptResult
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

func (m *defaultScriptResultModel) Update(ctx context.Context, data *ScriptResult) error {
	query := `UPDATE ` + m.table + ` SET task_id = ?, yaml = ?, summary_json = ?, consistency_json = ?, generated_at = ?, updated_at = ? WHERE id = ?`

	_, err := m.conn.ExecCtx(ctx, query, data.TaskID, data.Yaml, data.SummaryJSON, data.ConsistencyJSON, data.GeneratedAt, time.Now(), data.ID)
	return err
}

func (m *defaultScriptResultModel) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM ` + m.table + ` WHERE id = ?`

	_, err := m.conn.ExecCtx(ctx, query, id)
	return err
}

func (m *defaultScriptResultModel) Trans(ctx context.Context, fn func(context.Context, ScriptResultModel) error) error {
	return m.conn.TransactCtx(ctx, func(ctx context.Context, conn sqlx.SqlConn) error {
		transModel := &defaultScriptResultModel{
			conn:  conn,
			table: m.table,
		}
		return fn(ctx, transModel)
	})
}

// BEGIN: customizable methods (preserved during code regeneration)

func (m *defaultScriptResultModel) FindByTaskID(ctx context.Context, taskID string) (*ScriptResult, error) {
	query := `SELECT ` + scriptResultFieldNames + ` FROM ` + m.table + ` WHERE task_id = ? LIMIT 1`

	var data ScriptResult
	err := m.conn.QueryRowCtx(ctx, &data, query, taskID)
	switch err {
	case nil:
		return &data, nil
	case sql.ErrNoRows:
		return nil, ErrNotFound
	default:
		return nil, err
	}
}

func (m *defaultScriptResultModel) DeleteByTaskID(ctx context.Context, taskID string) error {
	query := `DELETE FROM ` + m.table + ` WHERE task_id = ?`

	_, err := m.conn.ExecCtx(ctx, query, taskID)
	return err
}

// END: customizable methods
