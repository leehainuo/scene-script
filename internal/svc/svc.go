package svc

import (
	"context"

	"scene-script/config"
	"scene-script/internal/model"
	"scene-script/internal/service"
	"scene-script/pkg/logn"
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
	TaskEventBroker *service.ScriptTaskEventBroker
	ConvertRunner   *service.AsyncScriptConvertRunner

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
	taskEventBroker := service.NewScriptTaskEventBroker()
	scriptTaskModel := model.NewScriptTaskModel(conn)
	if affected, err := scriptTaskModel.MarkUnfinishedFailed(context.Background(), "service restarted before task completed"); err != nil {
		return nil, err
	} else if affected > 0 {
		logn.Warn("marked unfinished script tasks as failed after restart")
	}
	convertRunner := service.NewAsyncScriptConvertRunner(conn, scriptTaskModel, scriptConverter, taskEventBroker)

	return &ServiceContext{
		Config:          c,
		DB:              conn,
		Redis:           rdb,
		Token:           m,
		ScriptConverter: scriptConverter,
		TaskEventBroker: taskEventBroker,
		ConvertRunner:   convertRunner,

		// Init models with SqlConn interface
		UserModel:          model.NewUserModel(conn),
		ScriptTaskModel:    scriptTaskModel,
		ScriptChapterModel: model.NewScriptChapterModel(conn),
		ScriptResultModel:  model.NewScriptResultModel(conn),
	}, nil
}
