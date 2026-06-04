package script

import (
	"github.com/gin-gonic/gin"

	"scene-script/internal/logic/script"
	"scene-script/internal/svc"
	"scene-script/pkg/httpn"
)

// GetScriptHandler - Get script task detail
func GetScriptHandler(svc *svc.ServiceContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		taskID := c.Param("id")
		if taskID == "" {
			httpn.BadRequest(c, "task id is required")
			return
		}

		l := script.NewGetScriptLogic(c, svc)
		resp, err := l.Get(taskID)
		if err != nil {
			httpn.HandleError(c, err)
			return
		}

		httpn.Ok(c, resp)
	}
}
