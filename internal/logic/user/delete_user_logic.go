package user

import (
	"context"
	"net/http"

	"go.uber.org/zap"

	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

type DeleteUserLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewDeleteUserLogic(c context.Context, svc *svc.ServiceContext) *DeleteUserLogic {
	return &DeleteUserLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *DeleteUserLogic) Delete(req *types.DeleteUserReq) error {
	// Check if user exists
	existUser, err := l.svc.UserModel.FindOne(l.c, req.ID)
	if err != nil {
		l.Error("Failed to check user", zap.Error(err))
		return errorn.NewDefault("System error")
	}
	if existUser == nil {
		return errorn.New(http.StatusNotFound, "User not found")
	}

	// Delete user
	if err := l.svc.UserModel.Delete(l.c, req.ID); err != nil {
		l.Error("Failed to delete user",
			zap.Error(err),
			zap.Int64("user_id", req.ID))
		return errorn.NewDefault("Failed to delete user")
	}

	l.Info("User deleted", zap.Int64("user_id", req.ID))

	return nil
}
