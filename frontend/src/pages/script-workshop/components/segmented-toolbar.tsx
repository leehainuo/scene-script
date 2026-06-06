import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type SegmentedToolbarItem = {
  key: string
  label: string
  count?: number
}

type SegmentedToolbarProps = {
  items: readonly SegmentedToolbarItem[]
  activeKey: string
  onChange: (key: string) => void
  helperText?: string
  actions?: ReactNode
  className?: string
}

export function SegmentedToolbar({
  items,
  activeKey,
  onChange,
  helperText,
  actions,
  className,
}: SegmentedToolbarProps) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="flex items-center gap-2 p-1">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={cn(
              "inline-flex h-12 items-center gap-2 rounded-lg px-5 text-sm font-medium transition-colors",
              activeKey === item.key
                ? "bg-slate-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)]"
                : "text-slate-500 hover:text-slate-900"
            )}
          >
            <span>{item.label}</span>
            {typeof item.count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs leading-none",
                  activeKey === item.key ? "bg-white/15 text-white" : "bg-white text-slate-400"
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {helperText || actions ? (
        <div className="flex flex-wrap items-center gap-3">
          {helperText ? <p className="text-sm text-slate-400">{helperText}</p> : null}
          {actions}
        </div>
      ) : null}
    </div>
  )
}
