import type { ChapterSummary } from "@/lib/script-workshop"
import { MAX_SOURCE_CHAPTERS } from "@/lib/script-workshop"
import { cn } from "@/lib/utils"

type ChapterSummaryGridProps = {
  summaries: ChapterSummary[]
  activeIndex: number
  onSelect: (index: number) => void
  onAdd: () => void
  addDisabled: boolean
  addEyebrow: string
  addHint: string
}

export function ChapterSummaryGrid({
  summaries,
  activeIndex,
  onSelect,
  onAdd,
  addDisabled,
  addEyebrow,
  addHint,
}: ChapterSummaryGridProps) {
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {summaries.map((chapter) => (
        <button
          key={`${chapter.title}-${chapter.index}`}
          type="button"
          onClick={() => onSelect(chapter.index)}
          className={cn(
            "rounded-[22px] border px-4 py-3 text-left transition-colors",
            activeIndex === chapter.index
              ? "border-slate-900 bg-slate-900 text-white shadow-[0_18px_36px_rgba(15,23,42,0.12)]"
              : "border-black/8 bg-white text-slate-600 hover:bg-slate-50"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.18em] text-inherit/70">第 {chapter.index + 1} 章</p>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px]",
                activeIndex === chapter.index
                  ? "bg-white/14 text-white"
                  : chapter.completionState === "ready"
                    ? "bg-emerald-50 text-emerald-700"
                    : chapter.completionState === "partial"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-100 text-slate-500"
              )}
            >
              {chapter.statusLabel}
            </span>
          </div>
          <p className="mt-3 line-clamp-1 text-sm font-medium">{chapter.title}</p>
          <p className="mt-1 text-xs text-inherit/70">{chapter.detailLabel}</p>
        </button>
      ))}
      <button
        type="button"
        onClick={onAdd}
        disabled={addDisabled}
        className="rounded-[22px] border border-dashed border-black/10 bg-white px-4 py-3 text-left text-sm text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{addEyebrow}</p>
        <p className="mt-3 font-medium text-slate-700">+ 新增章节</p>
        <p className="mt-1 text-xs text-slate-400">
          {addDisabled ? `已达到 ${MAX_SOURCE_CHAPTERS} 章上限` : addHint}
        </p>
      </button>
    </div>
  )
}
