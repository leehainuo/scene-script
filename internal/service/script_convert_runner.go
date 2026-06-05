package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"go.uber.org/zap"

	"scene-script/internal/model"
	"scene-script/pkg/logn"
	"scene-script/pkg/stores/sqlx"
)

type AsyncConvertJob struct {
	Task    *model.ScriptTask
	Request ConvertRequest
}

type AsyncScriptConvertRunner struct {
	db          sqlx.SqlConn
	converter   *ScriptConverter
	taskModel   model.ScriptTaskModel
	eventBroker *ScriptTaskEventBroker
	jobs        chan AsyncConvertJob
	workers     int
}

func NewAsyncScriptConvertRunner(
	db sqlx.SqlConn,
	taskModel model.ScriptTaskModel,
	converter *ScriptConverter,
	eventBroker *ScriptTaskEventBroker,
) *AsyncScriptConvertRunner {
	runner := &AsyncScriptConvertRunner{
		db:          db,
		converter:   converter,
		taskModel:   taskModel,
		eventBroker: eventBroker,
		jobs:        make(chan AsyncConvertJob, 64),
		workers:     2,
	}
	runner.start()
	return runner
}

func (r *AsyncScriptConvertRunner) Enqueue(job AsyncConvertJob) error {
	logCtx := WithTaskLogContext(context.Background(), job.Task.TaskID, time.Now())
	select {
	case r.jobs <- job:
		logn.Debug("script convert job queued",
			TaskLogFields(logCtx, ScriptTaskStageQueued,
				zap.Int("queue_capacity", cap(r.jobs)),
				zap.Int("queue_length", len(r.jobs)),
				zap.Int("chapters", len(job.Request.Chapters)),
			)...,
		)
		r.eventBroker.Publish(NewScriptTaskEvent(
			job.Task.TaskID,
			job.Task.Status,
			ScriptTaskStageQueued,
			"任务已创建，等待后台执行。",
			"",
		))
		return nil
	default:
		return fmt.Errorf("convert queue is full")
	}
}

func (r *AsyncScriptConvertRunner) start() {
	for workerID := 0; workerID < r.workers; workerID++ {
		go r.worker(workerID + 1)
	}
}

func (r *AsyncScriptConvertRunner) worker(workerID int) {
	for job := range r.jobs {
		r.runJob(workerID, job)
	}
}

func (r *AsyncScriptConvertRunner) runJob(workerID int, job AsyncConvertJob) {
	startedAt := time.Now()
	baseCtx := WithTaskLogContext(context.Background(), job.Task.TaskID, startedAt)
	ctx, cancel := context.WithTimeout(baseCtx, r.jobTimeout())
	defer cancel()

	logger := logn.WithContext(ctx)
	task := *job.Task

	logger.Info("async script convert started", TaskLogFields(ctx, ScriptTaskStageStarting, zap.Int("worker_id", workerID))...)
	r.eventBroker.Publish(NewScriptTaskEvent(task.TaskID, "running", ScriptTaskStageStarting, "后台任务已启动。", ""))

	task.Status = "running"
	task.ErrMsg = ""
	if err := r.taskModel.Update(ctx, &task); err != nil {
		logger.Error("failed to mark task running", TaskLogFields(ctx, "mark_running_failed", zap.Error(err))...)
		r.failTask(ctx, &task, fmt.Errorf("failed to mark task running: %w", err))
		return
	}

	result, err := r.converter.ConvertWithProgress(ctx, job.Request, func(progress ConvertProgress) {
		logger.Debug("script convert progress",
			TaskLogFields(ctx, progress.Stage,
				zap.String("message", progress.Message),
			)...,
		)
		r.eventBroker.Publish(NewScriptTaskEvent(task.TaskID, "running", progress.Stage, progress.Message, ""))
	})
	if err != nil {
		logger.Error("async script convert failed", TaskLogFields(ctx, ScriptTaskStageFailed, zap.Error(err))...)
		r.failTask(ctx, &task, err)
		return
	}

	r.eventBroker.Publish(NewScriptTaskEvent(task.TaskID, "running", ScriptTaskStagePersisting, "结构校验通过，正在写入结果。", ""))
	if err := r.persistSuccess(ctx, &task, job.Request, result); err != nil {
		logger.Error("failed to persist async script result", TaskLogFields(ctx, ScriptTaskStagePersisting, zap.Error(err))...)
		r.failTask(ctx, &task, fmt.Errorf("persist script result: %w", err))
		return
	}

	r.eventBroker.Publish(NewScriptTaskEvent(task.TaskID, "succeeded", ScriptTaskStageCompleted, "任务已完成，可以读取剧本详情。", ""))
	logger.Info("async script convert succeeded",
		TaskLogFields(ctx, ScriptTaskStageCompleted,
			zap.Int("worker_id", workerID),
			zap.Int("summary_chapters", result.Summary.Chapters),
			zap.Int("summary_scenes", result.Summary.Scenes),
			zap.Int("summary_beats", result.Summary.Beats),
			zap.Int("yaml_len", len(result.YAML)),
		)...,
	)
}

func (r *AsyncScriptConvertRunner) persistSuccess(ctx context.Context, task *model.ScriptTask, req ConvertRequest, result *ConvertResult) error {
	return r.db.TransactCtx(ctx, func(ctx context.Context, conn sqlx.SqlConn) error {
		taskModel := model.NewScriptTaskModel(conn)
		resultModel := model.NewScriptResultModel(conn)

		summaryJSON, err := json.Marshal(result.Summary)
		if err != nil {
			return err
		}
		consistencyJSON, err := json.Marshal(result.ConsistencyReport)
		if err != nil {
			return err
		}

		if _, err := resultModel.Insert(ctx, &model.ScriptResult{
			TaskID:          task.TaskID,
			Yaml:            result.YAML,
			SummaryJSON:     string(summaryJSON),
			ConsistencyJSON: string(consistencyJSON),
			GeneratedAt:     time.Now(),
		}); err != nil {
			return err
		}

		task.Title = ResolveFinalTaskTitle(task.Title, result.ScriptTitle)
		task.Status = "succeeded"
		task.ErrMsg = ""
		// Reuse the task row already held in memory and update it in the same
		// transaction, which avoids any extra read-before-write query.
		logn.Debug("script convert result persisted",
			TaskLogFields(ctx, ScriptTaskStagePersisting,
				zap.String("task_title", task.Title),
				zap.Int("chapters", len(req.Chapters)),
				zap.Int("yaml_len", len(result.YAML)),
			)...,
		)
		return taskModel.Update(ctx, task)
	})
}

func (r *AsyncScriptConvertRunner) failTask(ctx context.Context, task *model.ScriptTask, err error) {
	task.Status = "failed"
	task.ErrMsg = truncateAsyncErr(err.Error(), 1024)
	if updateErr := r.taskModel.Update(ctx, task); updateErr != nil {
		logn.Error("failed to mark async script task failed", TaskLogFields(ctx, "mark_failed_update_failed", zap.Error(updateErr))...)
	}

	r.eventBroker.Publish(NewScriptTaskEvent(task.TaskID, "failed", ScriptTaskStageFailed, "任务执行失败。", task.ErrMsg))
}

func (r *AsyncScriptConvertRunner) jobTimeout() time.Duration {
	base := 120 * time.Second
	if r.converter != nil && r.converter.llmConfig != nil && r.converter.llmConfig.API.TimeoutSeconds > 0 {
		base = time.Duration(r.converter.llmConfig.API.TimeoutSeconds) * time.Second
	}

	attempts := 1
	if r.converter != nil && r.converter.promptManager != nil && r.converter.promptManager.MaxRepairAttempts() > 0 {
		attempts += r.converter.promptManager.MaxRepairAttempts()
	}

	return time.Duration(attempts)*base + 45*time.Second
}

func truncateAsyncErr(msg string, max int) string {
	if len(msg) <= max {
		return msg
	}
	return msg[:max]
}
