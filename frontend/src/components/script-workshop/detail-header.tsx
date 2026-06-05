import type { ReactNode } from "react"
import { StudioPanel } from "@/components/studio/studio-panel"
import { cn } from "@/lib/utils"

type ResultView = "overview" | "yaml" | "structure"

type ScriptDetailHeaderProps = {
  title: string
  hasUnsavedChanges: boolean
  view: ResultView
  onViewChange: (view: ResultView) => void
  children: ReactNode
}

const VIEW_OPTIONS: Array<{ key: ResultView; label: string }> = [
  { key: "overview", label: "概览" },
  { key: "yaml", label: "YAML" },
  { key: "structure", label: "结构" },
]

export function ScriptDetailHeader({
  title,
  hasUnsavedChanges,
  view,
  onViewChange,
  children,
}: ScriptDetailHeaderProps) {
  return (
    <StudioPanel
      eyebrow="Detail"
      title={title}
      description="结果详情保持简单干净，只展示最关键的信息。"
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {hasUnsavedChanges ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
              有未保存修改
            </span>
          ) : null}
          {VIEW_OPTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onViewChange(item.key)}
              className={cn(
                "h-11 rounded-[18px] border px-4 text-sm transition-colors",
                view === item.key
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-black/8 bg-white text-slate-500 hover:bg-slate-50"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      }
      className="rounded-[30px] border-black/6 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
    >
      {children}
    </StudioPanel>
  )
}
