package service

import (
	"sync"
	"time"

	"scene-script/internal/model"
)

const (
	ScriptTaskStageQueued     = "queued"
	ScriptTaskStageStarting   = "starting"
	ScriptTaskStageGenerating = "generating"
	ScriptTaskStageValidating = "validating"
	ScriptTaskStageRepairing  = "repairing"
	ScriptTaskStagePersisting = "persisting"
	ScriptTaskStageCompleted  = "completed"
	ScriptTaskStageFailed     = "failed"
)

type ScriptTaskEvent struct {
	TaskID    string    `json:"task_id"`
	Status    string    `json:"status"`
	Stage     string    `json:"stage"`
	Message   string    `json:"message,omitempty"`
	Error     string    `json:"error,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

func (e ScriptTaskEvent) Terminal() bool {
	return e.Status == "succeeded" || e.Status == "failed"
}

func NewScriptTaskEvent(taskID, status, stage, message, errMsg string) ScriptTaskEvent {
	return ScriptTaskEvent{
		TaskID:    taskID,
		Status:    status,
		Stage:     stage,
		Message:   message,
		Error:     errMsg,
		Timestamp: time.Now(),
	}
}

func SnapshotTaskEvent(task *model.ScriptTask) ScriptTaskEvent {
	if task == nil {
		return NewScriptTaskEvent("", "failed", ScriptTaskStageFailed, "任务不存在", "task not found")
	}

	switch task.Status {
	case "pending":
		return NewScriptTaskEvent(task.TaskID, task.Status, ScriptTaskStageQueued, "任务已进入队列，等待后台执行。", "")
	case "running":
		return NewScriptTaskEvent(task.TaskID, task.Status, ScriptTaskStageGenerating, "任务执行中，正在生成剧本结构。", "")
	case "succeeded":
		return NewScriptTaskEvent(task.TaskID, task.Status, ScriptTaskStageCompleted, "任务已完成，可以读取结果详情。", "")
	case "failed":
		return NewScriptTaskEvent(task.TaskID, task.Status, ScriptTaskStageFailed, "任务执行失败。", task.ErrMsg)
	default:
		return NewScriptTaskEvent(task.TaskID, task.Status, task.Status, "任务状态已更新。", task.ErrMsg)
	}
}

type ScriptTaskEventBroker struct {
	mu          sync.RWMutex
	subscribers map[string]map[chan ScriptTaskEvent]struct{}
}

func NewScriptTaskEventBroker() *ScriptTaskEventBroker {
	return &ScriptTaskEventBroker{
		subscribers: make(map[string]map[chan ScriptTaskEvent]struct{}),
	}
}

func (b *ScriptTaskEventBroker) Subscribe(taskID string) (<-chan ScriptTaskEvent, func()) {
	ch := make(chan ScriptTaskEvent, 16)

	b.mu.Lock()
	if _, ok := b.subscribers[taskID]; !ok {
		b.subscribers[taskID] = make(map[chan ScriptTaskEvent]struct{})
	}
	b.subscribers[taskID][ch] = struct{}{}
	b.mu.Unlock()

	cancel := func() {
		b.mu.Lock()
		defer b.mu.Unlock()

		subs, ok := b.subscribers[taskID]
		if !ok {
			return
		}
		if _, ok := subs[ch]; ok {
			delete(subs, ch)
			close(ch)
		}
		if len(subs) == 0 {
			delete(b.subscribers, taskID)
		}
	}

	return ch, cancel
}

func (b *ScriptTaskEventBroker) Publish(evt ScriptTaskEvent) {
	b.mu.RLock()
	subs, ok := b.subscribers[evt.TaskID]
	if !ok {
		b.mu.RUnlock()
		return
	}

	receivers := make([]chan ScriptTaskEvent, 0, len(subs))
	for ch := range subs {
		receivers = append(receivers, ch)
	}
	b.mu.RUnlock()

	for _, ch := range receivers {
		select {
		case ch <- evt:
		default:
			// Keep SSE fan-out non-blocking; the next snapshot/detail request can recover state.
		}
	}
}
