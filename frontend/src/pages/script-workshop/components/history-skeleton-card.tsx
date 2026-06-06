export function HistorySkeletonCard({ index }: { index: number }) {
  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both rounded-[24px] border border-black/6 bg-white px-5 py-5 shadow-[0_14px_40px_rgba(15,23,42,0.04)]"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="animate-pulse">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="h-6 w-32 rounded-full bg-slate-200" />
            <div className="h-4 w-40 rounded-full bg-slate-100" />
          </div>
          <div className="h-4 w-12 rounded-full bg-slate-100" />
        </div>
        <div className="mt-4 rounded-[18px] bg-slate-50 px-3 py-3">
          <div className="h-3 w-16 rounded-full bg-slate-200" />
          <div className="mt-3 space-y-2">
            <div className="h-4 w-10/12 rounded-full bg-slate-200" />
            <div className="h-4 w-8/12 rounded-full bg-slate-100" />
            <div className="h-4 w-9/12 rounded-full bg-slate-100" />
          </div>
        </div>
        <div className="mt-8 flex items-center justify-between">
          <div className="h-3 w-20 rounded-full bg-slate-100" />
          <div className="h-3 w-14 rounded-full bg-slate-100" />
        </div>
      </div>
    </div>
  )
}
