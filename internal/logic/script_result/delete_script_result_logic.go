package script_result

import (
	"context"

	"go.uber.org/zap"

	"scene-script/internal/svc"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

type DeleteScriptResultLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewDeleteScriptResultLogic(c context.Context, svc *svc.ServiceContext) *DeleteScriptResultLogic {
	return &DeleteScriptResultLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *DeleteScriptResultLogic) DeleteScriptResult(id int64) error {
	// TODO: 实现删除逻辑
	l.Info("Deleting script_result", zap.Int64("id", id))

	return errorn.NewDefault("Not implemented")
}
