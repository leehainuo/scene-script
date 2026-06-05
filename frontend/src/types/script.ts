import type { PaginationParams } from "./api"

export interface ScriptChapterInput {
  title: string
  text: string
}

export interface ScriptConvertRequest {
  chapters: ScriptChapterInput[]
  genre: string
  tone: string
  pacing: "fast" | "medium" | "slow"
}

export interface ScriptSummary {
  chapters: number
  scenes: number
  beats: number
  characters: number
  settings: number
}

export interface ScriptDialogue {
  speaker: string
  content: string
}

export interface ScriptBeat {
  id: string
  type: "action" | "dialogue" | "inner" | "exposition" | string
  summary: string
  dialogue?: ScriptDialogue
}

export interface ScriptScene {
  id: string
  title: string
  goal: string
  location: string
  time: string
  pov: string
  mood: string
  beats: ScriptBeat[]
  outcome: string
}

export interface ScriptChapter {
  id: string
  title: string
  summary: string
  scenes: ScriptScene[]
}

export interface ScriptCharacter {
  name: string
  archetype: string
  motivation: string
  traits: string[]
  relations: string[]
  first_appearance: string
}

export interface ScriptSetting {
  name: string
  description: string
  importance: "high" | "medium" | "low" | string
}

export interface ScriptYamlMetadata {
  title: string
  author: string
  genre: string
  tone: string
  pacing: string
  source_chapters: number
  generated_at: string
}

export interface ScriptYamlDocument {
  version: string
  metadata: ScriptYamlMetadata
  dramatis_personae: ScriptCharacter[]
  settings: ScriptSetting[]
  chapters: ScriptChapter[]
  consistency_report: {
    roles_missing: string[]
    settings_missing: string[]
    dangling_refs: string[]
  }
}

export interface ScriptConsistencyReport {
  RolesMissing?: string[]
  SettingsMissing?: string[]
  DanglingRefs?: string[]
  roles_missing?: string[]
  settings_missing?: string[]
  dangling_refs?: string[]
}

export interface ScriptConvertResponse {
  id: string
  status: "pending" | "running" | "succeeded" | "failed" | string
  detail_url: string
  event_url: string
}

export interface ScriptTaskEvent {
  task_id: string
  status: "pending" | "running" | "succeeded" | "failed" | string
  stage:
    | "queued"
    | "starting"
    | "summarizing"
    | "generating"
    | "validating"
    | "repairing"
    | "persisting"
    | "completed"
    | "failed"
    | string
  message?: string
  error?: string
  timestamp: string
}

export interface ScriptHistoryItem {
  id: string
  title: string
  genre: string
  tone: string
  pacing: string
  source_chapters: number
  status: "pending" | "running" | "succeeded" | "failed" | string
  err_msg?: string
  created_at: string
  updated_at: string
}

export interface ScriptListResponse {
  items: ScriptHistoryItem[]
  page: number
  page_size: number
  total: number
}

export interface ScriptTaskMeta {
  id: string
  title: string
  genre: string
  tone: string
  pacing: string
  source_chapters: number
  status: "pending" | "running" | "succeeded" | "failed" | string
  err_msg?: string
  created_at: string
  updated_at: string
}

export interface ScriptDetailResponse {
  id: string
  yaml?: string
  summary: ScriptSummary
  consistency_report: ScriptConsistencyReport
  metadata: ScriptTaskMeta
}

export interface SaveScriptResultRequest {
  yaml: string
}

export interface ScriptListParams extends PaginationParams {
  status?: "all" | "pending" | "running" | "succeeded" | "failed"
}

export interface DeleteScriptResponse {
  id: string
}
