package script

import (
	"context"
	"errors"
	"net/http"
	"time"

	"go.uber.org/zap"

	"scene-script/internal/model"
	"scene-script/internal/service"
	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

type RetryScriptLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewRetryScriptLogic(c context.Context, svc *svc.ServiceContext) *RetryScriptLogic {
	return &RetryScriptLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *RetryScriptLogic) Retry(userID int64, req *types.RetryScriptReq) (*types.ConvertScriptResp, error) {
	if userID <= 0 {
		return nil, errorn.New(http.StatusBadRequest, "invalid user id")
	}
	if req == nil || req.ID == "" {
		return nil, errorn.New(http.StatusBadRequest, "task id is required")
	}

	failedTask, err := l.svc.ScriptTaskModel.FindByTaskID(l.c, req.ID)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, errorn.New(http.StatusNotFound, "script task not found")
		}
		return nil, err
	}
	if failedTask.UserID != userID {
		return nil, errorn.New(http.StatusNotFound, "script task not found")
	}
	if failedTask.Status != "failed" {
		return nil, errorn.New(http.StatusConflict, "only failed works can be retried")
	}

	chapterRows, err := l.svc.ScriptChapterModel.ListByTaskID(l.c, failedTask.TaskID)
	if err != nil {
		return nil, err
	}
	if len(chapterRows) == 0 {
		return nil, errorn.New(http.StatusConflict, "this failed work was created before retry snapshots were enabled; please retry from workspace")
	}

	convertReq := service.ConvertRequest{
		Chapters: make([]service.ChapterInput, 0, len(chapterRows)),
		Genre:    failedTask.Genre,
		Tone:     failedTask.Tone,
		Pacing:   failedTask.Pacing,
	}
	for _, chapter := range chapterRows {
		convertReq.Chapters = append(convertReq.Chapters, service.ChapterInput{
			Title: chapter.ChapterTitle,
			Text:  chapter.ChapterText,
		})
	}

	retryTask, err := createPendingScriptTask(l.c, l.svc, userID, convertReq, "", failedTask.Title)
	if err != nil {
		l.Error("failed to create retry task", zap.Error(err))
		return nil, errorn.New(http.StatusInternalServerError, "failed to create retry task")
	}

	logCtx := service.WithTaskLogContext(l.c, retryTask.TaskID, time.Now())
	l.Debug("script retry task created",
		service.TaskLogFields(logCtx, "task_created",
			zap.String("source_task_id", failedTask.TaskID),
			zap.Int64("row_id", retryTask.ID),
			zap.Int("chapters", len(convertReq.Chapters)),
		)...,
	)

	if err := l.svc.ConvertRunner.Enqueue(service.AsyncConvertJob{
		Task:    retryTask,
		Request: convertReq,
	}); err != nil {
		l.Error("failed to enqueue retry script conversion", service.TaskLogFields(logCtx, "enqueue_failed", zap.Error(err))...)
		markScriptTaskFailed(l.c, l.svc.ScriptTaskModel, retryTask, err)
		return nil, errorn.New(http.StatusServiceUnavailable, "conversion queue is busy, please retry")
	}

	l.Debug("script retry job enqueued",
		service.TaskLogFields(logCtx, "queued",
			zap.String("source_task_id", failedTask.TaskID),
			zap.Int("chapters", len(convertReq.Chapters)),
		)...,
	)

	return &types.ConvertScriptResp{
		ID:        retryTask.TaskID,
		Status:    retryTask.Status,
		DetailURL: "/api/v1/script/" + retryTask.TaskID,
		EventURL:  "/api/v1/script/" + retryTask.TaskID + "/events",
	}, nil
}
