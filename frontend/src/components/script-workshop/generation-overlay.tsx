import { LoaderCircle, Wand2 } from "lucide-react"

type GenerationOverlayProps = {
  stepText: string
  chapterCount: number
  genre: string
  tone: string
  pacing: string
}

export function GenerationOverlay({
  stepText,
  chapterCount,
  genre,
  tone,
  pacing,
}: GenerationOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/18 backdrop-blur-sm">
      <div className="relative w-[min(92vw,540px)] overflow-hidden rounded-[32px] border border-white/70 bg-white/92 p-8 shadow-[0_40px_120px_rgba(15,23,42,0.18)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-sky-400 via-cyan-300 to-slate-900" />

        <div className="flex flex-col items-center text-center">
          <div className="relative flex h-28 w-28 items-center justify-center">
            <div className="absolute h-28 w-28 animate-ping rounded-full bg-sky-100/80" />
            <div className="absolute h-24 w-24 rounded-full border border-sky-200" />
            <div className="absolute h-16 w-16 animate-spin rounded-full border-2 border-slate-900/15 border-t-slate-900" />
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
              <Wand2 className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            AI 正在搭建剧本初稿
          </div>

          <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
            正在把小说推成剧本
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">{stepText}</p>

          <div className="mt-6 grid w-full gap-3 sm:grid-cols-3">
            {[
              { label: "章节", value: `${chapterCount} 章` },
              { label: "风格", value: genre },
              { label: "语气 / 节奏", value: `${tone} / ${pacing}` },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-black/6 bg-slate-50 px-4 py-3"
              >
                <p className="text-xs text-slate-400">{item.label}</p>
                <p className="mt-1 text-sm font-medium text-slate-800">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 w-full space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-linear-to-r from-sky-400 via-cyan-300 to-slate-900" />
            </div>
            <p className="text-xs text-slate-400">
              首次生成和自动修复可能需要几十秒，请不要关闭页面。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
