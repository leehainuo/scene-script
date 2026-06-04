package sqlx

import (
	"context"
	"database/sql"

	"github.com/jmoiron/sqlx"
)

// SqlxAdapter Adapter for sqlx.DB to implement SqlConn interface
// This allows us to use sqlx while maintaining compatibility with go-zero's interface
type SqlxAdapter struct {
	db *sqlx.DB
}

// NewSqlxAdapter creates a new SqlConn adapter from sqlx.DB
func NewSqlxAdapter(db *sqlx.DB) SqlConn {
	return &SqlxAdapter{db: db}
}

// ExecCtx executes a query without returning any rows
func (a *SqlxAdapter) ExecCtx(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return a.db.ExecContext(ctx, query, args...)
}

// QueryRowCtx queries a single row
func (a *SqlxAdapter) QueryRowCtx(ctx context.Context, v interface{}, query string, args ...interface{}) error {
	return a.db.GetContext(ctx, v, query, args...)
}

// QueryRowsCtx queries multiple rows
func (a *SqlxAdapter) QueryRowsCtx(ctx context.Context, v interface{}, query string, args ...interface{}) error {
	return a.db.SelectContext(ctx, v, query, args...)
}

// TransactCtx executes a transaction
func (a *SqlxAdapter) TransactCtx(ctx context.Context, fn func(context.Context, SqlConn) error) error {
	tx, err := a.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}

	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p)
		} else if err != nil {
			tx.Rollback()
		} else {
			err = tx.Commit()
		}
	}()

	txConn := &SqlxTxAdapter{tx: tx}
	err = fn(ctx, txConn)
	return err
}

// SqlxTxAdapter Transaction adapter
type SqlxTxAdapter struct {
	tx *sqlx.Tx
}

// ExecCtx executes a query without returning any rows in transaction
func (a *SqlxTxAdapter) ExecCtx(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return a.tx.ExecContext(ctx, query, args...)
}

// QueryRowCtx queries a single row in transaction
func (a *SqlxTxAdapter) QueryRowCtx(ctx context.Context, v interface{}, query string, args ...interface{}) error {
	return a.tx.GetContext(ctx, v, query, args...)
}

// QueryRowsCtx queries multiple rows in transaction
func (a *SqlxTxAdapter) QueryRowsCtx(ctx context.Context, v interface{}, query string, args ...interface{}) error {
	return a.tx.SelectContext(ctx, v, query, args...)
}

// TransactCtx already in transaction, just execute the function
func (a *SqlxTxAdapter) TransactCtx(ctx context.Context, fn func(context.Context, SqlConn) error) error {
	return fn(ctx, a)
}
