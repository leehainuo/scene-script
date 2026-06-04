package user

import (
	"context"
	"net/http"

	"go.uber.org/zap"

	"scene-script/internal/model"
	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

type UpdateUserLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewUpdateUserLogic(c context.Context, svc *svc.ServiceContext) *UpdateUserLogic {
	return &UpdateUserLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *UpdateUserLogic) Update(req *types.UpdateUserReq) error {
	// Check if user exists
	existUser, err := l.svc.UserModel.FindOne(l.c, req.ID)
	if err != nil {
		l.Error("Failed to check user", zap.Error(err))
		return errorn.NewDefault("System error")
	}
	if existUser == nil {
		return errorn.New(http.StatusNotFound, "User not found")
	}

	// Update user
	user := &model.User{
		ID:       req.ID,
		Username: req.Username,
		Email:    req.Email,
	}

	if err := l.svc.UserModel.Update(l.c, user); err != nil {
		l.Error("Failed to update user",
			zap.Error(err),
			zap.Int64("user_id", req.ID))
		return errorn.NewDefault("Failed to update user")
	}

	l.Info("User updated", zap.Int64("user_id", req.ID))

	return nil
}
