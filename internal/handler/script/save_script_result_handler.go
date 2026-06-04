package script

import (
	"github.com/gin-gonic/gin"

	"scene-script/internal/logic/script"
	"scene-script/internal/middleware"
	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/httpn"
)

// SaveScriptResultHandler saves edited script YAML for an existing task.
func SaveScriptResultHandler(svc *svc.ServiceContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := middleware.GetUserID(c)
		if !ok {
			httpn.BadRequest(c, "user not authenticated")
			return
		}

		var req types.SaveScriptResultReq
		if err := httpn.BindJSON(c, &req); err != nil {
			httpn.Error(c, err)
			return
		}
		req.ID = httpn.PathString(c, "id")
		if err := httpn.Validate(&req); err != nil {
			httpn.Error(c, err)
			return
		}

		l := script.NewSaveScriptResultLogic(c, svc)
		resp, err := l.Save(userID, &req)
		if err != nil {
			httpn.HandleError(c, err)
			return
		}

		httpn.Ok(c, resp)
	}
}
