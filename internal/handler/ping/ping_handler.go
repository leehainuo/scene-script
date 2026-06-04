package ping

import (
	"github.com/gin-gonic/gin"

	"scene-script/internal/logic/ping"
	"scene-script/internal/svc"
	"scene-script/pkg/httpn"
)

func PingHandler(svc *svc.ServiceContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		l := ping.NewPingLogic(c.Request.Context(), svc)
		resp := l.Ping()

		httpn.Ok(c, resp)
	}
}
