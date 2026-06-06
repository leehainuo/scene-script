import type { Dispatch, SetStateAction } from "react"
import type { SetURLSearchParams } from "react-router-dom"
import type { ResultView, WorkshopResult } from "@/lib/script-workshop"
import type { ScriptConvertRequest } from "@/types"
import { useScriptWorkshopActions } from "./hooks/use-script-workshop-actions"
import { useScriptWorkshopHistory } from "./hooks/use-script-workshop-history"
import { useScriptWorkshopStream } from "./hooks/use-script-workshop-stream"

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
  const historyState = useScriptWorkshopHistory()

  const streamState = useScriptWorkshopStream({
    searchParams,
    setSearchParams,
    activeResultId,
    loadHistory: historyState.loadHistory,
    upsertHistoryTask: historyState.upsertHistoryTask,
    setResultForEditing,
    setIsSubmitting,
    setShowGenerationOverlay,
    setGenerationStepIndex,
    setGenerationStepText,
    setSelectedNodeId,
    setView,
  })

  const actionState = useScriptWorkshopActions({
    draft,
    setSearchParams,
    loadHistory: historyState.loadHistory,
    setHistory: historyState.setHistory,
    selectedTaskId: streamState.selectedTaskId,
    setSelectedTaskId: streamState.setSelectedTaskId,
    setActiveTaskMeta: streamState.setActiveTaskMeta,
    setResultForEditing,
    setTaskProgressMessage: streamState.setTaskProgressMessage,
    setIsSubmitting,
    setShowGenerationOverlay,
    setGenerationStepIndex,
    setGenerationStepText,
    setSelectedNodeId,
    setView,
    loadDetailById: streamState.loadDetailById,
    startTaskEventStream: streamState.startTaskEventStream,
    closeTaskEventStream: streamState.closeTaskEventStream,
  })

  return {
    activeTaskMeta: streamState.activeTaskMeta,
    filteredHistory: historyState.filteredHistory,
    handleDeleteHistory: actionState.handleDeleteHistory,
    handleLoadHistory: actionState.handleLoadHistory,
    handleRetryHistory: actionState.handleRetryHistory,
    handleSubmit: actionState.handleSubmit,
    history: historyState.history,
    historyActionState: actionState.historyActionState,
    isHistoryLoading: historyState.isHistoryLoading,
    isStatusMenuOpen: historyState.isStatusMenuOpen,
    loadDetailById: streamState.loadDetailById,
    loadHistory: historyState.loadHistory,
    search: historyState.search,
    selectedTaskId: streamState.selectedTaskId,
    setActiveTaskMeta: streamState.setActiveTaskMeta,
    setHistory: historyState.setHistory,
    setIsStatusMenuOpen: historyState.setIsStatusMenuOpen,
    setSearch: historyState.setSearch,
    setSelectedTaskId: streamState.setSelectedTaskId,
    setStatusFilters: historyState.setStatusFilters,
    statusFilterLabel: historyState.statusFilterLabel,
    statusFilters: historyState.statusFilters,
    statusMenuRef: historyState.statusMenuRef,
    taskProgressMessage: streamState.taskProgressMessage,
    toggleStatusFilter: historyState.toggleStatusFilter,
  }
}
