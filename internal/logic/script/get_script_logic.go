package script

import (
	"context"
	"encoding/json"
	"net/http"

	"scene-script/internal/model"
	"scene-script/internal/svc"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

// GetScriptLogic - Get script task detail (placeholder)
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

// Get - Return task detail by taskID (TODO: implement DB query)
type GetScriptResp struct {
	ID                string            `json:"id"`
	YAML              string            `json:"yaml"`
	Summary           map[string]any    `json:"summary"`
	ConsistencyReport map[string]any    `json:"consistency_report"`
	Metadata          *model.ScriptTask `json:"metadata,omitempty"`
}

func (l *GetScriptLogic) Get(taskID string) (*GetScriptResp, error) {
	if taskID == "" {
		return nil, errorn.New(http.StatusBadRequest, "task id is required")
	}

	task, err := l.svc.ScriptTaskModel.FindByTaskID(l.c, taskID)
	if err != nil {
		return nil, err
	}

	result, err := l.svc.ScriptResultModel.FindByTaskID(l.c, taskID)
	if err != nil {
		return nil, err
	}

	// parse summary and consistency json (if empty, return empty map)
	summary := map[string]any{}
	if result.SummaryJSON != "" {
		_ = json.Unmarshal([]byte(result.SummaryJSON), &summary)
	}
	consistency := map[string]any{}
	if result.ConsistencyJSON != "" {
		_ = json.Unmarshal([]byte(result.ConsistencyJSON), &consistency)
	}

	resp := &GetScriptResp{
		ID:                taskID,
		YAML:              result.Yaml,
		Summary:           summary,
		ConsistencyReport: consistency,
		Metadata:          task,
	}

	return resp, nil
}
