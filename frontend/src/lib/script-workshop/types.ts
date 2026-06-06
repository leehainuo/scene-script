import type {
  ScriptChapterInput,
  ScriptConvertRequest,
  ScriptDetailResponse,
  ScriptSummary,
  ScriptTaskMeta,
  ScriptYamlDocument,
} from "@/types"

export type Pacing = ScriptConvertRequest["pacing"]

export type ScriptTreeNode = {
  id: string
  label: string
  description: string
  kind: "chapter" | "scene" | "beat"
  chapterIndex: number
  sceneIndex?: number
  beatIndex?: number
  children: ScriptTreeNode[]
}

export type WorkshopResult = {
  id: string
  yaml: string
  summary: ScriptSummary
  consistencyReport: {
    rolesMissing: string[]
    settingsMissing: string[]
    danglingRefs: string[]
  }
  metadata: ScriptTaskMeta
}

export type ResultView = "summary" | "registry" | "consistency" | "yaml" | "structure"
export type SidebarView = "workspace" | "history" | "detail"
export type ScriptTaskStatus = "pending" | "running" | "succeeded" | "failed"
export type RegistryTab = "characters" | "settings"
export type WorkspaceInputMode = "chapter" | "import"
export type ChapterCompletionState = "empty" | "partial" | "ready"
export type ValidationErrors = Record<string, string>
export type RenameConfirmState = {
  kind: RegistryTab
  previousName: string
  nextName: string
} | null

export type ImportedChapterDraft = ScriptChapterInput

export type ChapterSummary = {
  index: number
  title: string
  textCount: number
  completionState: ChapterCompletionState
  statusLabel: string
  detailLabel: string
}

export type ConsistencyKind = "rolesMissing" | "settingsMissing" | "danglingRefs"

export type ScriptDetailConsistency = {
  rolesMissing: string[]
  settingsMissing: string[]
  danglingRefs: string[]
}

export type EditableScriptDocument = ScriptYamlDocument
export type ScriptDetailData = ScriptDetailResponse
