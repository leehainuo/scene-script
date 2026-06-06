package script

import (
	"context"
	"net/http"
	"strings"

	"scene-script/internal/model"
	"scene-script/internal/service"
	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/errorn"
	"scene-script/pkg/stores/sqlx"
)

const (
	minConvertChapters = 3
	maxConvertChapters = 12
)

func validateConvertScriptReq(req *types.ConvertScriptReq) error {
	if len(req.Chapters) < minConvertChapters || len(req.Chapters) > maxConvertChapters {
		return errorn.New(http.StatusBadRequest, "chapter count must be between 3 and 12")
	}
	if req.Genre == "" || req.Tone == "" || req.Pacing == "" {
		return errorn.New(http.StatusBadRequest, "genre, tone, and pacing are required")
	}
	for _, chapter := range req.Chapters {
		if strings.TrimSpace(chapter.Title) == "" || strings.TrimSpace(chapter.Text) == "" {
			return errorn.New(http.StatusBadRequest, "each chapter requires non-empty title and text")
		}
	}
	return nil
}

func buildConvertRequest(req *types.ConvertScriptReq) service.ConvertRequest {
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

func createPendingScriptTask(
	ctx context.Context,
	svcCtx *svc.ServiceContext,
	userID int64,
	convertReq service.ConvertRequest,
	taskID string,
	taskTitle string,
) (*model.ScriptTask, error) {
	if strings.TrimSpace(taskID) == "" {
		taskID = service.GenerateTaskID()
	}
	if strings.TrimSpace(taskTitle) == "" {
		taskTitle = service.BuildInitialTaskTitle(convertReq.Chapters, convertReq.Genre)
	}

	scriptTask := &model.ScriptTask{
		TaskID:         taskID,
		UserID:         userID,
		Title:          taskTitle,
		Genre:          convertReq.Genre,
		Tone:           convertReq.Tone,
		Pacing:         convertReq.Pacing,
		SourceChapters: len(convertReq.Chapters),
		Status:         "pending",
	}

	err := svcCtx.DB.TransactCtx(ctx, func(ctx context.Context, conn sqlx.SqlConn) error {
		taskModel := model.NewScriptTaskModel(conn)
		chapterModel := model.NewScriptChapterModel(conn)

		insertID, err := taskModel.Insert(ctx, scriptTask)
		if err != nil {
			return err
		}
		scriptTask.ID = insertID

		chapterRows := make([]*model.ScriptChapter, 0, len(convertReq.Chapters))
		for i, chapter := range convertReq.Chapters {
			chapterRows = append(chapterRows, &model.ScriptChapter{
				TaskID:       scriptTask.TaskID,
				ChapterIndex: i + 1,
				ChapterTitle: chapter.Title,
				ChapterText:  chapter.Text,
			})
		}

		// Persist the input snapshot in one batch so later retry/delete flows can
		// recover all chapters with a single query and avoid N+1 lookups.
		return chapterModel.InsertBatch(ctx, chapterRows)
	})
	if err != nil {
		return nil, err
	}

	return scriptTask, nil
}

func markScriptTaskFailed(ctx context.Context, taskModel model.ScriptTaskModel, scriptTask *model.ScriptTask, err error) {
	scriptTask.Status = "failed"
	scriptTask.ErrMsg = truncateErr(err.Error(), 1024)
	_ = taskModel.Update(ctx, scriptTask)
}
