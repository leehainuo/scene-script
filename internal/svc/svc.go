package svc

import (
	"scene-script/config"
	"scene-script/internal/model"
	"scene-script/internal/service"
	"scene-script/pkg/stores/redis"
	"scene-script/pkg/stores/sqlx"
	"scene-script/pkg/token"
)

// ServiceContext - Service context with all dependencies.
type ServiceContext struct {
	Config          *config.Config
	DB              sqlx.SqlConn
	Redis           *redis.Client
	Token           *token.Manager
	ScriptConverter *service.ScriptConverter

	// Models
	UserModel          model.UserModel
	ScriptTaskModel    model.ScriptTaskModel
	ScriptChapterModel model.ScriptChapterModel
	ScriptResultModel  model.ScriptResultModel
}

func NewServiceContext(c *config.Config) (*ServiceContext, error) {

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

	scriptConverter, err := service.NewScriptConverter(&c.LLM, nil)
	if err != nil {
		return nil, err
	}

	return &ServiceContext{
		Config:          c,
		DB:              conn,
		Redis:           rdb,
		Token:           m,
		ScriptConverter: scriptConverter,

		// Init models with SqlConn interface
		UserModel:          model.NewUserModel(conn),
		ScriptTaskModel:    model.NewScriptTaskModel(conn),
		ScriptChapterModel: model.NewScriptChapterModel(conn),
		ScriptResultModel:  model.NewScriptResultModel(conn),
	}, nil
}
