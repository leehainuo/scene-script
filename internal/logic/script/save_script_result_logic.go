package script

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"go.uber.org/zap"

	"scene-script/internal/model"
	"scene-script/internal/service"
	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
	"scene-script/pkg/stores/sqlx"
)

// SaveScriptResultLogic persists edited script YAML for an existing task.
type SaveScriptResultLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

// NewSaveScriptResultLogic creates a new save logic instance.
func NewSaveScriptResultLogic(c context.Context, svc *svc.ServiceContext) *SaveScriptResultLogic {
	return &SaveScriptResultLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

// Save validates edited YAML, rewrites normalized result payloads, and returns
// the latest task detail shape for direct frontend refresh.
func (l *SaveScriptResultLogic) Save(userID int64, req *types.SaveScriptResultReq) (*types.GetScriptResp, error) {
	if userID <= 0 {
		return nil, errorn.New(http.StatusBadRequest, "invalid user id")
	}
	if req == nil || strings.TrimSpace(req.ID) == "" {
		return nil, errorn.New(http.StatusBadRequest, "task id is required")
	}
	if strings.TrimSpace(req.YAML) == "" {
		return nil, errorn.New(http.StatusBadRequest, "yaml is required")
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
	if task.Status != "succeeded" {
		return nil, errorn.New(http.StatusBadRequest, "only succeeded script can be edited")
	}

	resultRow, err := l.svc.ScriptResultModel.FindByTaskID(l.c, req.ID)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, errorn.New(http.StatusNotFound, "script result not found")
		}
		return nil, err
	}

	normalized, err := l.svc.ScriptConverter.NormalizeEditedYAML(
		req.YAML,
		task.Genre,
		task.Tone,
		task.Pacing,
		task.SourceChapters,
	)
	if err != nil {
		return nil, l.mapSaveError(err)
	}

	if err := l.persistEditedResult(task, resultRow, normalized); err != nil {
		l.Error("failed to persist edited script result", zap.Error(err))
		return nil, errorn.New(http.StatusInternalServerError, "failed to save edited script result")
	}

	return NewGetScriptLogic(l.c, l.svc).Get(userID, &types.GetScriptReq{ID: req.ID})
}

func (l *SaveScriptResultLogic) persistEditedResult(task *model.ScriptTask, resultRow *model.ScriptResult, normalized *service.ConvertResult) error {
	summaryJSON, err := json.Marshal(normalized.Summary)
	if err != nil {
		return err
	}
	consistencyJSON, err := json.Marshal(normalized.ConsistencyReport)
	if err != nil {
		return err
	}

	return l.svc.DB.TransactCtx(l.c, func(ctx context.Context, conn sqlx.SqlConn) error {
		taskModel := model.NewScriptTaskModel(conn)
		resultModel := model.NewScriptResultModel(conn)

		resultRow.Yaml = normalized.YAML
		resultRow.SummaryJSON = string(summaryJSON)
		resultRow.ConsistencyJSON = string(consistencyJSON)

		// Edited-result persistence updates the result row in one transaction and avoids
		// any per-chapter read/write loops, preventing unnecessary N+1-style database work.
		if err := resultModel.Update(ctx, resultRow); err != nil {
			return err
		}

		task.Status = "succeeded"
		task.ErrMsg = ""
		return taskModel.Update(ctx, task)
	})
}

func (l *SaveScriptResultLogic) mapSaveError(err error) error {
	var convertErr *service.ConvertError
	if !errors.As(err, &convertErr) {
		return errorn.New(http.StatusInternalServerError, "failed to validate edited yaml")
	}

	switch convertErr.Code {
	case service.ConvertErrorYAMLParse, service.ConvertErrorSchema:
		return errorn.New(http.StatusBadRequest, convertErr.Error())
	case service.ConvertErrorSerialization:
		return errorn.New(http.StatusInternalServerError, "failed to serialize edited yaml")
	default:
		return errorn.New(http.StatusInternalServerError, "failed to validate edited yaml")
	}
}
