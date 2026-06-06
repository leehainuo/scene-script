package script

import (
	"context"
	"net/http"

	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

// ListScriptLogic returns the authenticated user's paginated script tasks.
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

// List - Return paginated task list for the authenticated user.
func (l *ListScriptLogic) List(userID int64, req *types.ListScriptReq) (*types.ListScriptResp, error) {
	if userID <= 0 {
		return nil, errorn.New(http.StatusBadRequest, "invalid user id")
	}
	if req == nil {
		req = &types.ListScriptReq{}
	}
	page := req.Page
	if page <= 0 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := int64((page - 1) * pageSize)

	rows, err := l.svc.ScriptTaskModel.ListByUser(l.c, userID, int64(pageSize), offset)
	if err != nil {
		return nil, err
	}
	total, err := l.svc.ScriptTaskModel.CountByUser(l.c, userID)
	if err != nil {
		return nil, err
	}

	resp := &types.ListScriptResp{
		Items:    make([]types.ScriptTaskItem, 0, len(rows)),
		Page:     page,
		PageSize: pageSize,
		Total:    total,
	}
	for _, r := range rows {
		resp.Items = append(resp.Items, types.ScriptTaskItem{
			ID:             r.TaskID,
			Title:          r.Title,
			Genre:          r.Genre,
			Tone:           r.Tone,
			Pacing:         r.Pacing,
			SourceChapters: r.SourceChapters,
			Status:         r.Status,
			ErrMsg:         r.ErrMsg,
			CreatedAt:      r.CreatedAt,
			UpdatedAt:      r.UpdatedAt,
		})
	}

	return resp, nil
}
