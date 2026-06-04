package script

import (
	"github.com/gin-gonic/gin"

	"scene-script/internal/logic/script"
	"scene-script/internal/middleware"
	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/httpn"
)

// ListScriptHandler - List script tasks
func ListScriptHandler(svc *svc.ServiceContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req types.ListScriptReq
		if err := httpn.BindQuery(c, &req); err != nil {
			httpn.Error(c, err)
			return
		}
		userID, ok := middleware.GetUserID(c)
		if !ok {
			httpn.BadRequest(c, "user not authenticated")
			return
		}

		l := script.NewListScriptLogic(c, svc)
		resp, err := l.List(userID, &req)
		if err != nil {
			httpn.HandleError(c, err)
			return
		}

		httpn.Ok(c, resp)
	}
}
