package user

import (
	"github.com/gin-gonic/gin"

	"scene-script/internal/logic/user"
	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/httpn"
)

func UpdateUserHandler(svc *svc.ServiceContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := httpn.PathInt64(c, "id")
		if err != nil {
			httpn.BadRequest(c, "Invalid user ID")
			return
		}

		var req types.UpdateUserReq
		if err := httpn.BindJSON(c, &req); err != nil {
			httpn.Error(c, err)
			return
		}
		req.ID = id

		l := user.NewUpdateUserLogic(c.Request.Context(), svc)
		if err := l.Update(&req); err != nil {
			httpn.HandleError(c, err)
			return
		}

		httpn.Ok(c, nil)
	}
}
