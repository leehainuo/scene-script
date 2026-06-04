package v1

import (
	"github.com/gin-gonic/gin"

	"scene-script/internal/handler/auth"
	"scene-script/internal/handler/ping"
	"scene-script/internal/handler/script_chapter"
	"scene-script/internal/handler/script_result"
	"scene-script/internal/handler/script_task"
	"scene-script/internal/handler/user"
	"scene-script/internal/middleware"
	"scene-script/internal/svc"
)

func RegisterV1(r *gin.Engine, svc *svc.ServiceContext) {

	r.GET("/ping", ping.PingHandler(svc))

	v1 := r.Group("/api/v1")
	{
		registerScript_resultRoutes(v1, svc)
		registerScript_chapterRoutes(v1, svc)
		registerScript_taskRoutes(v1, svc)

		v1.POST("/login", auth.LoginHandler(svc))
		v1.POST("/refresh", auth.RefreshHandler(svc))

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

func registerScript_taskRoutes(r *gin.RouterGroup, svc *svc.ServiceContext) {
	script_tasks := r.Group("/script_tasks")
	{
		script_tasks.POST("", script_task.CreateScriptTaskHandler(svc))
		script_tasks.GET("/:id", script_task.GetScriptTaskHandler(svc))
		script_tasks.PUT("/:id", script_task.UpdateScriptTaskHandler(svc))
		script_tasks.DELETE("/:id", script_task.DeleteScriptTaskHandler(svc))
	}
}

func registerScript_chapterRoutes(r *gin.RouterGroup, svc *svc.ServiceContext) {
	script_chapters := r.Group("/script_chapters")
	{
		script_chapters.POST("", script_chapter.CreateScriptChapterHandler(svc))
		script_chapters.GET("/:id", script_chapter.GetScriptChapterHandler(svc))
		script_chapters.PUT("/:id", script_chapter.UpdateScriptChapterHandler(svc))
		script_chapters.DELETE("/:id", script_chapter.DeleteScriptChapterHandler(svc))
	}
}

func registerScript_resultRoutes(r *gin.RouterGroup, svc *svc.ServiceContext) {
	script_results := r.Group("/script_results")
	{
		script_results.POST("", script_result.CreateScriptResultHandler(svc))
		script_results.GET("/:id", script_result.GetScriptResultHandler(svc))
		script_results.PUT("/:id", script_result.UpdateScriptResultHandler(svc))
		script_results.DELETE("/:id", script_result.DeleteScriptResultHandler(svc))
	}
}
