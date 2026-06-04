package svc

import (
	"scene-script/config"
	"scene-script/internal/model"
	"scene-script/pkg/stores/redis"
	"scene-script/pkg/stores/sqlx"
	"scene-script/pkg/token"
)

// ServiceContext - Service context with all dependencies
// Note: No DB field - following go-zero's design philosophy
type ServiceContext struct {
	Config *config.Config
	Redis  *redis.Client
	Token  *token.Manager

	// Models
	UserModel    model.UserModel
}

func NewServiceContext(c *config.Config) (*ServiceContext, error) {
	// Init database connection via sqlconn (go-zero compatible)
	conn, err := sqlx.NewMysql(
		c.MySQL.DSN(),
		sqlx.WithMaxOpenConns(c.MySQL.MaxOpenConns),
		sqlx.WithMaxIdleConns(c.MySQL.MaxIdleConns),
		sqlx.WithConnMaxLifetime(c.MySQL.ConnMaxLifetime),
	)
	if err != nil {
		return nil, err
	}

	// Init redis
	rdb, err := redis.Init(c.Redis)
	if err != nil {
		return nil, err
	}

	// Init token manager
	m := token.New(c.JWT)

	return &ServiceContext{
		Config: c,
		Redis:  rdb,
		Token:  m,

		// Init models with SqlConn interface
		UserModel:    model.NewUserModel(conn),
	}, nil
}
