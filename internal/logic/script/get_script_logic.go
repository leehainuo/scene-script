package script

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"scene-script/internal/model"
	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

// GetScriptLogic returns script task detail scoped to the authenticated user.
type GetScriptLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

// NewGetScriptLogic - Constructor
func NewGetScriptLogic(c context.Context, svc *svc.ServiceContext) *GetScriptLogic {
	return &GetScriptLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

// Get - Return task detail scoped to the authenticated user.
func (l *GetScriptLogic) Get(userID int64, req *types.GetScriptReq) (*types.GetScriptResp, error) {
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

	summary := model.ScriptSummary{}
	consistency := model.ConsistencyReport{
		RolesMissing:    []string{},
		SettingsMissing: []string{},
		DanglingRefs:    []string{},
	}

	resp := &types.GetScriptResp{
		ID: req.ID,
		Metadata: types.ScriptTaskMeta{
			ID:             task.TaskID,
			Title:          task.Title,
			Genre:          task.Genre,
			Tone:           task.Tone,
			Pacing:         task.Pacing,
			SourceChapters: task.SourceChapters,
			Status:         task.Status,
			ErrMsg:         task.ErrMsg,
			CreatedAt:      task.CreatedAt,
			UpdatedAt:      task.UpdatedAt,
		},
		Summary:           summary,
		ConsistencyReport: consistency,
	}

	if task.Status != "succeeded" {
		return resp, nil
	}

	result, err := l.svc.ScriptResultModel.FindByTaskID(l.c, req.ID)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, errorn.New(http.StatusNotFound, "script result not found")
		}
		return nil, err
	}
	if result.SummaryJSON != "" {
		if err := json.Unmarshal([]byte(result.SummaryJSON), &summary); err != nil {
			return nil, errorn.New(http.StatusInternalServerError, "failed to decode script summary")
		}
	}
	if result.ConsistencyJSON != "" {
		if err := json.Unmarshal([]byte(result.ConsistencyJSON), &consistency); err != nil {
			return nil, errorn.New(http.StatusInternalServerError, "failed to decode script consistency report")
		}
	}

	resp.YAML = result.Yaml
	resp.Summary = summary
	resp.ConsistencyReport = consistency
	return resp, nil
}
