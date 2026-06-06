import { Trash2 } from "lucide-react"
import { formatTextCount } from "@/lib/script-workshop"
import { Input } from "@/components/ui/input"

type ChapterEditorPanelProps = {
  eyebrow: string
  heading: string
  title: string
  text: string
  titlePlaceholder: string
  textPlaceholder: string
  statusLabel: string
  textCount: number
  onTitleChange: (value: string) => void
  onTextChange: (value: string) => void
  onRemove?: () => void
  emptyState?: string
  minHeightClassName?: string
}

export function ChapterEditorPanel({
  eyebrow,
  heading,
  title,
  text,
  titlePlaceholder,
  textPlaceholder,
  statusLabel,
  textCount,
  onTitleChange,
  onTextChange,
  onRemove,
  emptyState,
  minHeightClassName = "min-h-[360px]",
}: ChapterEditorPanelProps) {
  if (emptyState) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-[24px] border border-dashed border-black/8 px-4 py-12 text-center text-sm leading-7 text-slate-400">
        {emptyState}
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{heading}</p>
        </div>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="text-slate-300 transition-colors hover:text-rose-500"
            aria-label="删除当前章节"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        <Input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder={titlePlaceholder}
          className="h-12 rounded-2xl border-black/8 bg-white text-base text-slate-900 placeholder:text-slate-400"
        />
        <textarea
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder={textPlaceholder}
          className={`${minHeightClassName} w-full rounded-[24px] border border-black/8 bg-white px-5 py-5 text-[15px] leading-8 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-200 focus:ring-3 focus:ring-sky-100`}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[20px] border border-black/6 bg-white/70 px-4 py-3 text-xs text-slate-500">
          <span>当前章节状态：{statusLabel}</span>
          <span>{formatTextCount(textCount)}</span>
        </div>
      </div>
    </>
  )
}
