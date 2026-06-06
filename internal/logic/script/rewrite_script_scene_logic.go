package script

import (
	"context"
	"errors"
	"net/http"

	"scene-script/internal/model"
	"scene-script/internal/service"
	"scene-script/internal/svc"
	"scene-script/internal/types"
	"scene-script/pkg/errorn"
	"scene-script/pkg/logn"
)

// RewriteScriptSceneLogic rewrites a single scene using the current YAML draft.
type RewriteScriptSceneLogic struct {
	*logn.Logger
	c   context.Context
	svc *svc.ServiceContext
}

func NewRewriteScriptSceneLogic(c context.Context, svc *svc.ServiceContext) *RewriteScriptSceneLogic {
	return &RewriteScriptSceneLogic{
		c:      c,
		svc:    svc,
		Logger: logn.WithContext(c),
	}
}

func (l *RewriteScriptSceneLogic) Rewrite(userID int64, req *types.RewriteScriptSceneReq) (*types.GetScriptResp, error) {
	if userID <= 0 {
		return nil, errorn.New(http.StatusBadRequest, "invalid user id")
	}
	if req == nil || req.ID == "" {
		return nil, errorn.New(http.StatusBadRequest, "task id is required")
	}

	task, err := l.svc.ScriptTaskModel.FindByTaskID(l.c, req.ID)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, errorn.New(http.StatusNotFound, "script task not found")
		}
		return nil, err
	}
	if task.UserID != userID {
		return nil, errorn.New(http.StatusNotFound, "script task not found")
	}
	if task.Status != "succeeded" {
		return nil, errorn.New(http.StatusBadRequest, "only succeeded script can be rewritten")
	}

	chapters, err := l.svc.ScriptChapterModel.ListByTaskID(l.c, req.ID)
	if err != nil {
		return nil, err
	}

	convertReq := service.ConvertRequest{
		Chapters: make([]service.ChapterInput, 0, len(chapters)),
		Genre:    task.Genre,
		Tone:     task.Tone,
		Pacing:   task.Pacing,
	}
	// Fetch the source chapter snapshot in one query and build the rewrite context in memory,
	// avoiding any looped per-chapter database lookups and eliminating N+1 risk.
	for _, chapter := range chapters {
		convertReq.Chapters = append(convertReq.Chapters, service.ChapterInput{
			Title: chapter.ChapterTitle,
			Text:  chapter.ChapterText,
		})
	}

	result, err := l.svc.ScriptConverter.RewriteScene(l.c, service.SceneRewriteRequest{
		CurrentYAML:  req.YAML,
		Source:       convertReq,
		ChapterIndex: req.ChapterIndex,
		SceneIndex:   req.SceneIndex,
		Instruction:  req.Instruction,
	})
	if err != nil {
		return nil, l.mapRewriteError(err)
	}

	return &types.GetScriptResp{
		ID:                req.ID,
		YAML:              result.YAML,
		Summary:           result.Summary,
		ConsistencyReport: result.ConsistencyReport,
		Metadata: types.ScriptTaskMeta{
			ID:             task.TaskID,
			Title:          task.Title,
			Genre:          task.Genre,
			Tone:           task.Tone,
			Pacing:         task.Pacing,
			SourceChapters: task.SourceChapters,
			Status:         task.Status,
			ErrMsg:         task.ErrMsg,
			CreatedAt:      task.CreatedAt,
			UpdatedAt:      task.UpdatedAt,
		},
	}, nil
}

func (l *RewriteScriptSceneLogic) mapRewriteError(err error) error {
	var convertErr *service.ConvertError
	if !errors.As(err, &convertErr) {
		return errorn.New(http.StatusInternalServerError, "failed to rewrite scene")
	}

	switch convertErr.Code {
	case service.ConvertErrorYAMLParse, service.ConvertErrorSchema:
		return errorn.New(http.StatusBadRequest, convertErr.Error())
	default:
		return errorn.New(http.StatusInternalServerError, "failed to rewrite scene")
	}
}
