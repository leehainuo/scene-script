package script_task

import (
	"context"

	"go.uber.org/zap"

	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

type CreateScriptTaskLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewCreateScriptTaskLogic(c context.Context, svc *svc.ServiceContext) *CreateScriptTaskLogic {
	return &CreateScriptTaskLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *CreateScriptTaskLogic) CreateScriptTask(req *types.CreateScriptTaskReq) (*types.ScriptTaskResp, error) {
	// TODO: 实现创建逻辑
	l.Info("Creating script_task", zap.Any("req", req))

	return nil, errorn.NewDefault("Not implemented")
}
