import { normalizeConsistency } from "@/lib/script-yaml"
import type { ScriptChapterInput, ScriptConvertRequest, ScriptDetailResponse } from "@/types"
import { DEFAULT_CHAPTERS } from "./constants"
import type {
  ChapterCompletionState,
  ChapterSummary,
  WorkshopResult,
} from "./types"

export function getChapterCompletionState(chapter: ScriptChapterInput): ChapterCompletionState {
  const hasTitle = chapter.title.trim().length > 0
  const hasText = chapter.text.trim().length > 0
  if (hasTitle && hasText) {
    return "ready"
  }
  if (hasTitle || hasText) {
    return "partial"
  }
  return "empty"
}

export function getTextCount(text: string) {
  return text.trim().replace(/\s+/g, "").length
}

export function formatTextCount(count: number) {
  return `${count.toLocaleString("zh-CN")} 字`
}

export function createDefaultDraft(): ScriptConvertRequest {
  return {
    chapters: DEFAULT_CHAPTERS,
    genre: "悬疑",
    tone: "压抑",
    pacing: "medium",
  }
}

export function makeResultFromDetail(detail: ScriptDetailResponse): WorkshopResult | null {
  if (!detail.yaml) return null
  return {
    id: detail.id,
    yaml: detail.yaml,
    summary: detail.summary,
    consistencyReport: normalizeConsistency(detail.consistency_report),
    metadata: detail.metadata,
  }
}

export function buildChapterSummaries(
  chapters: ScriptChapterInput[],
  readyLabel: string
): ChapterSummary[] {
  return chapters.map((chapter, index) => {
    const completionState = getChapterCompletionState(chapter)
    const textCount = getTextCount(chapter.text)
    return {
      index,
      title: chapter.title.trim() || `第 ${index + 1} 章`,
      textCount,
      completionState,
      statusLabel:
        completionState === "ready"
          ? readyLabel
          : completionState === "partial"
            ? "待补全"
            : "未开始",
      detailLabel:
        completionState === "ready"
          ? formatTextCount(textCount)
          : completionState === "partial"
            ? "缺标题或正文"
            : "等待输入",
    }
  })
}
