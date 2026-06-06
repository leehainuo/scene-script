package script

import (
	"context"
	"net/http"

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

	task, err := findOwnedScriptTask(l.c, l.svc, userID, req.ID)
	if err != nil {
		return nil, err
	}

	event := service.SnapshotTaskEvent(task)
	return &event, nil
}
