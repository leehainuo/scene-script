package auth

import (
	"context"
	"time"

	"go.uber.org/zap"

	"scene-script/internal/svc"
	"scene-script/pkg/logn"
)

type LogoutLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewLogoutLogic(c context.Context, svc *svc.ServiceContext) *LogoutLogic {
	return &LogoutLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *LogoutLogic) Logout(accessToken, refreshToken string) error {
	// Parse access token to get user info
	claims, err := l.svc.Token.ParseToken(accessToken)
	if err != nil {
		// Token already invalid, just log it
		l.Warn("Failed to parse access token during logout", zap.Error(err))
	}

	// Add access token to blacklist
	if accessToken != "" {
		expireTime := l.svc.Token.GetAccessExpireTime()
		if err := l.svc.Redis.SetEx(l.c, "blacklist:access:"+accessToken, "1", time.Duration(expireTime)*time.Second); err != nil {
			l.Error("Failed to blacklist access token", zap.Error(err))
			// Continue to blacklist refresh token
		}
	}

	// Add refresh token to blacklist (more important)
	if refreshToken != "" {
		expireTime := l.svc.Token.GetRefreshExpireTime()
		if err := l.svc.Redis.SetEx(l.c, "blacklist:refresh:"+refreshToken, "1", time.Duration(expireTime)*time.Second); err != nil {
			l.Error("Failed to blacklist refresh token", zap.Error(err))
			return err
		}
	}

	if claims != nil {
		l.Info("User logged out", zap.Int64("user_id", claims.UserID), zap.String("username", claims.Username))
	} else {
		l.Info("User logged out (invalid token)")
	}

	return nil
}
