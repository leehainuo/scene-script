package script

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"

	"scene-script/internal/model"
	"scene-script/internal/service"
	"scene-script/internal/svc"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
	"scene-script/pkg/stores/sqlx"
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

// Convert - Validate, call LLM, parse YAML, persist task & result
func (l *ConvertScriptLogic) Convert(userID int64, req *model.ConvertRequest) (*model.ConvertResponse, error) {
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
	scriptTask.Status = "running"
	updateErr := l.svc.ScriptTaskModel.Update(l.c, scriptTask)
	if updateErr != nil {
		l.Error("failed to mark script task running", zap.Error(updateErr))
		return nil, errorn.New(http.StatusInternalServerError, "failed to update task status")
	}

	convertReq := service.ConvertRequest{
		Chapters: make([]service.ChapterInput, len(req.Chapters)),
		Genre:    req.Genre,
		Tone:     req.Tone,
		Pacing:   req.Pacing,
	}
	for i, ch := range req.Chapters {
		convertReq.Chapters[i] = service.ChapterInput{Title: ch.Title, Text: ch.Text}
	}

	result, err := l.svc.ScriptConverter.Convert(l.c, convertReq)
	if err != nil {
		l.Error("script conversion failed", zap.Error(err))
		l.markTaskFailed(scriptTask, err)
		return nil, l.mapConvertError(err)
	}

	if err := l.persistSuccess(scriptTask, req, result); err != nil {
		l.Error("failed to persist script conversion result", zap.Error(err))
		l.markTaskFailed(scriptTask, err)
		return nil, errorn.New(http.StatusInternalServerError, "failed to store conversion result")
	}

	return &model.ConvertResponse{
		ID:                taskID,
		YAML:              result.YAML,
		Summary:           result.Summary,
		ConsistencyReport: result.ConsistencyReport,
	}, nil
}

func (l *ConvertScriptLogic) persistSuccess(scriptTask *model.ScriptTask, req *model.ConvertRequest, result *service.ConvertResult) error {
	return l.svc.DB.TransactCtx(l.c, func(ctx context.Context, conn sqlx.SqlConn) error {
		taskModel := model.NewScriptTaskModel(conn)
		chapterModel := model.NewScriptChapterModel(conn)
		resultModel := model.NewScriptResultModel(conn)

		chapterRows := make([]*model.ScriptChapter, 0, len(req.Chapters))
		for i, chapter := range req.Chapters {
			chapterRows = append(chapterRows, &model.ScriptChapter{
				TaskID:       scriptTask.TaskID,
				ChapterIndex: i + 1,
				ChapterTitle: chapter.Title,
				ChapterText:  chapter.Text,
			})
		}

		// Batch chapter persistence keeps related writes inside one transaction and avoids N+1-style per-row readback patterns.
		if err := chapterModel.InsertBatch(ctx, chapterRows); err != nil {
			return err
		}

		summaryJSON, err := json.Marshal(result.Summary)
		if err != nil {
			return err
		}
		consistencyJSON, err := json.Marshal(result.ConsistencyReport)
		if err != nil {
			return err
		}

		if _, err := resultModel.Insert(ctx, &model.ScriptResult{
			TaskID:          scriptTask.TaskID,
			Yaml:            result.YAML,
			SummaryJSON:     string(summaryJSON),
			ConsistencyJSON: string(consistencyJSON),
			GeneratedAt:     time.Now(),
		}); err != nil {
			return err
		}

		scriptTask.Status = "succeeded"
		scriptTask.ErrMsg = ""
		return taskModel.Update(ctx, scriptTask)
	})
}

func (l *ConvertScriptLogic) markTaskFailed(scriptTask *model.ScriptTask, err error) {
	scriptTask.Status = "failed"
	scriptTask.ErrMsg = truncateErr(err.Error(), 1024)
	if updateErr := l.svc.ScriptTaskModel.Update(l.c, scriptTask); updateErr != nil {
		l.Error("failed to mark script task failed", zap.Error(updateErr))
	}
}

func (l *ConvertScriptLogic) mapConvertError(err error) error {
	var convertErr *service.ConvertError
	if errors.As(err, &convertErr) {
		switch convertErr.Code {
		case service.ConvertErrorLLM:
			if errors.Is(err, context.DeadlineExceeded) {
				return errorn.New(http.StatusGatewayTimeout, "llm generation timed out")
			}
			return errorn.New(http.StatusBadGateway, "llm generation failed")
		case service.ConvertErrorYAMLParse:
			return errorn.New(http.StatusBadGateway, "llm returned invalid yaml")
		case service.ConvertErrorSchema:
			return errorn.New(http.StatusBadGateway, "llm returned yaml that does not match schema")
		default:
			return errorn.New(http.StatusInternalServerError, "conversion failed")
		}
	}
	return errorn.New(http.StatusInternalServerError, "conversion failed")
}

func truncateErr(msg string, max int) string {
	if len(msg) <= max {
		return msg
	}
	return msg[:max]
}
