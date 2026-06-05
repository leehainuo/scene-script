package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"scene-script/internal/svc"
	"scene-script/pkg/httpn"
)

const (
	AuthorizationHeader = "Authorization"
	BearerPrefix        = "Bearer "
	UserIDKey           = "user_id"
	UsernameKey         = "username"
)

// AuthMiddleware - JWT authentication middleware
func AuthMiddleware(svc *svc.ServiceContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get token from header. SSE/EventSource cannot attach custom Authorization
		// headers, so `/events` endpoints may pass the access token through query
		// params to keep the stream usable without weakening other routes.
		authHeader := c.GetHeader(AuthorizationHeader)
		if authHeader == "" && allowQueryAccessToken(c) {
			if tokenFromQuery := strings.TrimSpace(c.Query("access_token")); tokenFromQuery != "" {
				authHeader = BearerPrefix + tokenFromQuery
			}
		}
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, httpn.Response{
				Code: http.StatusUnauthorized,
				Msg:  "Missing authorization header",
			})
			c.Abort()
			return
		}

		// Check Bearer prefix
		if !strings.HasPrefix(authHeader, BearerPrefix) {
			c.JSON(http.StatusUnauthorized, httpn.Response{
				Code: http.StatusUnauthorized,
				Msg:  "Invalid authorization format",
			})
			c.Abort()
			return
		}

		// Extract token
		tokenString := strings.TrimPrefix(authHeader, BearerPrefix)

		// Parse and validate token
		claims, err := svc.Token.ParseToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, httpn.Response{
				Code: http.StatusUnauthorized,
				Msg:  "Invalid or expired token",
			})
			c.Abort()
			return
		}

		// Check token type (must be access token)
		if claims.TokenType != "access" {
			c.JSON(http.StatusUnauthorized, httpn.Response{
				Code: http.StatusUnauthorized,
				Msg:  "Invalid token type",
			})
			c.Abort()
			return
		}

		// Check if token is in blacklist
		blacklisted, err := svc.Redis.Exists(c.Request.Context(), "blacklist:access:"+tokenString)
		if err != nil {
			// Log error but don't block request (fail open for availability)
			c.JSON(http.StatusInternalServerError, httpn.Response{
				Code: http.StatusInternalServerError,
				Msg:  "System error",
			})
			c.Abort()
			return
		}
		if blacklisted {
			c.JSON(http.StatusUnauthorized, httpn.Response{
				Code: http.StatusUnauthorized,
				Msg:  "Token has been revoked",
			})
			c.Abort()
			return
		}

		// Set user info to context
		c.Set(UserIDKey, claims.UserID)
		c.Set(UsernameKey, claims.Username)

		c.Next()
	}
}

func allowQueryAccessToken(c *gin.Context) bool {
	if c.Request.Method != http.MethodGet {
		return false
	}
	fullPath := c.FullPath()
	if fullPath == "" {
		fullPath = c.Request.URL.Path
	}
	return strings.HasSuffix(fullPath, "/events")
}

// GetUserID - Get user ID from context
func GetUserID(c *gin.Context) (int64, bool) {
	userID, exists := c.Get(UserIDKey)
	if !exists {
		return 0, false
	}
	id, ok := userID.(int64)
	return id, ok
}

// GetUsername - Get username from context
func GetUsername(c *gin.Context) (string, bool) {
	username, exists := c.Get(UsernameKey)
	if !exists {
		return "", false
	}
	name, ok := username.(string)
	return name, ok
}
