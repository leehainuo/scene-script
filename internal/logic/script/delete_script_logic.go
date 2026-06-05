package script

import (
	"context"
	"errors"
	"net/http"

	"scene-script/internal/model"
	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
	"scene-script/pkg/stores/sqlx"
)

type DeleteScriptLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewDeleteScriptLogic(c context.Context, svc *svc.ServiceContext) *DeleteScriptLogic {
	return &DeleteScriptLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *DeleteScriptLogic) Delete(userID int64, req *types.DeleteScriptReq) (*types.DeleteScriptResp, error) {
	if userID <= 0 {
		return nil, errorn.New(http.StatusBadRequest, "invalid user id")
	}
	if req == nil || req.ID == "" {
		return nil, errorn.New(http.StatusBadRequest, "task id is required")
	}

	task, err := l.svc.ScriptTaskModel.FindByTaskID(l.c, req.ID)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, errorn.New(http.StatusNotFound, "script task not found")
		}
		return nil, err
	}
	if task.UserID != userID {
		return nil, errorn.New(http.StatusNotFound, "script task not found")
	}
	if task.Status != "succeeded" && task.Status != "failed" {
		return nil, errorn.New(http.StatusConflict, "only completed or failed works can be deleted")
	}

	if err := l.svc.DB.TransactCtx(l.c, func(ctx context.Context, conn sqlx.SqlConn) error {
		taskModel := model.NewScriptTaskModel(conn)
		chapterModel := model.NewScriptChapterModel(conn)
		resultModel := model.NewScriptResultModel(conn)

		if err := resultModel.DeleteByTaskID(ctx, task.TaskID); err != nil {
			return err
		}
		if err := chapterModel.DeleteByTaskID(ctx, task.TaskID); err != nil {
			return err
		}
		return taskModel.Delete(ctx, task.ID)
	}); err != nil {
		return nil, err
	}

	return &types.DeleteScriptResp{ID: task.TaskID}, nil
}
