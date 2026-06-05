package script

import (
	"context"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"

	"scene-script/internal/model"
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
	if len(req.Chapters) < 3 {
		return nil, errorn.New(http.StatusBadRequest, "minimum 3 chapters required")
	}
	if req.Genre == "" || req.Tone == "" || req.Pacing == "" {
		return nil, errorn.New(http.StatusBadRequest, "genre, tone, and pacing are required")
	}
	for _, chapter := range req.Chapters {
		if strings.TrimSpace(chapter.Title) == "" || strings.TrimSpace(chapter.Text) == "" {
			return nil, errorn.New(http.StatusBadRequest, "each chapter requires non-empty title and text")
		}
	}

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
	scriptTask := &model.ScriptTask{
		TaskID:         taskID,
		UserID:         userID,
		Title:          req.Chapters[0].Title,
		Genre:          req.Genre,
		Tone:           req.Tone,
		Pacing:         req.Pacing,
		SourceChapters: len(req.Chapters),
		Status:         "pending",
	}
	insertID, err := l.svc.ScriptTaskModel.Insert(l.c, scriptTask)
	if err != nil {
		l.Error("failed to create script task", zap.Error(err))
		return nil, errorn.New(http.StatusInternalServerError, "failed to create task")
	}
	scriptTask.ID = insertID
	l.Debug("script task created",
		service.TaskLogFields(logCtx, "task_created",
			zap.Int64("row_id", insertID),
		)...,
	)

	convertReq := l.buildConvertRequest(req)
	if err := l.svc.ConvertRunner.Enqueue(service.AsyncConvertJob{
		Task:    scriptTask,
		Request: convertReq,
	}); err != nil {
		l.Error("failed to enqueue script conversion", service.TaskLogFields(logCtx, "enqueue_failed", zap.Error(err))...)
		l.markTaskFailed(scriptTask, err)
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

func (l *ConvertScriptLogic) buildConvertRequest(req *types.ConvertScriptReq) service.ConvertRequest {
	convertReq := service.ConvertRequest{
		Chapters: make([]service.ChapterInput, len(req.Chapters)),
		Genre:    req.Genre,
		Tone:     req.Tone,
		Pacing:   req.Pacing,
	}
	for i, ch := range req.Chapters {
		convertReq.Chapters[i] = service.ChapterInput{
			Title: ch.Title,
			Text:  ch.Text,
		}
	}
	return convertReq
}

func (l *ConvertScriptLogic) markTaskFailed(scriptTask *model.ScriptTask, err error) {
	scriptTask.Status = "failed"
	scriptTask.ErrMsg = truncateErr(err.Error(), 1024)
	if updateErr := l.svc.ScriptTaskModel.Update(l.c, scriptTask); updateErr != nil {
		l.Error("failed to mark script task failed", zap.Error(updateErr))
	}
}

func truncateErr(msg string, max int) string {
	if len(msg) <= max {
		return msg
	}
	return msg[:max]
}
