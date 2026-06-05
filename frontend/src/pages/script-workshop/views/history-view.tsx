import type { RefObject } from "react"
import { Check, ChevronDown, ListFilter, LoaderCircle, RefreshCw, Trash2 } from "lucide-react"
import { HistorySkeletonCard } from "@/components/script-workshop/history-skeleton-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatScriptStyleSummary } from "@/lib/script-display"
import {
  formatDateTime,
  getHistoryCardCopy,
  getStatusMeta,
  STATUS_FILTER_OPTIONS,
} from "@/lib/script-workshop"
import type { ScriptTaskStatus } from "@/lib/script-workshop"
import { cn } from "@/lib/utils"
import type { ScriptHistoryItem } from "@/types"

type HistoryActionState =
  | {
      taskId: string
      kind: "retry" | "delete"
    }
  | null

type HistoryViewProps = {
  search: string
  setSearch: (value: string) => void
  statusMenuRef: RefObject<HTMLDivElement | null>
  isStatusMenuOpen: boolean
  setIsStatusMenuOpen: (next: boolean | ((prev: boolean) => boolean)) => void
  statusFilterLabel: string
  statusFilters: ScriptTaskStatus[]
  setStatusFilters: (next: ScriptTaskStatus[]) => void
  toggleStatusFilter: (status: ScriptTaskStatus) => void
  loadHistory: () => Promise<void>
  isHistoryLoading: boolean
  filteredHistory: ScriptHistoryItem[]
  selectedTaskId: string | null
  historyActionState: HistoryActionState
  handleLoadHistory: (item: ScriptHistoryItem) => Promise<void>
  handleRetryHistory: (item: ScriptHistoryItem) => Promise<void>
  handleDeleteHistory: (item: ScriptHistoryItem) => Promise<void>
}

export function HistoryView({
  search,
  setSearch,
  statusMenuRef,
  isStatusMenuOpen,
  setIsStatusMenuOpen,
  statusFilterLabel,
  statusFilters,
  setStatusFilters,
  toggleStatusFilter,
  loadHistory,
  isHistoryLoading,
  filteredHistory,
  selectedTaskId,
  historyActionState,
  handleLoadHistory,
  handleRetryHistory,
  handleDeleteHistory,
}: HistoryViewProps) {
  return (
    <div className="mx-auto max-w-[1040px] space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">Works</p>
          <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-slate-950">作品</h2>
          <p className="mt-2 text-sm text-slate-500">
            像作品墙一样浏览全部结果，点击任一张卡片进入详情。
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="sticky top-4 z-10">
          <div className="rounded-xl border border-black/6 bg-white/76 p-3 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索剧本标题"
                className="h-11 flex-1 border-black/8 bg-slate-50 text-slate-900 placeholder:text-slate-400"
              />
              <div className="flex shrink-0 items-center gap-3">
                <div ref={statusMenuRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsStatusMenuOpen((open) => !open)}
                    className="flex h-11 min-w-[148px] items-center justify-between gap-3 rounded-lg border border-black/8 bg-white px-4 text-sm text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    <span className="inline-flex items-center gap-2">
                      <ListFilter className="h-4 w-4 text-slate-400" />
                      {statusFilterLabel}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-slate-400 transition-transform",
                        isStatusMenuOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {isStatusMenuOpen ? (
                    <div className="absolute right-0 top-[calc(100%+10px)] z-20 w-56 rounded-xl border border-black/6 bg-white/95 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.1)] backdrop-blur-xl">
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                          状态筛选
                        </span>
                        {statusFilters.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setStatusFilters([])}
                            className="text-xs text-slate-400 transition-colors hover:text-slate-900"
                          >
                            清空
                          </button>
                        ) : null}
                      </div>

                      <div className="space-y-1">
                        {STATUS_FILTER_OPTIONS.map((item) => {
                          const checked = statusFilters.includes(item.value)
                          return (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => toggleStatusFilter(item.value)}
                              className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950"
                            >
                              <span>{item.label}</span>
                              <span
                                className={cn(
                                  "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
                                  checked
                                    ? "border-slate-900 bg-slate-900 text-white"
                                    : "border-black/8 bg-white text-transparent"
                                )}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void loadHistory()}
                  className="h-11 rounded-lg border border-black/8 bg-white px-4 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {isHistoryLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <HistorySkeletonCard key={index} index={index} />
              ))}
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-black/8 px-4 py-10 text-center text-sm text-slate-400">
              还没有作品。
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredHistory.map((item, index) => {
                const meta = getStatusMeta(item.status)
                const cardCopy = getHistoryCardCopy(item)
                const canRetry = item.status === "failed"
                const canDelete = item.status === "succeeded" || item.status === "failed"
                const isRetrying =
                  historyActionState?.taskId === item.id && historyActionState.kind === "retry"
                const isDeleting =
                  historyActionState?.taskId === item.id && historyActionState.kind === "delete"
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => void handleLoadHistory(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        void handleLoadHistory(item)
                      }
                    }}
                    className={cn(
                      "group w-full rounded-[24px] border px-5 py-5 text-left outline-none transition-[transform,box-shadow,border-color]",
                      "animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both",
                      "flex min-h-[220px] flex-col justify-between shadow-[0_14px_40px_rgba(15,23,42,0.04)] focus-visible:border-sky-300 focus-visible:ring-3 focus-visible:ring-sky-100",
                      selectedTaskId === item.id
                        ? "border-slate-200 bg-slate-50 hover:border-sky-300 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)]"
                        : "border-black/6 bg-white hover:border-sky-300 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)]"
                    )}
                    style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-base font-medium text-slate-900">{item.title}</p>
                          <p className="mt-1 text-sm text-slate-400">
                            {formatScriptStyleSummary(item.genre, item.tone, item.pacing)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs font-medium", meta.textClass)}>
                            {meta.label}
                          </span>
                          {canRetry || canDelete ? (
                            <div className="-mr-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                              {canRetry ? (
                                <button
                                  type="button"
                                  disabled={isRetrying || isDeleting}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void handleRetryHistory(item)
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-slate-900 disabled:pointer-events-none disabled:opacity-50"
                                  aria-label={`重试 ${item.title}`}
                                >
                                  {isRetrying ? (
                                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              ) : null}
                              {canDelete ? (
                                <button
                                  type="button"
                                  disabled={isRetrying || isDeleting}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void handleDeleteHistory(item)
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-rose-600 disabled:pointer-events-none disabled:opacity-50"
                                  aria-label={`删除 ${item.title}`}
                                >
                                  {isDeleting ? (
                                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className={cn("mt-4 rounded-[18px] px-3 py-3", cardCopy.toneClass)}>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                          {cardCopy.eyebrow}
                        </p>
                        <p className="mt-2 text-sm font-medium leading-6 text-slate-800">
                          {cardCopy.title}
                        </p>
                        <p className="mt-1.5 text-sm leading-6">{cardCopy.body}</p>
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between text-xs text-slate-400">
                      <span>{formatDateTime(item.updated_at)}</span>
                      <span>{item.source_chapters} 章输入</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

