package script

import (
	"context"
	"errors"
	"net/http"

	"scene-script/internal/model"
	"scene-script/internal/svc"
	"scene-script/pkg/errorn"
)

func findOwnedScriptTask(
	ctx context.Context,
	svcCtx *svc.ServiceContext,
	userID int64,
	taskID string,
) (*model.ScriptTask, error) {
	if userID <= 0 {
		return nil, errorn.New(http.StatusBadRequest, "invalid user id")
	}
	if taskID == "" {
		return nil, errorn.New(http.StatusBadRequest, "task id is required")
	}

	task, err := svcCtx.ScriptTaskModel.FindByTaskID(ctx, taskID)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, errorn.New(http.StatusNotFound, "script task not found")
		}
		return nil, err
	}
	if task.UserID != userID {
		return nil, errorn.New(http.StatusNotFound, "script task not found")
	}

	return task, nil
}
