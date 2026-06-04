package script

import (
	"context"
	"net/http"

	"scene-script/internal/model"
	"scene-script/internal/svc"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

// ListScriptLogic - List script tasks (placeholder for future DB query)
type ListScriptLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

// NewListScriptLogic - Constructor
func NewListScriptLogic(c context.Context, svc *svc.ServiceContext) *ListScriptLogic {
	return &ListScriptLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

// List - Return task list for a user (TODO: implement DB query)
type ListScriptResp struct {
	Tasks []model.ScriptTask `json:"tasks"`
}

func (l *ListScriptLogic) List(userID any) (*ListScriptResp, error) {
	uid, ok := userID.(int64)
	if !ok {
		return nil, errorn.New(http.StatusBadRequest, "invalid user id")
	}

	// 默认分页：limit 20 offset 0，可后续扩展 query 参数
	rows, err := l.svc.ScriptTaskModel.ListByUser(l.c, uid, 20, 0)
	if err != nil {
		return nil, err
	}

	resp := &ListScriptResp{Tasks: make([]model.ScriptTask, 0, len(rows))}
	for _, r := range rows {
		resp.Tasks = append(resp.Tasks, *r)
	}

	return resp, nil
}
