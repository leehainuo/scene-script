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
  yaml: string
  summary: ScriptSummary
  consistency_report: ScriptConsistencyReport
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

export interface ScriptListParams extends PaginationParams {
  status?: "all" | "pending" | "running" | "succeeded" | "failed"
}
