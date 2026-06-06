import type { ScriptYamlDocument } from "@/types"
import { replaceLiteralText } from "./utils"

type RenameTarget = {
  previousName: string
  nextName: string
  sceneField: "pov" | "location"
  renameDialogueSpeaker: boolean
}

function renameDocumentReferences(
  document: ScriptYamlDocument,
  { previousName, nextName, sceneField, renameDialogueSpeaker }: RenameTarget
) {
  const previous = previousName.trim()
  const currentName = nextName.trim()
  if (!previous || !currentName || previous === currentName) {
    return document
  }

  return {
    ...document,
    chapters: document.chapters.map((chapter) => ({
      ...chapter,
      summary: replaceLiteralText(chapter.summary, previous, currentName),
      scenes: chapter.scenes.map((scene) => ({
        ...scene,
        [sceneField]: scene[sceneField] === previous ? currentName : scene[sceneField],
        goal: replaceLiteralText(scene.goal, previous, currentName),
        outcome: replaceLiteralText(scene.outcome, previous, currentName),
        beats: scene.beats.map((beat) => ({
          ...beat,
          summary: replaceLiteralText(beat.summary, previous, currentName),
          dialogue: beat.dialogue
            ? {
                speaker:
                  renameDialogueSpeaker && beat.dialogue.speaker === previous
                    ? currentName
                    : beat.dialogue.speaker,
                content: replaceLiteralText(beat.dialogue.content, previous, currentName),
              }
            : beat.dialogue,
        })),
      })),
    })),
  }
}

export function renameCharacterReferences(
  document: ScriptYamlDocument,
  previousName: string,
  nextName: string
) {
  return renameDocumentReferences(document, {
    previousName,
    nextName,
    sceneField: "pov",
    renameDialogueSpeaker: true,
  })
}

export function renameSettingReferences(
  document: ScriptYamlDocument,
  previousName: string,
  nextName: string
) {
  return renameDocumentReferences(document, {
    previousName,
    nextName,
    sceneField: "location",
    renameDialogueSpeaker: false,
  })
}
