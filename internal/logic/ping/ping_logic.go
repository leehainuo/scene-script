package ping

import (
	"context"

	"scene-script/internal/svc"
	"scene-script/pkg/logn"
)

type PingLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewPingLogic(c context.Context, svc *svc.ServiceContext) *PingLogic {
	return &PingLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *PingLogic) Ping() string {
	return "pong"
}
