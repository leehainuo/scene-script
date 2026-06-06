import { useCallback, useEffect, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import type { SetURLSearchParams } from "react-router-dom"
import { toast } from "sonner"
import {
  extractErrorMessage,
  GENERATION_STEPS,
  getGenerationStepText,
  makeResultFromDetail,
} from "@/lib/script-workshop"
import { getScriptDetail, openScriptEventStream } from "@/services"
import type { ResultView, WorkshopResult } from "@/lib/script-workshop"
import type { ScriptHistoryItem, ScriptTaskEvent, ScriptTaskMeta } from "@/types"

type UseScriptWorkshopStreamOptions = {
  searchParams: URLSearchParams
  setSearchParams: SetURLSearchParams
  activeResultId: string | null
  loadHistory: () => Promise<void>
  upsertHistoryTask: (
    taskId: string,
    patch: Partial<ScriptHistoryItem> & Pick<ScriptHistoryItem, "status">
  ) => void
  setResultForEditing: (result: WorkshopResult | null) => void
  setIsSubmitting: Dispatch<SetStateAction<boolean>>
  setShowGenerationOverlay: Dispatch<SetStateAction<boolean>>
  setGenerationStepIndex: Dispatch<SetStateAction<number>>
  setGenerationStepText: Dispatch<SetStateAction<string>>
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>
  setView: Dispatch<SetStateAction<ResultView>>
}

export function useScriptWorkshopStream({
  searchParams,
  setSearchParams,
  activeResultId,
  loadHistory,
  upsertHistoryTask,
  setResultForEditing,
  setIsSubmitting,
  setShowGenerationOverlay,
  setGenerationStepIndex,
  setGenerationStepText,
  setSelectedNodeId,
  setView,
}: UseScriptWorkshopStreamOptions) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [activeTaskMeta, setActiveTaskMeta] = useState<ScriptTaskMeta | null>(null)
  const [taskProgressMessage, setTaskProgressMessage] = useState("")

  const taskEventSourceRef = useRef<{ taskId: string; source: EventSource } | null>(null)
  const loadDetailByIdRef = useRef<(taskId: string) => Promise<void>>(async () => {})

  const closeTaskEventStream = useCallback((taskId?: string) => {
    if (!taskEventSourceRef.current) {
      return
    }
    if (taskId && taskEventSourceRef.current.taskId !== taskId) {
      return
    }
    taskEventSourceRef.current.source.close()
    taskEventSourceRef.current = null
  }, [])

  const loadDetailById = useCallback(
    async (taskId: string, successMessage?: string) => {
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
          setView("summary")
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
            const eventSource = openScriptEventStream(
              `/api/v1/script/${taskId}/events`,
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
          } else {
            setTaskProgressMessage(detail.metadata.err_msg || "")
          }
        }
      } catch (err) {
        toast.error(extractErrorMessage(err, "历史详情加载失败。"))
      }
    },
    [
      closeTaskEventStream,
      setGenerationStepText,
      setIsSubmitting,
      setResultForEditing,
      setSearchParams,
      setSelectedNodeId,
      setShowGenerationOverlay,
      setView,
    ]
  )

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
      await loadDetailByIdRef.current(taskId)
      toast.success("第一版剧本已生成完成，你可以继续审阅结构和编辑 YAML。")
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
      await loadDetailByIdRef.current(taskId)
      await loadHistory()
    }
  }

  const startTaskEventStream = useCallback(
    (taskId: string, eventUrl: string) => {
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
    },
    [closeTaskEventStream]
  )

  loadDetailByIdRef.current = async (taskId: string) => {
    await loadDetailById(taskId)
  }

  useEffect(() => {
    return () => {
      taskEventSourceRef.current?.source.close()
      taskEventSourceRef.current = null
    }
  }, [])

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

  return {
    activeTaskMeta,
    closeTaskEventStream,
    loadDetailById,
    selectedTaskId,
    setActiveTaskMeta,
    setSelectedTaskId,
    setTaskProgressMessage,
    startTaskEventStream,
    taskProgressMessage,
  }
}
