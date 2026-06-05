package script

import (
	"context"
	"errors"
	"net/http"

	"scene-script/internal/model"
	"scene-script/internal/service"
	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

type WatchScriptEventsLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewWatchScriptEventsLogic(c context.Context, svc *svc.ServiceContext) *WatchScriptEventsLogic {
	return &WatchScriptEventsLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *WatchScriptEventsLogic) Snapshot(userID int64, req *types.GetScriptReq) (*service.ScriptTaskEvent, error) {
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

	event := service.SnapshotTaskEvent(task)
	return &event, nil
}
