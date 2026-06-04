package user

import (
	"github.com/gin-gonic/gin"

	"scene-script/internal/logic/user"
	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/httpn"
)

func CreateUserHandler(svc *svc.ServiceContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req types.CreateUserReq
		if err := httpn.BindJSON(c, &req); err != nil {
			httpn.Error(c, err)
			return
		}

		l := user.NewCreateUserLogic(c.Request.Context(), svc)
		resp, err := l.Create(&req)
		if err != nil {
			httpn.HandleError(c, err)
			return
		}

		httpn.Ok(c, resp)
	}
}
