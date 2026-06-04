package script

import (
	"github.com/gin-gonic/gin"

	"scene-script/internal/logic/script"
	"scene-script/internal/middleware"
	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/httpn"
)

// GetScriptHandler - Get script task detail
func GetScriptHandler(svc *svc.ServiceContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := middleware.GetUserID(c)
		if !ok {
			httpn.BadRequest(c, "user not authenticated")
			return
		}

		req := &types.GetScriptReq{ID: httpn.PathString(c, "id")}
		if err := httpn.Validate(req); err != nil {
			httpn.Error(c, err)
			return
		}

		l := script.NewGetScriptLogic(c, svc)
		resp, err := l.Get(userID, req)
		if err != nil {
			httpn.HandleError(c, err)
			return
		}

		httpn.Ok(c, resp)
	}
}
