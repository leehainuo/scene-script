package router

import (
	"github.com/gin-gonic/gin"

	"scene-script/internal/middleware"
	v1 "scene-script/internal/router/api/v1"
	"scene-script/internal/svc"
)

// Setup - Setup router
func Setup(svc *svc.ServiceContext) *gin.Engine {
	r := gin.New()

	// Global middleware (order matters)
	r.Use(gin.Recovery())               // 1. Recover from panics
	r.Use(gin.Logger())                 // 2. Request logging
	r.Use(middleware.TraceMiddleware()) // 3. Trace ID

	// Register route groups
	v1.RegisterV1(r, svc)

	return r
}
