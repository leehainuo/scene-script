import { FileUp, Sparkles, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ImportedTextChapter } from "@/lib/text-import"

type TextImportDialogProps = {
  open: boolean
  sourceText: string
  parsedChapters: ImportedTextChapter[]
  parseError: string
  currentDraftChapterCount: number
  onClose: () => void
  onSourceTextChange: (value: string) => void
  onParse: () => void
  onImport: () => void
  onAddChapter: () => void
  onRemoveChapter: (index: number) => void
  onChapterChange: (index: number, field: "title" | "text", value: string) => void
}

export function TextImportDialog({
  open,
  sourceText,
  parsedChapters,
  parseError,
  currentDraftChapterCount,
  onClose,
  onSourceTextChange,
  onParse,
  onImport,
  onAddChapter,
  onRemoveChapter,
  onChapterChange,
}: TextImportDialogProps) {
  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/22 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-6"
      onClick={onClose}
    >
      <div
        className="mx-auto my-auto flex w-full max-w-[1180px] max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-[28px] border border-black/6 bg-white p-4 shadow-[0_32px_90px_rgba(15,23,42,0.16)] sm:max-h-[calc(100vh-3rem)] sm:rounded-[32px] sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs text-sky-600">
              <FileUp className="h-3.5 w-3.5" />
              全文导入
            </div>
            <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
              粘贴全文，自动拆章后再确认导入
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              系统会先按常见章节标题和段落结构自动拆章，你可以修改标题与正文，再导入到当前工作台。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭导入弹层"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="flex min-h-0 flex-col rounded-[28px] border border-black/6 bg-slate-50/70 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">全文粘贴</p>
                <p className="mt-1 text-sm text-slate-500">支持常见的“第一章 / Chapter 1 / 序章”等格式。</p>
              </div>
              <Button
                type="button"
                onClick={onParse}
                className="h-10 rounded-2xl bg-slate-900 px-4 text-white hover:bg-slate-800"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                自动拆章
              </Button>
            </div>

            <textarea
              value={sourceText}
              onChange={(event) => onSourceTextChange(event.target.value)}
              placeholder="把整篇小说正文粘贴到这里。建议保留原始章节标题，自动拆章会更准确。"
              className="mt-4 min-h-[260px] flex-1 rounded-[24px] border border-black/8 bg-white px-4 py-4 text-[15px] leading-8 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-200 focus:ring-3 focus:ring-sky-100 sm:px-5 sm:py-5 lg:min-h-0"
            />
          </div>

          <div className="flex min-h-0 flex-col rounded-[28px] border border-black/6 bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">拆章确认</p>
                <p className="mt-1 text-sm text-slate-500">
                  当前识别出 {parsedChapters.length} 章，导入后会替换工作台现有章节。
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={onAddChapter}
                className="h-10 rounded-2xl border-black/8 bg-white text-slate-600 hover:bg-slate-50"
              >
                新增章节
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs text-sky-700">
                识别结果 {parsedChapters.length} 章
              </span>
              <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs text-amber-700">
                将替换当前 {currentDraftChapterCount} 章草稿
              </span>
            </div>

            {parseError ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {parseError}
              </div>
            ) : null}

            <div className="mt-4 min-h-[220px] flex-1 space-y-4 overflow-y-auto pr-1">
              {parsedChapters.length === 0 ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-[24px] border border-dashed border-black/8 px-4 py-12 text-center text-sm leading-7 text-slate-400">
                  先粘贴全文，再点击“自动拆章”，这里会显示可编辑的拆章结果。
                </div>
              ) : (
                parsedChapters.map((chapter, index) => (
                  <div key={`${chapter.title}-${index}`} className="rounded-[24px] border border-black/6 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                        章节 {index + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => onRemoveChapter(index)}
                        className="text-slate-300 transition-colors hover:text-rose-500"
                        aria-label={`删除章节 ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <Input
                      value={chapter.title}
                      onChange={(event) => onChapterChange(index, "title", event.target.value)}
                      placeholder={`第 ${index + 1} 章`}
                      className="mt-3 h-11 rounded-2xl border-black/8 bg-white"
                    />
                    <textarea
                      value={chapter.text}
                      onChange={(event) => onChapterChange(index, "text", event.target.value)}
                      placeholder="这一章的正文内容"
                      className="mt-3 min-h-[140px] w-full rounded-[20px] border border-black/8 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-200 focus:ring-3 focus:ring-sky-100"
                    />
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-black/6 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-400">
                建议至少确认 3 章，再导入工作台继续打磨；导入后仍可逐章编辑。
              </p>
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="h-10 rounded-2xl border-black/8 bg-white text-slate-600 hover:bg-slate-50"
                >
                  取消
                </Button>
                <Button
                  type="button"
                  onClick={onImport}
                  disabled={parsedChapters.length === 0}
                  className="h-10 rounded-2xl bg-slate-900 px-4 text-white hover:bg-slate-800"
                >
                  {parsedChapters.length > 0
                    ? `导入 ${parsedChapters.length} 章到工作台`
                    : "导入到工作台"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
