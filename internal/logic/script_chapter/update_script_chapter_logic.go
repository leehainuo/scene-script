package script_chapter

import (
	"context"

	"go.uber.org/zap"

	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

type UpdateScriptChapterLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewUpdateScriptChapterLogic(c context.Context, svc *svc.ServiceContext) *UpdateScriptChapterLogic {
	return &UpdateScriptChapterLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *UpdateScriptChapterLogic) UpdateScriptChapter(req *types.UpdateScriptChapterReq) (*types.ScriptChapterResp, error) {
	// TODO: 实现更新逻辑
	l.Info("Updating script_chapter", zap.Any("req", req))

	return nil, errorn.NewDefault("Not implemented")
}
