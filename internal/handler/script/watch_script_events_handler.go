package script

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"scene-script/internal/logic/script"
	"scene-script/internal/middleware"
	"scene-script/internal/service"
	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/httpn"
)

func WatchScriptEventsHandler(svc *svc.ServiceContext) gin.HandlerFunc {
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

		l := script.NewWatchScriptEventsLogic(c, svc)
		snapshot, err := l.Snapshot(userID, req)
		if err != nil {
			httpn.HandleError(c, err)
			return
		}

		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("Connection", "keep-alive")
		c.Header("X-Accel-Buffering", "no")
		c.Status(http.StatusOK)

		flusher, ok := c.Writer.(http.Flusher)
		if !ok {
			httpn.HandleError(c, fmt.Errorf("streaming unsupported"))
			return
		}

		if err := writeSSEEvent(c.Writer, "script-task", *snapshot); err != nil {
			return
		}
		flusher.Flush()
		if snapshot.Terminal() {
			return
		}

		events, cancel := svc.TaskEventBroker.Subscribe(req.ID)
		defer cancel()

		heartbeat := time.NewTicker(10 * time.Second)
		defer heartbeat.Stop()

		for {
			select {
			case <-c.Request.Context().Done():
				return
			case <-heartbeat.C:
				if _, err := c.Writer.Write([]byte(": ping\n\n")); err != nil {
					return
				}
				flusher.Flush()
			case evt, ok := <-events:
				if !ok {
					return
				}
				if err := writeSSEEvent(c.Writer, "script-task", evt); err != nil {
					return
				}
				flusher.Flush()
				if evt.Terminal() {
					return
				}
			}
		}
	}
}

func writeSSEEvent(w gin.ResponseWriter, event string, data service.ScriptTaskEvent) error {
	payload, err := json.Marshal(data)
	if err != nil {
		return err
	}
	if _, err := fmt.Fprintf(w, "event: %s\n", event); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(w, "data: %s\n\n", payload); err != nil {
		return err
	}
	return nil
}
