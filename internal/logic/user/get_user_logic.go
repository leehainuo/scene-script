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

type GetUserLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewGetUserLogic(c context.Context, svc *svc.ServiceContext) *GetUserLogic {
	return &GetUserLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *GetUserLogic) Get(req *types.GetUserReq) (*types.GetUserResp, error) {
	user, err := l.svc.UserModel.FindOne(l.c, req.ID)
	if err != nil {
		l.Error("Failed to get user", zap.Error(err), zap.Int64("user_id", req.ID))
		return nil, errorn.NewDefault("Failed to get user")
	}
	if user == nil {
		return nil, errorn.New(http.StatusNotFound, "User not found")
	}

	return &types.GetUserResp{
		ID:       user.ID,
		Username: user.Username,
		Email:    user.Email,
	}, nil
}
