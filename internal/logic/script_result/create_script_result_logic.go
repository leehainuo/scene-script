package script_result

import (
	"context"

	"go.uber.org/zap"

	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

type CreateScriptResultLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewCreateScriptResultLogic(c context.Context, svc *svc.ServiceContext) *CreateScriptResultLogic {
	return &CreateScriptResultLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *CreateScriptResultLogic) CreateScriptResult(req *types.CreateScriptResultReq) (*types.ScriptResultResp, error) {
	// TODO: 实现创建逻辑
	l.Info("Creating script_result", zap.Any("req", req))

	return nil, errorn.NewDefault("Not implemented")
}
