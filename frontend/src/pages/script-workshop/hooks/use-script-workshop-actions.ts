import { useState } from "react"
import type { ComponentProps, Dispatch, SetStateAction } from "react"
import type { SetURLSearchParams } from "react-router-dom"
import { toast } from "sonner"
import {
  extractErrorMessage,
  GENERATION_STEPS,
  getGenerationStepText,
  MAX_SOURCE_CHAPTERS,
  MIN_SOURCE_CHAPTERS,
} from "@/lib/script-workshop"
import { convertScript, deleteScriptTask, retryScriptTask } from "@/services"
import type { ResultView, WorkshopResult } from "@/lib/script-workshop"
import type { ScriptConvertRequest, ScriptHistoryItem, ScriptTaskMeta } from "@/types"

type HistoryActionState = {
  taskId: string
  kind: "retry" | "delete"
} | null

type UseScriptWorkshopActionsOptions = {
  draft: ScriptConvertRequest
  setSearchParams: SetURLSearchParams
  loadHistory: () => Promise<void>
  setHistory: Dispatch<SetStateAction<ScriptHistoryItem[]>>
  selectedTaskId: string | null
  setSelectedTaskId: Dispatch<SetStateAction<string | null>>
  setActiveTaskMeta: Dispatch<SetStateAction<ScriptTaskMeta | null>>
  setResultForEditing: (result: WorkshopResult | null) => void
  setTaskProgressMessage: Dispatch<SetStateAction<string>>
  setIsSubmitting: Dispatch<SetStateAction<boolean>>
  setShowGenerationOverlay: Dispatch<SetStateAction<boolean>>
  setGenerationStepIndex: Dispatch<SetStateAction<number>>
  setGenerationStepText: Dispatch<SetStateAction<string>>
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>
  setView: Dispatch<SetStateAction<ResultView>>
  loadDetailById: (taskId: string, successMessage?: string) => Promise<void>
  startTaskEventStream: (taskId: string, eventUrl: string) => void
  closeTaskEventStream: (taskId?: string) => void
}

export function useScriptWorkshopActions({
  draft,
  setSearchParams,
  loadHistory,
  setHistory,
  selectedTaskId,
  setSelectedTaskId,
  setActiveTaskMeta,
  setResultForEditing,
  setTaskProgressMessage,
  setIsSubmitting,
  setShowGenerationOverlay,
  setGenerationStepIndex,
  setGenerationStepText,
  setSelectedNodeId,
  setView,
  loadDetailById,
  startTaskEventStream,
  closeTaskEventStream,
}: UseScriptWorkshopActionsOptions) {
  const [historyActionState, setHistoryActionState] = useState<HistoryActionState>(null)

  async function handleSubmit(
    event: Parameters<NonNullable<ComponentProps<"form">["onSubmit"]>>[0]
  ) {
    event.preventDefault()
    let streamStarted = false

    const trimmedChapters = draft.chapters.map((chapter) => ({
      title: chapter.title.trim(),
      text: chapter.text.trim(),
    }))

    if (trimmedChapters.length < MIN_SOURCE_CHAPTERS) {
      toast.error(`章节不足 ${MIN_SOURCE_CHAPTERS} 章，无法发起转换。`)
      return
    }
    if (trimmedChapters.length > MAX_SOURCE_CHAPTERS) {
      toast.error(`单次上限 ${MAX_SOURCE_CHAPTERS} 章，长篇请拆分多任务后再生成。`)
      return
    }
    if (trimmedChapters.some((chapter) => !chapter.title || !chapter.text)) {
      toast.error("每一章都需要填写标题和正文。")
      return
    }

    setGenerationStepIndex(0)
    setIsSubmitting(true)
    setShowGenerationOverlay(true)
    try {
      const response = await convertScript({
        ...draft,
        chapters: trimmedChapters,
      })

      if (response.code !== 0 || !response.data) {
        toast.error(response.msg || "生成失败，请稍后重试。")
        return
      }

      const now = new Date().toISOString()
      const taskMeta: ScriptTaskMeta = {
        id: response.data.id,
        title: trimmedChapters[0]?.title || "未命名剧本",
        genre: draft.genre,
        tone: draft.tone,
        pacing: draft.pacing,
        source_chapters: trimmedChapters.length,
        status: response.data.status,
        created_at: now,
        updated_at: now,
      }

      setResultForEditing(null)
      setActiveTaskMeta(taskMeta)
      setTaskProgressMessage("任务已提交，正在连接后台进度。")
      setGenerationStepText(
        getGenerationStepText(response.data.status, "任务已提交，正在连接后台进度。")
      )
      setSelectedTaskId(response.data.id)
      setSelectedNodeId(null)
      setSearchParams({ view: "detail", id: response.data.id })
      setView("summary")
      await loadHistory()
      startTaskEventStream(response.data.id, response.data.event_url)
      streamStarted = true
    } catch (err) {
      toast.error(extractErrorMessage(err, "生成失败，请检查服务状态后重试。"))
    } finally {
      if (!streamStarted) {
        setIsSubmitting(false)
        setShowGenerationOverlay(false)
        setGenerationStepIndex(0)
        setGenerationStepText(GENERATION_STEPS[0])
      }
    }
  }

  async function handleLoadHistory(item: ScriptHistoryItem) {
    await loadDetailById(item.id, `已载入「${item.title}」`)
  }

  async function handleRetryHistory(item: ScriptHistoryItem) {
    setHistoryActionState({ taskId: item.id, kind: "retry" })
    try {
      const response = await retryScriptTask(item.id)
      if (response.code !== 0 || !response.data) {
        toast.error(response.msg || "重试失败，请稍后再试。")
        return
      }

      toast.success("已重新加入生成队列。")
      await loadHistory()
      await loadDetailById(response.data.id)
    } catch (err) {
      toast.error(extractErrorMessage(err, "重试失败，请稍后再试。"))
    } finally {
      setHistoryActionState((current) =>
        current?.taskId === item.id && current.kind === "retry" ? null : current
      )
    }
  }

  async function handleDeleteHistory(item: ScriptHistoryItem) {
    const confirmed = window.confirm(
      item.status === "failed"
        ? `确定删除失败作品「${item.title}」吗？删除后它会从作品墙移除。`
        : `确定删除作品「${item.title}」吗？删除后将无法恢复。`
    )
    if (!confirmed) {
      return
    }

    setHistoryActionState({ taskId: item.id, kind: "delete" })
    try {
      const response = await deleteScriptTask(item.id)
      if (response.code !== 0) {
        toast.error(response.msg || "删除失败，请稍后再试。")
        return
      }

      if (selectedTaskId === item.id) {
        closeTaskEventStream(item.id)
        setSelectedTaskId(null)
        setActiveTaskMeta(null)
        setResultForEditing(null)
        setTaskProgressMessage("")
        setSearchParams({ view: "history" })
      }

      setHistory((current) => current.filter((historyItem) => historyItem.id !== item.id))
      toast.success("作品已删除。")
    } catch (err) {
      toast.error(extractErrorMessage(err, "删除失败，请稍后再试。"))
    } finally {
      setHistoryActionState((current) =>
        current?.taskId === item.id && current.kind === "delete" ? null : current
      )
    }
  }

  return {
    handleDeleteHistory,
    handleLoadHistory,
    handleRetryHistory,
    handleSubmit,
    historyActionState,
  }
}
