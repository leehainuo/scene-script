import { useEffect, useMemo, useRef, useState } from "react"
import type { ComponentProps, Dispatch, SetStateAction } from "react"
import type { SetURLSearchParams } from "react-router-dom"
import { toast } from "sonner"
import {
  convertScript,
  deleteScriptTask,
  getScriptDetail,
  getScriptHistory,
  openScriptEventStream,
  retryScriptTask,
} from "@/services"
import {
  extractErrorMessage,
  GENERATION_STEPS,
  getGenerationStepText,
  makeResultFromDetail,
  STATUS_FILTER_OPTIONS,
} from "@/lib/script-workshop"
import type {
  ResultView,
  ScriptTaskStatus,
  WorkshopResult,
} from "@/lib/script-workshop"
import type {
  ScriptConvertRequest,
  ScriptHistoryItem,
  ScriptTaskEvent,
  ScriptTaskMeta,
} from "@/types"

type UseScriptWorkshopTasksOptions = {
  draft: ScriptConvertRequest
  searchParams: URLSearchParams
  setSearchParams: SetURLSearchParams
  activeResultId: string | null
  setResultForEditing: (result: WorkshopResult | null) => void
  setIsSubmitting: Dispatch<SetStateAction<boolean>>
  setShowGenerationOverlay: Dispatch<SetStateAction<boolean>>
  setGenerationStepIndex: Dispatch<SetStateAction<number>>
  setGenerationStepText: Dispatch<SetStateAction<string>>
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>
  setView: Dispatch<SetStateAction<ResultView>>
}

export function useScriptWorkshopTasks({
  draft,
  searchParams,
  setSearchParams,
  activeResultId,
  setResultForEditing,
  setIsSubmitting,
  setShowGenerationOverlay,
  setGenerationStepIndex,
  setGenerationStepText,
  setSelectedNodeId,
  setView,
}: UseScriptWorkshopTasksOptions) {
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [statusFilters, setStatusFilters] = useState<ScriptTaskStatus[]>([])
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [history, setHistory] = useState<ScriptHistoryItem[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [activeTaskMeta, setActiveTaskMeta] = useState<ScriptTaskMeta | null>(null)
  const [taskProgressMessage, setTaskProgressMessage] = useState("")
  const [historyActionState, setHistoryActionState] = useState<{
    taskId: string
    kind: "retry" | "delete"
  } | null>(null)

  const statusMenuRef = useRef<HTMLDivElement | null>(null)
  const taskEventSourceRef = useRef<{ taskId: string; source: EventSource } | null>(null)
  const loadDetailByIdRef = useRef<(taskId: string) => Promise<void>>(async () => {})

  useEffect(() => {
    return () => {
      taskEventSourceRef.current?.source.close()
      taskEventSourceRef.current = null
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [])

  useEffect(() => {
    if (!isStatusMenuOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!statusMenuRef.current?.contains(event.target as Node)) {
        setIsStatusMenuOpen(false)
      }
    }

    window.addEventListener("mousedown", handlePointerDown)
    return () => window.removeEventListener("mousedown", handlePointerDown)
  }, [isStatusMenuOpen])

  async function loadHistory() {
    setIsHistoryLoading(true)
    try {
      const response = await getScriptHistory({ page: 1, page_size: 20 })
      if (response.code === 0) {
        setHistory(response.data.items)
      } else {
        toast.error(response.msg || "历史记录加载失败")
      }
    } catch (err) {
      toast.error(extractErrorMessage(err, "历史记录加载失败"))
    } finally {
      setIsHistoryLoading(false)
    }
  }

  function closeTaskEventStream(taskId?: string) {
    if (!taskEventSourceRef.current) {
      return
    }
    if (taskId && taskEventSourceRef.current.taskId !== taskId) {
      return
    }
    taskEventSourceRef.current.source.close()
    taskEventSourceRef.current = null
  }

  function upsertHistoryTask(
    taskId: string,
    patch: Partial<ScriptHistoryItem> & Pick<ScriptHistoryItem, "status">
  ) {
    setHistory((current) => {
      const index = current.findIndex((item) => item.id === taskId)
      if (index === -1) {
        return current
      }
      const next = [...current]
      next[index] = {
        ...next[index],
        ...patch,
      }
      return next
    })
  }

  async function handleTaskEvent(taskId: string, event: ScriptTaskEvent) {
    setGenerationStepText(getGenerationStepText(event.stage, event.message))
    setTaskProgressMessage(event.message || "")
    setActiveTaskMeta((current) =>
      current && current.id === taskId
        ? {
            ...current,
            status: event.status,
            err_msg: event.error || current.err_msg,
            updated_at: event.timestamp || current.updated_at,
          }
        : current
    )
    upsertHistoryTask(taskId, {
      status: event.status,
      err_msg: event.error,
      updated_at: event.timestamp || new Date().toISOString(),
    })

    if (event.status === "succeeded") {
      closeTaskEventStream(taskId)
      setIsSubmitting(false)
      setShowGenerationOverlay(false)
      setGenerationStepIndex(0)
      setGenerationStepText(GENERATION_STEPS[0])
      setTaskProgressMessage("")
      await loadDetailById(taskId, "第一版剧本已生成完成，你可以继续审阅结构和编辑 YAML。")
      await loadHistory()
      return
    }

    if (event.status === "failed") {
      closeTaskEventStream(taskId)
      setIsSubmitting(false)
      setShowGenerationOverlay(false)
      setGenerationStepIndex(0)
      setGenerationStepText(GENERATION_STEPS[0])
      setTaskProgressMessage(event.error || event.message || "任务执行失败。")
      toast.error(event.error || event.message || "生成失败，请稍后重试。")
      await loadDetailById(taskId)
      await loadHistory()
    }
  }

  function startTaskEventStream(taskId: string, eventUrl: string) {
    if (taskEventSourceRef.current?.taskId === taskId) {
      return
    }

    closeTaskEventStream()

    const eventSource = openScriptEventStream(
      eventUrl,
      (event) => {
        void handleTaskEvent(taskId, event)
      },
      () => {
        setTaskProgressMessage((current) => current || "状态流短暂断开，正在尝试自动重连。")
      }
    )

    taskEventSourceRef.current = {
      taskId,
      source: eventSource,
    }
  }

  async function loadDetailById(taskId: string, successMessage?: string) {
    setSelectedTaskId(taskId)

    try {
      const response = await getScriptDetail(taskId)
      if (response.code !== 0 || !response.data) {
        toast.error(response.msg || "历史详情加载失败。")
        return
      }

      const detail = response.data
      setActiveTaskMeta(detail.metadata)
      const result = makeResultFromDetail(detail)
      if (result) {
        setResultForEditing(result)
        closeTaskEventStream(taskId)
        setIsSubmitting(false)
        setTaskProgressMessage("")
        setSelectedNodeId(null)
        setSearchParams({ view: "detail", id: taskId })
        setView("overview")
        if (successMessage) {
          toast.success(successMessage)
        }
      } else {
        setResultForEditing(null)
        setSearchParams({ view: "detail", id: taskId })
        if (detail.metadata.status === "pending" || detail.metadata.status === "running") {
          setTaskProgressMessage("任务仍在处理中，正在同步后台进度。")
          setGenerationStepText(getGenerationStepText(detail.metadata.status))
          setIsSubmitting(true)
          setShowGenerationOverlay(false)
          startTaskEventStream(taskId, `/api/v1/script/${taskId}/events`)
        } else {
          setTaskProgressMessage(detail.metadata.err_msg || "")
        }
      }
    } catch (err) {
      toast.error(extractErrorMessage(err, "历史详情加载失败。"))
    }
  }

  loadDetailByIdRef.current = async (taskId: string) => {
    await loadDetailById(taskId)
  }

  useEffect(() => {
    const taskIdFromQuery = searchParams.get("id")
    const viewFromQuery = searchParams.get("view")

    if (viewFromQuery !== "detail" || !taskIdFromQuery) {
      return
    }

    if (
      selectedTaskId === taskIdFromQuery &&
      (activeResultId === taskIdFromQuery || activeTaskMeta?.id === taskIdFromQuery)
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      void loadDetailByIdRef.current(taskIdFromQuery)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [searchParams, selectedTaskId, activeResultId, activeTaskMeta?.id])

  function toggleStatusFilter(status: ScriptTaskStatus) {
    setStatusFilters((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status]
    )
  }

  async function handleSubmit(
    event: Parameters<NonNullable<ComponentProps<"form">["onSubmit"]>>[0]
  ) {
    event.preventDefault()

    const trimmedChapters = draft.chapters.map((chapter) => ({
      title: chapter.title.trim(),
      text: chapter.text.trim(),
    }))

    if (trimmedChapters.length < 3) {
      toast.error("至少需要输入 3 个章节内容。")
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
      setView("overview")
      await loadHistory()
      startTaskEventStream(response.data.id, response.data.event_url)
    } catch (err) {
      toast.error(extractErrorMessage(err, "生成失败，请检查服务状态后重试。"))
    } finally {
      if (!taskEventSourceRef.current) {
        setIsSubmitting(false)
        setShowGenerationOverlay(false)
        setGenerationStepIndex(0)
        setGenerationStepText(GENERATION_STEPS[0])
      }
    }
  }

  async function handleLoadHistory(item: ScriptHistoryItem) {
    await loadDetailById(item.id, `已载入「${item.title}」的结果，你可以继续审阅结构。`)
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

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchesStatus =
        statusFilters.length === 0 || statusFilters.includes(item.status as ScriptTaskStatus)
      const matchesSearch =
        search.trim() === "" || item.title.toLowerCase().includes(search.trim().toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [history, search, statusFilters])

  const statusFilterLabel =
    statusFilters.length === 0
      ? "全部状态"
      : statusFilters.length === 1
        ? STATUS_FILTER_OPTIONS.find((item) => item.value === statusFilters[0])?.label ??
          "状态筛选"
        : `已选 ${statusFilters.length} 项`

  return {
    activeTaskMeta,
    filteredHistory,
    handleDeleteHistory,
    handleLoadHistory,
    handleRetryHistory,
    handleSubmit,
    history,
    historyActionState,
    isHistoryLoading,
    isStatusMenuOpen,
    loadDetailById,
    loadHistory,
    search,
    selectedTaskId,
    setActiveTaskMeta,
    setHistory,
    setIsStatusMenuOpen,
    setSearch,
    setSelectedTaskId,
    setStatusFilters,
    statusFilterLabel,
    statusFilters,
    statusMenuRef,
    taskProgressMessage,
    toggleStatusFilter,
  }
}
