package script_result

import (
	"context"

	"go.uber.org/zap"

	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

type GetScriptResultLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewGetScriptResultLogic(c context.Context, svc *svc.ServiceContext) *GetScriptResultLogic {
	return &GetScriptResultLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *GetScriptResultLogic) GetScriptResult(id int64) (*types.ScriptResultResp, error) {
	// TODO: 实现获取逻辑
	l.Info("Getting script_result", zap.Int64("id", id))

	return nil, errorn.NewDefault("Not implemented")
}
