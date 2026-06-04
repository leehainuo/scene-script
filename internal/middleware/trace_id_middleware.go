package middleware

import (
	"context"

	"github.com/gin-gonic/gin"

	"scene-script/pkg/logn"
	"scene-script/pkg/utils/idgen"
)

// TraceMiddleware - Add trace_id to context (Gin version)
func TraceMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get or generate trace_id
		traceID := c.GetHeader("X-Trace-ID")
		if traceID == "" {
			traceID = idgen.UUID()
		}

		// Add to context
		ctx := context.WithValue(c.Request.Context(), logn.TraceIDKey, traceID)
		c.Request = c.Request.WithContext(ctx)

		// Add to response header
		c.Header("X-Trace-ID", traceID)

		c.Next()
	}
}
