package user

import (
	"github.com/gin-gonic/gin"

	"scene-script/internal/logic/user"
	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/httpn"
)

func DeleteUserHandler(svc *svc.ServiceContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := httpn.PathInt64(c, "id")
		if err != nil {
			httpn.BadRequest(c, "Invalid user ID")
			return
		}

		req := &types.DeleteUserReq{ID: id}

		l := user.NewDeleteUserLogic(c.Request.Context(), svc)
		if err := l.Delete(req); err != nil {
			httpn.HandleError(c, err)
			return
		}

		httpn.Ok(c, nil)
	}
}
