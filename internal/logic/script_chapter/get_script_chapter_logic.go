package script_chapter

import (
	"context"

	"go.uber.org/zap"

	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

type GetScriptChapterLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewGetScriptChapterLogic(c context.Context, svc *svc.ServiceContext) *GetScriptChapterLogic {
	return &GetScriptChapterLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *GetScriptChapterLogic) GetScriptChapter(id int64) (*types.ScriptChapterResp, error) {
	// TODO: 实现获取逻辑
	l.Info("Getting script_chapter", zap.Int64("id", id))

	return nil, errorn.NewDefault("Not implemented")
}
