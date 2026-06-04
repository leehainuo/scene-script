package v1

import (
	"github.com/gin-gonic/gin"

	"scene-script/internal/handler/auth"
	"scene-script/internal/handler/ping"
	"scene-script/internal/handler/user"
	"scene-script/internal/middleware"
	"scene-script/internal/svc"
)

// RegisterV1 - Register v1 routes
func RegisterV1(r *gin.Engine, svc *svc.ServiceContext) {
	// Health check
	r.GET("/ping", ping.PingHandler(svc))

	// API v1 route group
	v1 := r.Group("/api/v1")
	{
		v1.POST("/login", auth.LoginHandler(svc))
		v1.POST("/refresh", auth.RefreshHandler(svc))

		// Protected routes (auth required)
		protected := v1.Group("")
		protected.Use(middleware.AuthMiddleware(svc))
		{
			// Auth routes
			protected.POST("/logout", auth.LogoutHandler(svc))

			// User routes
			registerUserRoutes(protected, svc)
		}
	}
}

func registerUserRoutes(r *gin.RouterGroup, svc *svc.ServiceContext) {
	users := r.Group("/users")
	{
		users.POST("", user.CreateUserHandler(svc))
		users.GET("/:id", user.GetUserHandler(svc))
		users.PUT("/:id", user.UpdateUserHandler(svc))
		users.DELETE("/:id", user.DeleteUserHandler(svc))
	}
}
