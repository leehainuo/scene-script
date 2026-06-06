import type { ReactNode } from "react"
import { SegmentedToolbar } from "@/pages/script-workshop/components/segmented-toolbar"
import type { ResultView } from "@/lib/script-workshop"

type ScriptDetailHeaderProps = {
  title: string
  hasUnsavedChanges: boolean
  view: ResultView
  onViewChange: (view: ResultView) => void
  tabs: Array<{ key: ResultView; label: string; count?: number }>
  children: ReactNode
}

export function ScriptDetailHeader({
  title,
  hasUnsavedChanges,
  view,
  onViewChange,
  tabs,
  children,
}: ScriptDetailHeaderProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">Detail</p>
          <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-slate-950">{title}</h2>
        </div>
        {hasUnsavedChanges ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
            有未保存修改
          </span>
        ) : null}
      </div>

      <div className="sticky top-4 z-10">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out fill-mode-both rounded-xl border border-black/6 bg-white/76 p-3 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <SegmentedToolbar
            items={tabs}
            activeKey={view}
            onChange={(key) => onViewChange(key as ResultView)}
          />
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out fill-mode-both rounded-[30px] border border-black/6 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
