import { Button } from "@/components/ui/button"

type RenameConfirmDialogProps = {
  renameConfirm: {
    kind: "characters" | "settings"
    previousName: string
    nextName: string
  } | null
  onClose: () => void
  onConfirm: () => void
}

export function RenameConfirmDialog({
  renameConfirm,
  onClose,
  onConfirm,
}: RenameConfirmDialogProps) {
  if (!renameConfirm) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[460px] rounded-[28px] border border-black/6 bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">同步确认</p>
        <h3 className="mt-3 text-xl font-semibold text-slate-900">
          {renameConfirm.kind === "characters" ? "人物改名" : "地点改名"}
        </h3>
        <p className="mt-3 text-sm leading-7 text-slate-500">
          你把
          {renameConfirm.kind === "characters" ? "人物" : "地点"}
          「{renameConfirm.previousName}」改成了「{renameConfirm.nextName}」。
          现在可以只更新注册表名称，或把正文中的相关引用一起同步更新。
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-black/8 bg-white text-slate-600 hover:bg-slate-50"
          >
            只改注册表
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            同步所有引用
          </Button>
        </div>
      </div>
    </div>
  )
}
