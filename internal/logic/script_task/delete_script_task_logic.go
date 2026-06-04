package script_task

import (
	"context"

	"go.uber.org/zap"

	"scene-script/internal/svc"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

type DeleteScriptTaskLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewDeleteScriptTaskLogic(c context.Context, svc *svc.ServiceContext) *DeleteScriptTaskLogic {
	return &DeleteScriptTaskLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *DeleteScriptTaskLogic) DeleteScriptTask(id int64) error {
	// TODO: 实现删除逻辑
	l.Info("Deleting script_task", zap.Int64("id", id))

	return errorn.NewDefault("Not implemented")
}
