package script

import (
	"context"
	"net/http"
	"time"

	"go.uber.org/zap"

	"scene-script/internal/service"
	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

// ConvertScriptLogic - Convert novel to structured script
// Handler only binds params; business logic stays here per project guideline.
type ConvertScriptLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

// NewConvertScriptLogic - Constructor
func NewConvertScriptLogic(c context.Context, svc *svc.ServiceContext) *ConvertScriptLogic {
	return &ConvertScriptLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

// Convert - Validate, create a pending task, then hand off execution to the async runner.
func (l *ConvertScriptLogic) Convert(userID int64, req *types.ConvertScriptReq) (*types.ConvertScriptResp, error) {
	if userID <= 0 {
		return nil, errorn.New(http.StatusBadRequest, "invalid user id")
	}
	if err := validateConvertScriptReq(req); err != nil {
		return nil, err
	}

	convertReq := buildConvertRequest(req)
	taskID := service.GenerateTaskID()
	logCtx := service.WithTaskLogContext(l.c, taskID, time.Now())
	l.Debug("script convert request accepted",
		service.TaskLogFields(logCtx, "accepted",
			zap.Int64("user_id", userID),
			zap.Int("chapters", len(req.Chapters)),
			zap.String("genre", req.Genre),
			zap.String("tone", req.Tone),
			zap.String("pacing", req.Pacing),
		)...,
	)
	scriptTask, err := createPendingScriptTask(l.c, l.svc, userID, convertReq, taskID, "")
	if err != nil {
		l.Error("failed to create script task", zap.Error(err))
		return nil, errorn.New(http.StatusInternalServerError, "failed to create task")
	}
	l.Debug("script task created",
		service.TaskLogFields(logCtx, "task_created",
			zap.Int64("row_id", scriptTask.ID),
		)...,
	)

	if err := l.svc.ConvertRunner.Enqueue(service.AsyncConvertJob{
		Task:    scriptTask,
		Request: convertReq,
	}); err != nil {
		l.Error("failed to enqueue script conversion", service.TaskLogFields(logCtx, "enqueue_failed", zap.Error(err))...)
		markScriptTaskFailed(l.c, l.svc.ScriptTaskModel, scriptTask, err)
		return nil, errorn.New(http.StatusServiceUnavailable, "conversion queue is busy, please retry")
	}
	l.Debug("script convert job enqueued",
		service.TaskLogFields(logCtx, "queued",
			zap.Int("chapters", len(convertReq.Chapters)),
		)...,
	)

	return &types.ConvertScriptResp{
		ID:        taskID,
		Status:    scriptTask.Status,
		DetailURL: "/api/v1/script/" + taskID,
		EventURL:  "/api/v1/script/" + taskID + "/events",
	}, nil
}

func truncateErr(msg string, max int) string {
	if len(msg) <= max {
		return msg
	}
	return msg[:max]
}
