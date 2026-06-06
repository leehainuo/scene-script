import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { extractErrorMessage, STATUS_FILTER_OPTIONS } from "@/lib/script-workshop"
import type { ScriptTaskStatus } from "@/lib/script-workshop"
import { getScriptHistory } from "@/services"
import type { ScriptHistoryItem } from "@/types"

export function useScriptWorkshopHistory() {
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [statusFilters, setStatusFilters] = useState<ScriptTaskStatus[]>([])
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [history, setHistory] = useState<ScriptHistoryItem[]>([])

  const statusMenuRef = useRef<HTMLDivElement | null>(null)

  const loadHistory = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

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

  const upsertHistoryTask = useCallback(
    (taskId: string, patch: Partial<ScriptHistoryItem> & Pick<ScriptHistoryItem, "status">) => {
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
    },
    []
  )

  const toggleStatusFilter = useCallback((status: ScriptTaskStatus) => {
    setStatusFilters((current) =>
      current.includes(status) ? current.filter((item) => item !== status) : [...current, status]
    )
  }, [])

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
    filteredHistory,
    history,
    isHistoryLoading,
    isStatusMenuOpen,
    loadHistory,
    search,
    setHistory,
    setIsStatusMenuOpen,
    setSearch,
    setStatusFilters,
    statusFilterLabel,
    statusFilters,
    statusMenuRef,
    toggleStatusFilter,
    upsertHistoryTask,
  }
}
