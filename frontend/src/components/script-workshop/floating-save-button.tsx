import { LoaderCircle, Save } from "lucide-react"
import { cn } from "@/lib/utils"

type FloatingSaveButtonProps = {
  isSaving: boolean
  hasUnsavedChanges: boolean
  onClick: () => void
}

export function FloatingSaveButton({
  isSaving,
  hasUnsavedChanges,
  onClick,
}: FloatingSaveButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isSaving || !hasUnsavedChanges}
      aria-label={isSaving ? "正在保存" : "保存修改"}
      title={isSaving ? "正在保存" : hasUnsavedChanges ? "保存修改" : "暂无可保存修改"}
      className={cn(
        "fixed bottom-6 right-6 z-40 flex h-[45px] w-[45px] items-center justify-center rounded-full shadow-[0_20px_60px_rgba(15,23,42,0.24)] transition-all md:bottom-8 md:right-8",
        isSaving || hasUnsavedChanges
          ? "bg-slate-950 text-white hover:scale-[1.03] hover:bg-slate-900"
          : "cursor-not-allowed bg-slate-300 text-white shadow-none"
      )}
    >
      {isSaving ? (
        <LoaderCircle className="h-5 w-5 animate-spin" />
      ) : (
        <>
          <Save className="h-5 w-5" />
          {hasUnsavedChanges ? (
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-amber-300" />
          ) : null}
        </>
      )}
    </button>
  )
}
