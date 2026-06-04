package script_chapter

import (
	"context"

	"go.uber.org/zap"

	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

type CreateScriptChapterLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewCreateScriptChapterLogic(c context.Context, svc *svc.ServiceContext) *CreateScriptChapterLogic {
	return &CreateScriptChapterLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *CreateScriptChapterLogic) CreateScriptChapter(req *types.CreateScriptChapterReq) (*types.ScriptChapterResp, error) {
	// TODO: 实现创建逻辑
	l.Info("Creating script_chapter", zap.Any("req", req))

	return nil, errorn.NewDefault("Not implemented")
}
