package auth

import (
	"context"
	"net/http"

	"go.uber.org/zap"

	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
	"scene-script/pkg/token"
)

type RefreshLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewRefreshLogic(c context.Context, svc *svc.ServiceContext) *RefreshLogic {
	return &RefreshLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *RefreshLogic) Refresh(req *types.RefreshReq) (*types.RefreshResp, error) {
	// Parse refresh token
	claims, err := l.svc.Token.ParseToken(req.RefreshToken)
	if err != nil {
		l.Warn("Invalid refresh token", zap.Error(err))
		return nil, errorn.New(http.StatusUnauthorized, "Invalid refresh token")
	}

	// Check token type
	if claims.TokenType != token.RefreshToken {
		l.Warn("Token is not refresh token", zap.Int64("user_id", claims.UserID))
		return nil, errorn.New(http.StatusUnauthorized, "Invalid token type")
	}

	// Check if token is in blacklist
	blacklisted, err := l.svc.Redis.Exists(l.c, "blacklist:refresh:"+req.RefreshToken)
	if err != nil {
		l.Error("Failed to check blacklist", zap.Error(err))
		return nil, errorn.NewDefault("System error")
	}
	if blacklisted {
		l.Warn("Refresh token is blacklisted", zap.Int64("user_id", claims.UserID))
		return nil, errorn.New(http.StatusUnauthorized, "Token has been revoked")
	}

	// Generate new access token
	accessToken, err := l.svc.Token.GenerateAccessToken(claims.UserID, claims.Username)
	if err != nil {
		l.Error("Failed to generate access token", zap.Error(err))
		return nil, errorn.NewDefault("Failed to generate token")
	}

	l.Info("Token refreshed", zap.Int64("user_id", claims.UserID))

	return &types.RefreshResp{
		AccessToken: accessToken,
		ExpiresIn:   l.svc.Token.GetAccessExpireTime(),
	}, nil
}
