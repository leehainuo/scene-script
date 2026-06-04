package sqlx

import (
	"context"
	"database/sql"
)

// SqlConn Database connection interface compatible with go-zero
// This abstraction allows seamless migration to go-zero in the future
type SqlConn interface {
	// ExecCtx executes a query without returning any rows
	ExecCtx(ctx context.Context, query string, args ...any) (sql.Result, error)

	// QueryRowCtx queries a single row
	QueryRowCtx(ctx context.Context, v any, query string, args ...interface{}) error

	// QueryRowsCtx queries multiple rows
	QueryRowsCtx(ctx context.Context, v any, query string, args ...interface{}) error

	// TransactCtx executes a transaction
	TransactCtx(ctx context.Context, fn func(context.Context, SqlConn) error) error
}
