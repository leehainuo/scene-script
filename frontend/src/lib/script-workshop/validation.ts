import type { ScriptYamlDocument } from "@/types"
import type { ValidationErrors } from "./types"

export function validateEditableDocument(document: ScriptYamlDocument): ValidationErrors {
  const errors: ValidationErrors = {}

  document.dramatis_personae.forEach((character, index) => {
    if (!character.name.trim()) {
      errors[`dramatis_personae[${index}].name`] = "请输入角色名"
    }
    if (!character.archetype.trim()) {
      errors[`dramatis_personae[${index}].archetype`] = "请输入角色类型"
    }
    if (!character.motivation.trim()) {
      errors[`dramatis_personae[${index}].motivation`] = "请输入角色动机"
    }
    if (!character.first_appearance.trim()) {
      errors[`dramatis_personae[${index}].first_appearance`] = "请输入首次出现"
    }
  })

  document.settings.forEach((setting, index) => {
    if (!setting.name.trim()) {
      errors[`settings[${index}].name`] = "请输入地点名"
    }
    if (!setting.description.trim()) {
      errors[`settings[${index}].description`] = "请输入地点描述"
    }
    if (!setting.importance.trim()) {
      errors[`settings[${index}].importance`] = "请选择重要程度"
    }
  })

  document.chapters.forEach((chapter, chapterIndex) => {
    if (!chapter.title.trim()) {
      errors[`chapters[${chapterIndex}].title`] = "请输入章节标题"
    }
    if (!chapter.summary.trim()) {
      errors[`chapters[${chapterIndex}].summary`] = "请输入章节梗概"
    }

    chapter.scenes.forEach((scene, sceneIndex) => {
      if (!scene.title.trim()) {
        errors[`chapters[${chapterIndex}].scenes[${sceneIndex}].title`] = "请输入场景标题"
      }
      if (!scene.goal.trim()) {
        errors[`chapters[${chapterIndex}].scenes[${sceneIndex}].goal`] = "请输入场景目标"
      }
      if (!scene.location.trim()) {
        errors[`chapters[${chapterIndex}].scenes[${sceneIndex}].location`] = "请选择场景地点"
      }
      if (!scene.time.trim()) {
        errors[`chapters[${chapterIndex}].scenes[${sceneIndex}].time`] = "请输入场景时间"
      }
      if (!scene.pov.trim()) {
        errors[`chapters[${chapterIndex}].scenes[${sceneIndex}].pov`] = "请选择视角角色"
      }
      if (!scene.mood.trim()) {
        errors[`chapters[${chapterIndex}].scenes[${sceneIndex}].mood`] = "请输入场景氛围"
      }
      if (!scene.outcome.trim()) {
        errors[`chapters[${chapterIndex}].scenes[${sceneIndex}].outcome`] = "请输入场景收尾"
      }

      scene.beats.forEach((beat, beatIndex) => {
        if (!beat.summary.trim()) {
          errors[`chapters[${chapterIndex}].scenes[${sceneIndex}].beats[${beatIndex}].summary`] =
            "请输入节拍摘要"
        }
        if (!beat.type.trim()) {
          errors[`chapters[${chapterIndex}].scenes[${sceneIndex}].beats[${beatIndex}].type`] =
            "请选择节拍类型"
        }

        if (beat.type === "dialogue" || beat.type === "inner") {
          if (!beat.dialogue?.speaker.trim()) {
            errors[
              `chapters[${chapterIndex}].scenes[${sceneIndex}].beats[${beatIndex}].dialogue.speaker`
            ] = "请选择对白角色"
          }
          if (!beat.dialogue?.content.trim()) {
            errors[
              `chapters[${chapterIndex}].scenes[${sceneIndex}].beats[${beatIndex}].dialogue.content`
            ] = "请输入对白内容"
          }
        }
      })
    })
  })

  return errors
}
