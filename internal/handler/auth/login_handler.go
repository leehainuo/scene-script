package auth

import (
	"github.com/gin-gonic/gin"

	"scene-script/internal/logic/auth"
	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/httpn"
)

func LoginHandler(svc *svc.ServiceContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req types.LoginReq
		if err := httpn.BindJSON(c, &req); err != nil {
			httpn.Error(c, err)
			return
		}

		l := auth.NewLoginLogic(c.Request.Context(), svc)
		resp, err := l.Login(&req)
		if err != nil {
			httpn.HandleError(c, err)
			return
		}

		httpn.Ok(c, resp)
	}
}
