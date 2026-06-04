import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function StudioPanel({
  eyebrow,
  title,
  description,
  children,
  actions,
  className,
  contentClassName,
}: {
  eyebrow?: string
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-white/60 bg-white/72 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_28px_70px_rgba(15,23,42,0.12)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-black/5 px-5 py-4">
        <div className="space-y-1.5">
          {eyebrow ? (
            <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description ? (
            <p className="max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </section>
  )
}
