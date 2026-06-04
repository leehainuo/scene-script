package script

import (
	"github.com/gin-gonic/gin"

	"scene-script/internal/logic/script"
	"scene-script/internal/model"
	"scene-script/internal/svc"
	"scene-script/pkg/httpn"
)

// ConvertScriptHandler - Handle script conversion request
func ConvertScriptHandler(svc *svc.ServiceContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req model.ConvertRequest
		if err := httpn.BindJSON(c, &req); err != nil {
			httpn.Error(c, err)
			return
		}

		userID, ok := c.Get("user_id")
		if !ok {
			httpn.BadRequest(c, "user not authenticated")
			return
		}

		l := script.NewConvertScriptLogic(c, svc)
		resp, err := l.Convert(userID.(int64), &req)
		if err != nil {
			httpn.HandleError(c, err)
			return
		}

		httpn.Ok(c, resp)
	}
}
