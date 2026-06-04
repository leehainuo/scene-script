package script_task

import (
	"context"

	"go.uber.org/zap"

	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

type UpdateScriptTaskLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewUpdateScriptTaskLogic(c context.Context, svc *svc.ServiceContext) *UpdateScriptTaskLogic {
	return &UpdateScriptTaskLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *UpdateScriptTaskLogic) UpdateScriptTask(req *types.UpdateScriptTaskReq) (*types.ScriptTaskResp, error) {
	// TODO: 实现更新逻辑
	l.Info("Updating script_task", zap.Any("req", req))

	return nil, errorn.NewDefault("Not implemented")
}
