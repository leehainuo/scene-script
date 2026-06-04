package user

import (
	"github.com/gin-gonic/gin"

	"scene-script/internal/logic/user"
	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/httpn"
)

func GetUserHandler(svc *svc.ServiceContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := httpn.PathInt64(c, "id")
		if err != nil {
			httpn.BadRequest(c, "Invalid user ID")
			return
		}

		req := &types.GetUserReq{ID: id}

		l := user.NewGetUserLogic(c.Request.Context(), svc)
		resp, err := l.Get(req)
		if err != nil {
			httpn.HandleError(c, err)
			return
		}

		httpn.Ok(c, resp)
	}
}
