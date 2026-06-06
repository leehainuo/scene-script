import type { Dispatch, RefObject, SetStateAction } from "react"
import { ChevronDown, Check, FileUp, LoaderCircle, RefreshCw, Wand2 } from "lucide-react"
import { SectionPanel } from "@/components/shared/section-panel"
import { Button } from "@/components/ui/button"
import { ChapterEditorPanel } from "@/pages/script-workshop/components/chapter-editor-panel"
import { ChapterSummaryGrid } from "@/pages/script-workshop/components/chapter-summary-grid"
import {
  GENRE_OPTIONS,
  MAX_SOURCE_CHAPTERS,
  PACING_OPTIONS,
  TONE_OPTIONS,
  WORKSPACE_DRAFT_FORM_ID,
} from "@/lib/script-workshop"
import type {
  ChapterSummary,
  ImportedChapterDraft,
  Pacing,
  WorkspaceInputMode,
} from "@/lib/script-workshop"
import { cn } from "@/lib/utils"
import type { ScriptChapterInput, ScriptConvertRequest } from "@/types"

type WorkspaceViewProps = {
  draft: ScriptConvertRequest
  setDraft: Dispatch<SetStateAction<ScriptConvertRequest>>
  workspaceInputMode: WorkspaceInputMode
  setWorkspaceInputMode: Dispatch<SetStateAction<WorkspaceInputMode>>
  activeChapterIndex: number
  setActiveChapterIndex: Dispatch<SetStateAction<number>>
  activeChapter: ScriptChapterInput | undefined
  chapterSummaries: ChapterSummary[]
  activeChapterSummary: ChapterSummary | undefined
  addChapter: () => void
  canAddChapter: boolean
  updateChapter: (index: number, field: keyof ScriptChapterInput, value: string) => void
  canSubmitDraft: boolean
  isSubmitting: boolean
  handleSubmit: React.ComponentProps<"form">["onSubmit"]
  floatingAction: "submit" | "reset" | null
  setFloatingAction: Dispatch<SetStateAction<"submit" | "reset" | null>>
  handleResetDraft: () => void
  workspaceProgressText: string
  importProgressText: string
  importFileInputRef: RefObject<HTMLInputElement | null>
  handleImportTextFile: (event: React.ChangeEvent<HTMLInputElement>) => void
  importSourceText: string
  setImportSourceText: Dispatch<SetStateAction<string>>
  handleParseImportedText: () => void
  importedChapters: ImportedChapterDraft[]
  importedChapterSummaries: ChapterSummary[]
  activeImportedChapterIndex: number
  setActiveImportedChapterIndex: Dispatch<SetStateAction<number>>
  activeImportedChapter: ImportedChapterDraft | null
  activeImportedChapterSummary: ChapterSummary | undefined
  handleAddImportedChapter: () => void
  handleRemoveImportedChapter: (index: number) => void
  handleImportedChapterChange: (index: number, field: keyof ScriptChapterInput, value: string) => void
  handleApplyImportedChapters: () => void
}

export function WorkspaceView({
  draft,
  setDraft,
  workspaceInputMode,
  setWorkspaceInputMode,
  activeChapterIndex,
  setActiveChapterIndex,
  activeChapter,
  chapterSummaries,
  activeChapterSummary,
  addChapter,
  canAddChapter,
  updateChapter,
  canSubmitDraft,
  isSubmitting,
  handleSubmit,
  floatingAction,
  setFloatingAction,
  handleResetDraft,
  workspaceProgressText,
  importProgressText,
  importFileInputRef,
  handleImportTextFile,
  importSourceText,
  setImportSourceText,
  handleParseImportedText,
  importedChapters,
  importedChapterSummaries,
  activeImportedChapterIndex,
  setActiveImportedChapterIndex,
  activeImportedChapter,
  activeImportedChapterSummary,
  handleAddImportedChapter,
  handleRemoveImportedChapter,
  handleImportedChapterChange,
  handleApplyImportedChapters,
}: WorkspaceViewProps) {
  return (
    <div className="mx-auto max-w-[980px] space-y-6 pb-36">
      <div className="text-center">
        <p className="text-lg font-semibold text-slate-800">
          使用这个开始创作：
          <span className="ml-2 text-sky-500">AI 剧本转换</span>
        </p>
        <p className="mt-2 text-sm text-slate-400">
          从灵感开始，或上传章节内容，快速生成可编辑的剧本 YAML 初稿
        </p>
      </div>

      <SectionPanel
        eyebrow="Workspace"
        title="开始输入你的小说章节"
        animateOnMount
        animationDelayMs={40}
        actions={
          <div className="inline-flex rounded-xl border border-black/8 bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <button
              type="button"
              onClick={() => setWorkspaceInputMode("chapter")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm transition-colors",
                workspaceInputMode === "chapter"
                  ? "bg-slate-900 text-white shadow-[0_10px_20px_rgba(15,23,42,0.12)]"
                  : "text-slate-500 hover:text-slate-950"
              )}
            >
              逐章输入
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceInputMode("import")}
              className={cn(
                "inline-flex items-center rounded-lg px-4 py-2 text-sm transition-colors",
                workspaceInputMode === "import"
                  ? "bg-slate-900 text-white shadow-[0_10px_20px_rgba(15,23,42,0.12)]"
                  : "text-slate-500 hover:text-slate-950"
              )}
            >
              <FileUp className="mr-2 h-4 w-4" />
              全文导入
            </button>
          </div>
        }
        className="overflow-hidden rounded-[34px] border-black/6 bg-white/92 shadow-[0_24px_80px_rgba(15,23,42,0.08)]"
      >
        <form id={WORKSPACE_DRAFT_FORM_ID} className="space-y-5" onSubmit={handleSubmit}>
          <div className="rounded-[24px] border border-black/6 bg-slate-50/70 p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  体裁
                </span>
                <div className="relative">
                  <select
                    aria-label="选择体裁"
                    value={draft.genre}
                    onChange={(event) => setDraft((prev) => ({ ...prev, genre: event.target.value }))}
                    className="h-11 w-full appearance-none rounded-2xl border border-black/8 bg-white px-4 pr-10 text-sm text-slate-900 outline-none transition focus:border-sky-200 focus:ring-3 focus:ring-sky-100"
                  >
                    {GENRE_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  语气
                </span>
                <div className="relative">
                  <select
                    aria-label="选择语气"
                    value={draft.tone}
                    onChange={(event) => setDraft((prev) => ({ ...prev, tone: event.target.value }))}
                    className="h-11 w-full appearance-none rounded-2xl border border-black/8 bg-white px-4 pr-10 text-sm text-slate-900 outline-none transition focus:border-sky-200 focus:ring-3 focus:ring-sky-100"
                  >
                    {TONE_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  节奏
                </span>
                <div className="relative">
                  <select
                    aria-label="选择节奏"
                    value={draft.pacing}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        pacing: event.target.value as Pacing,
                      }))
                    }
                    className="h-11 w-full appearance-none rounded-2xl border border-black/8 bg-white px-4 pr-10 text-sm text-slate-900 outline-none transition focus:border-sky-200 focus:ring-3 focus:ring-sky-100"
                  >
                    {PACING_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </label>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[28px] border border-black/6 bg-slate-50/80 p-4 sm:p-5">
              <div className="flex flex-col gap-4 border-b border-black/6 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                    {workspaceInputMode === "chapter" ? "当前输入" : "全文导入"}
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {workspaceInputMode === "chapter" ? `第 ${activeChapterIndex + 1} 章` : "整篇小说正文"}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {workspaceInputMode === "chapter" ? workspaceProgressText : importProgressText}
                  </p>
                </div>
                {workspaceInputMode === "chapter" ? (
                  <ChapterSummaryGrid
                    summaries={chapterSummaries}
                    activeIndex={activeChapterIndex}
                    onSelect={setActiveChapterIndex}
                    onAdd={addChapter}
                    addDisabled={!canAddChapter}
                    addEyebrow="扩展输入"
                    addHint="继续补充更多章节内容"
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-black/6 bg-white p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">全文粘贴</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            ref={importFileInputRef}
                            type="file"
                            accept=".txt,.md,.markdown,text/plain,text/markdown"
                            className="hidden"
                            onChange={handleImportTextFile}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => importFileInputRef.current?.click()}
                            className="h-10 rounded-2xl border-black/8 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                          >
                            <FileUp className="mr-2 h-4 w-4" />
                            上传文件
                          </Button>
                          <Button
                            type="button"
                            onClick={handleParseImportedText}
                            className="h-10 rounded-2xl bg-slate-900 px-4 text-white hover:bg-slate-800"
                          >
                            <Check className="mr-2 h-4 w-4" />
                            自动拆章
                          </Button>
                        </div>
                      </div>
                      <textarea
                        value={importSourceText}
                        onChange={(event) => setImportSourceText(event.target.value)}
                        placeholder="把整篇小说正文粘贴到这里，或上传 .txt / .md 文件。建议保留原始章节标题，自动拆章会更准确。"
                        className="mt-4 h-56 w-full resize-none rounded-[24px] border border-black/8 bg-slate-50/70 px-5 py-5 text-[15px] leading-8 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-200 focus:ring-3 focus:ring-sky-100"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">拆章确认</p>
                    </div>

                    {importedChapters.length > 0 ? (
                      <ChapterSummaryGrid
                        summaries={importedChapterSummaries}
                        activeIndex={activeImportedChapterIndex}
                        onSelect={setActiveImportedChapterIndex}
                        onAdd={handleAddImportedChapter}
                        addDisabled={importedChapters.length >= MAX_SOURCE_CHAPTERS}
                        addEyebrow="拆章扩展"
                        addHint="继续补充或拆分更多章节"
                      />
                    ) : null}

                    <div className="rounded-[24px] border border-black/6 bg-white p-4 sm:p-5">
                      <ChapterEditorPanel
                        eyebrow="拆章确认"
                        heading={activeImportedChapterSummary?.title ?? "等待自动拆章"}
                        title={activeImportedChapter?.title ?? ""}
                        text={activeImportedChapter?.text ?? ""}
                        titlePlaceholder={`第 ${activeImportedChapterIndex + 1} 章`}
                        textPlaceholder="这一章的正文内容"
                        statusLabel={activeImportedChapterSummary?.statusLabel ?? "未开始"}
                        textCount={activeImportedChapterSummary?.textCount ?? 0}
                        onTitleChange={(value) =>
                          handleImportedChapterChange(activeImportedChapterIndex, "title", value)
                        }
                        onTextChange={(value) =>
                          handleImportedChapterChange(activeImportedChapterIndex, "text", value)
                        }
                        onRemove={
                          activeImportedChapter
                            ? () => handleRemoveImportedChapter(activeImportedChapterIndex)
                            : undefined
                        }
                        emptyState={
                          importedChapters.length === 0
                            ? "先在左侧粘贴全文并点击“自动拆章”，这里会显示可继续校对的章节结果。"
                            : undefined
                        }
                      />

                      <div className="mt-5 flex flex-col gap-3 border-t border-black/6 pt-4">
                        <Button
                          type="button"
                          onClick={handleApplyImportedChapters}
                          disabled={importedChapters.length === 0}
                          className="h-10 rounded-2xl bg-slate-900 px-4 text-white hover:bg-slate-800"
                        >
                          {importedChapters.length > 0
                            ? `导入 ${importedChapters.length} 章到工作台`
                            : "导入到工作台"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {workspaceInputMode === "chapter" ? (
                <div className="mt-5 space-y-4">
                  <ChapterEditorPanel
                    eyebrow="当前输入"
                    heading={`第 ${activeChapterIndex + 1} 章`}
                    title={activeChapter?.title ?? ""}
                    text={activeChapter?.text ?? ""}
                    titlePlaceholder="给这一章起一个更容易理解的标题"
                    textPlaceholder="把这一章的小说正文粘贴到这里，尽量保持段落清晰。AI 会基于这些内容生成章节、场景和节拍结构。"
                    statusLabel={activeChapterSummary?.statusLabel ?? "未开始"}
                    textCount={activeChapterSummary?.textCount ?? 0}
                    onTitleChange={(value) => updateChapter(activeChapterIndex, "title", value)}
                    onTextChange={(value) => updateChapter(activeChapterIndex, "text", value)}
                    minHeightClassName="min-h-[420px]"
                  />
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {[`单次 ${MAX_SOURCE_CHAPTERS} 章封顶`, "至少 3 章", "自动生成 YAML", "自动一致性质检"].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-black/8 bg-white px-3 py-1 text-xs text-slate-500"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </form>
      </SectionPanel>

      <div className="pointer-events-none fixed inset-x-4 bottom-5 z-30 flex justify-end lg:right-6">
        <div className="pointer-events-auto flex flex-col items-end gap-3">
          <button
            type="submit"
            form={WORKSPACE_DRAFT_FORM_ID}
            disabled={isSubmitting || !canSubmitDraft}
            onMouseEnter={() => setFloatingAction("submit")}
            onMouseLeave={() => setFloatingAction((current) => (current === "submit" ? null : current))}
            onFocus={() => setFloatingAction("submit")}
            onBlur={() => setFloatingAction((current) => (current === "submit" ? null : current))}
            className={cn(
              "relative h-14 overflow-hidden rounded-full bg-slate-950 text-white shadow-[0_18px_48px_rgba(15,23,42,0.18)] transition-[width,transform,box-shadow] duration-300 ease-out disabled:pointer-events-none disabled:opacity-70",
              isSubmitting || floatingAction === "submit" ? "w-[190px]" : "w-14"
            )}
            aria-label="开始生成"
          >
            <span
              className={cn(
                "absolute top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center transition-[left,transform] duration-300 ease-out",
                isSubmitting || floatingAction === "submit"
                  ? "left-5 translate-x-0"
                  : "left-1/2 -translate-x-1/2"
              )}
            >
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            </span>
            <span
              className={cn(
                "absolute left-14 top-1/2 -translate-y-1/2 overflow-hidden whitespace-nowrap pl-3 text-sm font-medium transition-[max-width,opacity,transform] duration-300 ease-out",
                isSubmitting || floatingAction === "submit"
                  ? "max-w-[120px] translate-x-0 opacity-100"
                  : "max-w-0 -translate-x-2 opacity-0"
              )}
            >
              {isSubmitting ? "生成中..." : "开始生成"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleResetDraft}
            onMouseEnter={() => setFloatingAction("reset")}
            onMouseLeave={() => setFloatingAction((current) => (current === "reset" ? null : current))}
            onFocus={() => setFloatingAction("reset")}
            onBlur={() => setFloatingAction((current) => (current === "reset" ? null : current))}
            className={cn(
              "relative h-14 overflow-hidden rounded-full border border-black/8 bg-white/92 text-slate-600 shadow-[0_14px_36px_rgba(15,23,42,0.1)] transition-[width,transform,box-shadow,color,background-color] duration-300 ease-out hover:bg-white hover:text-slate-950",
              floatingAction === "reset" ? "w-[176px]" : "w-14"
            )}
            aria-label="重置草稿"
          >
            <span
              className={cn(
                "absolute top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center transition-[left,transform] duration-300 ease-out",
                floatingAction === "reset" ? "left-5 translate-x-0" : "left-1/2 -translate-x-1/2"
              )}
            >
              <RefreshCw className="h-4 w-4" />
            </span>
            <span
              className={cn(
                "absolute left-14 top-1/2 -translate-y-1/2 overflow-hidden whitespace-nowrap pl-3 text-sm font-medium transition-[max-width,opacity,transform] duration-300 ease-out",
                floatingAction === "reset"
                  ? "max-w-[108px] translate-x-0 opacity-100"
                  : "max-w-0 -translate-x-2 opacity-0"
              )}
            >
              重置草稿
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
