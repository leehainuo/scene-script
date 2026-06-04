package script_chapter

import (
	"context"

	"go.uber.org/zap"

	"scene-script/internal/svc"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

type DeleteScriptChapterLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewDeleteScriptChapterLogic(c context.Context, svc *svc.ServiceContext) *DeleteScriptChapterLogic {
	return &DeleteScriptChapterLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *DeleteScriptChapterLogic) DeleteScriptChapter(id int64) error {
	// TODO: 实现删除逻辑
	l.Info("Deleting script_chapter", zap.Int64("id", id))

	return errorn.NewDefault("Not implemented")
}
