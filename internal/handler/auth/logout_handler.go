package auth

import (
	"strings"

	"github.com/gin-gonic/gin"

	"scene-script/internal/logic/auth"
	"scene-script/internal/middleware"
	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/httpn"
)

func LogoutHandler(svc *svc.ServiceContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get access token from header
		authHeader := c.GetHeader(middleware.AuthorizationHeader)
		accessToken := ""
		if authHeader != "" && strings.HasPrefix(authHeader, middleware.BearerPrefix) {
			accessToken = strings.TrimPrefix(authHeader, middleware.BearerPrefix)
		}

		// Get refresh token from request body (optional)
		var req types.LogoutReq
		_ = c.ShouldBindJSON(&req)

		l := auth.NewLogoutLogic(c.Request.Context(), svc)
		if err := l.Logout(accessToken, req.RefreshToken); err != nil {
			httpn.HandleError(c, err)
			return
		}

		httpn.Ok(c, nil)
	}
}
