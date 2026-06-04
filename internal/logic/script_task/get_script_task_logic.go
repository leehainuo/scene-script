package script_task

import (
	"context"

	"go.uber.org/zap"

	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

type GetScriptTaskLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewGetScriptTaskLogic(c context.Context, svc *svc.ServiceContext) *GetScriptTaskLogic {
	return &GetScriptTaskLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *GetScriptTaskLogic) GetScriptTask(id int64) (*types.ScriptTaskResp, error) {
	// TODO: 实现获取逻辑
	l.Info("Getting script_task", zap.Int64("id", id))

	return nil, errorn.NewDefault("Not implemented")
}
