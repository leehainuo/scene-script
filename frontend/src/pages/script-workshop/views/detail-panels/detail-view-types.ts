import type { Dispatch, RefObject, SetStateAction } from "react"
import type {
  RegistryTab,
  ResultView,
  ScriptTreeNode,
  WorkshopResult,
} from "@/lib/script-workshop"
import type {
  ScriptBeat,
  ScriptChapter,
  ScriptScene,
  ScriptTaskMeta,
  ScriptYamlDocument,
} from "@/types"

export type Summary = {
  chapters: number
  scenes: number
  beats: number
  characters: number
  settings: number
}

export type Consistency = {
  rolesMissing: string[]
  settingsMissing: string[]
  danglingRefs: string[]
}

export type DetailViewProps = {
  activeResult: WorkshopResult | null
  activeTaskMeta: ScriptTaskMeta | null
  activeStatus: { label: string }
  taskProgressMessage: string
  hasUnsavedChanges: boolean
  view: ResultView
  setView: Dispatch<SetStateAction<ResultView>>
  summary: Summary
  consistency: Consistency
  handleCopyYaml: () => Promise<void>
  handleDownloadYaml: () => void
  liveYaml: string
  semanticTree: ScriptTreeNode[]
  selectedNode: ScriptTreeNode | null
  selectedNodeId: string | null
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>
  editableDocument: ScriptYamlDocument | null
  selectedChapterData: ScriptChapter | null
  selectedSceneData: ScriptScene | null
  selectedBeatData: ScriptBeat | null
  updateScriptChapter: (
    chapterIndex: number,
    updater: (chapter: ScriptChapter) => ScriptChapter
  ) => void
  updateScriptScene: (
    chapterIndex: number,
    sceneIndex: number,
    updater: (scene: ScriptScene) => ScriptScene
  ) => void
  updateScriptBeat: (
    chapterIndex: number,
    sceneIndex: number,
    beatIndex: number,
    updater: (beat: ScriptBeat) => ScriptBeat
  ) => void
  moveBeatInScene: (
    chapterIndex: number,
    sceneIndex: number,
    fromIndex: number,
    toIndex: number
  ) => void
  draggedBeatId: string | null
  setDraggedBeatId: Dispatch<SetStateAction<string | null>>
  dragOverBeatId: string | null
  setDragOverBeatId: Dispatch<SetStateAction<string | null>>
  getFieldClassName: (path: string, baseClassName: string) => string
  getFieldError: (path: string) => string | undefined
  setRegistryTab: Dispatch<SetStateAction<RegistryTab>>
  registryView: RegistryTab
  activeRegistryIndex: number
  setSelectedCharacterIndex: Dispatch<SetStateAction<number>>
  setSelectedSettingIndex: Dispatch<SetStateAction<number>>
  selectedCharacter: ScriptYamlDocument["dramatis_personae"][number] | null
  selectedSetting: ScriptYamlDocument["settings"][number] | null
  addCharacter: () => void
  addSetting: () => void
  deleteCharacter: (index: number) => void
  deleteSetting: (index: number) => void
  updateScriptCharacter: (
    index: number,
    updater: (
      character: ScriptYamlDocument["dramatis_personae"][number]
    ) => ScriptYamlDocument["dramatis_personae"][number]
  ) => void
  updateScriptSetting: (
    index: number,
    updater: (
      setting: ScriptYamlDocument["settings"][number]
    ) => ScriptYamlDocument["settings"][number]
  ) => void
  characterRenameOriginRef: RefObject<Record<number, string>>
  settingRenameOriginRef: RefObject<Record<number, string>>
  requestRenameConfirm: (
    kind: RegistryTab,
    previousName: string,
    nextName: string
  ) => void
  characterNames: string[]
  settingNames: string[]
  currentPovOptions: string[]
  currentLocationOptions: string[]
  currentSpeakerOptions: string[]
  sceneRewriteInstruction: string
  setSceneRewriteInstruction: Dispatch<SetStateAction<string>>
  isSceneRewriting: boolean
  handleRewriteScene: () => Promise<void>
}
