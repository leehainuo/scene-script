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
	"scene-script/pkg/utils/crypton"
)

type CreateUserLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewCreateUserLogic(c context.Context, svc *svc.ServiceContext) *CreateUserLogic {
	return &CreateUserLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *CreateUserLogic) Create(req *types.CreateUserReq) (*types.CreateUserResp, error) {
	// Check if username exists
	existUser, err := l.svc.UserModel.FindByUsername(l.c, req.Username)
	if err != nil {
		l.Error("Failed to check username", zap.Error(err))
		return nil, errorn.NewDefault("System error")
	}
	if existUser != nil {
		return nil, errorn.New(http.StatusBadRequest, "Username already exists")
	}

	// Hash password
	hashedPassword, err := crypton.HashPassword(req.Password)
	if err != nil {
		l.Error("Failed to hash password", zap.Error(err))
		return nil, errorn.NewDefault("Failed to encrypt password")
	}

	// Insert user
	user := &model.User{
		Username: req.Username,
		Email:    req.Email,
		Password: string(hashedPassword),
	}

	id, err := l.svc.UserModel.Insert(l.c, user)
	if err != nil {
		l.Error("Failed to create user",
			zap.Error(err),
			zap.String("username", req.Username))
		return nil, errorn.NewDefault("Failed to create user")
	}

	l.Info("User created",
		zap.Int64("user_id", id),
		zap.String("username", req.Username))

	return &types.CreateUserResp{
		ID:       id,
		Username: req.Username,
		Email:    req.Email,
	}, nil
}
