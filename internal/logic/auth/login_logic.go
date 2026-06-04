package auth

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

type LoginLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewLoginLogic(c context.Context, svc *svc.ServiceContext) *LoginLogic {
	return &LoginLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *LoginLogic) Login(req *types.LoginReq) (*types.LoginResp, error) {
	// Find user by username
	user, err := l.svc.UserModel.FindByUsername(l.c, req.Username)
	if err != nil {
		if err == model.ErrNotFound {
			return nil, errorn.New(http.StatusUnauthorized, "用户名或密码错误")
		}
		l.Error("Failed to find user", zap.Error(err), zap.String("username", req.Username))
		return nil, errorn.NewDefault("系统错误")
	}

	// Verify password
	if !crypton.ComparePassword(user.Password, req.Password) {
		l.Warn("Invalid password attempt", zap.String("username", req.Username))
		return nil, errorn.New(http.StatusUnauthorized, "Invalid username or password")
	}

	// Generate access token
	accessToken, err := l.svc.Token.GenerateAccessToken(user.ID, user.Username)
	if err != nil {
		l.Error("Failed to generate access token", zap.Error(err))
		return nil, errorn.NewDefault("Failed to generate token")
	}

	// Generate refresh token
	refreshToken, err := l.svc.Token.GenerateRefreshToken(user.ID, user.Username)
	if err != nil {
		l.Error("Failed to generate refresh token", zap.Error(err))
		return nil, errorn.NewDefault("Failed to generate token")
	}

	l.Info("User logged in", zap.Int64("user_id", user.ID), zap.String("username", user.Username))

	return &types.LoginResp{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    l.svc.Token.GetAccessExpireTime(),
		UserID:       user.ID,
		Username:     user.Username,
	}, nil
}
