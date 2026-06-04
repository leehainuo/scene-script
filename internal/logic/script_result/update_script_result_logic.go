package script_result

import (
	"context"

	"go.uber.org/zap"

	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

type UpdateScriptResultLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewUpdateScriptResultLogic(c context.Context, svc *svc.ServiceContext) *UpdateScriptResultLogic {
	return &UpdateScriptResultLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *UpdateScriptResultLogic) UpdateScriptResult(req *types.UpdateScriptResultReq) (*types.ScriptResultResp, error) {
	// TODO: 实现更新逻辑
	l.Info("Updating script_result", zap.Any("req", req))

	return nil, errorn.NewDefault("Not implemented")
}
