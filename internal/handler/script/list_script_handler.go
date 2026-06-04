package script

import (
	"github.com/gin-gonic/gin"

	"scene-script/internal/logic/script"
	"scene-script/internal/svc"
	"scene-script/pkg/httpn"
)

// ListScriptHandler - List script tasks
func ListScriptHandler(svc *svc.ServiceContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := c.Get("user_id")
		if !ok {
			httpn.BadRequest(c, "user not authenticated")
			return
		}

		l := script.NewListScriptLogic(c, svc)
		resp, err := l.List(userID)
		if err != nil {
			httpn.HandleError(c, err)
			return
		}

		httpn.Ok(c, resp)
	}
}
