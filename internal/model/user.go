package model

import (
	"context"
	"database/sql"
	"time"

	"scene-script/pkg/stores/sqlx"
)

var (
	userFieldNames = "id, username, email, password, created_at, updated_at"
)

type User struct {
	ID        int64     `db:"id" json:"id"`
	Username  string    `db:"username" json:"username"`
	Email     string    `db:"email" json:"email"`
	Password  string    `db:"password" json:"-"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type UserModel interface {
	userModel
	// BEGIN: customizable methods (preserved during code regeneration)
	FindByUsername(ctx context.Context, username string) (*User, error)
	// END: customizable methods
}

type userModel interface {
	Insert(ctx context.Context, data *User) (int64, error)
	FindOne(ctx context.Context, id int64) (*User, error)
	Update(ctx context.Context, data *User) error
	Delete(ctx context.Context, id int64) error
	Trans(ctx context.Context, fn func(context.Context, UserModel) error) error
}

type defaultUserModel struct {
	conn  sqlx.SqlConn
	table string
}

func NewUserModel(conn sqlx.SqlConn) UserModel {
	return &customUserModel{
		defaultUserModel: &defaultUserModel{
			conn:  conn,
			table: "ss_user",
		},
	}
}

type customUserModel struct {
	*defaultUserModel
}

func (m *defaultUserModel) Insert(ctx context.Context, data *User) (int64, error) {
	query := `INSERT INTO ` + m.table + ` (username, email, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`

	result, err := m.conn.ExecCtx(ctx, query,
		data.Username, data.Email, data.Password,
		time.Now(), time.Now())
	if err != nil {
		return 0, err
	}

	return result.LastInsertId()
}

func (m *defaultUserModel) FindOne(ctx context.Context, id int64) (*User, error) {
	query := `SELECT ` + userFieldNames + ` FROM ` + m.table + ` WHERE id = ?`

	var data User
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

func (m *defaultUserModel) Update(ctx context.Context, data *User) error {
	query := `UPDATE ` + m.table + ` SET username = ?, email = ?, updated_at = ? WHERE id = ?`

	_, err := m.conn.ExecCtx(ctx, query,
		data.Username, data.Email, time.Now(), data.ID)
	return err
}

func (m *defaultUserModel) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM ` + m.table + ` WHERE id = ?`

	_, err := m.conn.ExecCtx(ctx, query, id)
	return err
}

func (m *defaultUserModel) Trans(ctx context.Context, fn func(context.Context, UserModel) error) error {
	return m.conn.TransactCtx(ctx, func(ctx context.Context, conn sqlx.SqlConn) error {
		transModel := &customUserModel{
			defaultUserModel: &defaultUserModel{
				conn:  conn,
				table: m.table,
			},
		}
		return fn(ctx, transModel)
	})
}

// FindByUsername Custom method - finds user by username
func (m *customUserModel) FindByUsername(ctx context.Context, username string) (*User, error) {
	query := `SELECT ` + userFieldNames + ` FROM ` + m.table + ` WHERE username = ?`

	var data User
	err := m.conn.QueryRowCtx(ctx, &data, query, username)

	switch err {
	case nil:
		return &data, nil
	case sql.ErrNoRows:
		return nil, ErrNotFound
	default:
		return nil, err
	}
}
