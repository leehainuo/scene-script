import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { CircleCheckBig, FileText, LayoutGrid, Wand2 } from "lucide-react"
import { FloatingSaveButton } from "@/components/script-workshop/floating-save-button"
import { GenerationOverlay } from "@/components/script-workshop/generation-overlay"
import { RenameConfirmDialog } from "@/components/script-workshop/rename-confirm-dialog"
import { AppSidebar } from "@/components/studio/app-sidebar"
import {
  buildScriptConsistency,
  buildScriptSummary,
  normalizeConsistency,
  parseScriptYaml,
  serializeScriptYaml,
} from "@/lib/script-yaml"
import {
  buildSemanticTree,
  createDefaultDraft,
  DRAFT_STORAGE_KEY,
  downloadTextFile,
  extractErrorMessage,
  extractSchemaRequiredPath,
  findTreeNodeByID,
  formatSchemaValidationMessage,
  formatTextCount,
  GENERATION_STEPS,
  getChapterCompletionState,
  getStatusMeta,
  getTextCount,
  makeResultFromDetail,
  replaceLiteralText,
  validateEditableDocument,
} from "@/lib/script-workshop"
import type {
  ImportedChapterDraft,
  RegistryTab,
  RenameConfirmState,
  ResultView,
  SidebarView,
  WorkshopResult,
  WorkspaceInputMode,
} from "@/lib/script-workshop"
import { consumeSidebarEntranceAnimation } from "@/lib/sidebar-animation"
import { parseNovelTextToChapters } from "@/lib/text-import"
import { cn } from "@/lib/utils"
import { getAccessToken, getRefreshToken } from "@/lib/axios"
import { useScriptWorkshopTasks } from "./use-script-workshop-tasks"
import { toast } from "sonner"
import { logout, saveScriptResult } from "@/services"
import { useAuthStore } from "@/stores"
import { DetailView } from "./views/detail-view"
import { HistoryView } from "./views/history-view"
import { WorkspaceView } from "./views/workspace-view"
import type {
  ScriptBeat,
  ScriptChapter,
  ScriptChapterInput,
  ScriptConvertRequest,
  ScriptScene,
  ScriptYamlDocument,
} from "@/types"

export default function ScriptWorkshopPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, logout: clearAuth } = useAuthStore()
  const [shouldAnimateSidebarOnMount] = useState(() => consumeSidebarEntranceAnimation())

  const [draft, setDraft] = useState<ScriptConvertRequest>(() => {
    if (typeof window === "undefined") {
      return createDefaultDraft()
    }
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) {
      return createDefaultDraft()
    }
    try {
      const parsed = JSON.parse(raw) as ScriptConvertRequest
      if (parsed?.chapters?.length >= 3) {
        return parsed
      }
    } catch {
      localStorage.removeItem(DRAFT_STORAGE_KEY)
    }
    return createDefaultDraft()
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeResult, setActiveResult] = useState<WorkshopResult | null>(null)
  const [editableDocument, setEditableDocument] = useState<ScriptYamlDocument | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [activeChapterIndex, setActiveChapterIndex] = useState(0)
  const [view, setView] = useState<ResultView>("overview")
  const [wrapYaml, setWrapYaml] = useState(true)
  const [generationStepIndex, setGenerationStepIndex] = useState(0)
  const [generationStepText, setGenerationStepText] = useState(GENERATION_STEPS[0])
  const [showGenerationOverlay, setShowGenerationOverlay] = useState(false)
  const [draggedBeatId, setDraggedBeatId] = useState<string | null>(null)
  const [dragOverBeatId, setDragOverBeatId] = useState<string | null>(null)
  const [registryTab, setRegistryTab] = useState<RegistryTab>("characters")
  const [selectedCharacterIndex, setSelectedCharacterIndex] = useState(0)
  const [selectedSettingIndex, setSelectedSettingIndex] = useState(0)
  const [showValidationErrors, setShowValidationErrors] = useState(false)
  const [renameConfirm, setRenameConfirm] = useState<RenameConfirmState>(null)
  const [floatingAction, setFloatingAction] = useState<"submit" | "reset" | null>(null)
  const [workspaceInputMode, setWorkspaceInputMode] = useState<WorkspaceInputMode>("chapter")
  const [importSourceText, setImportSourceText] = useState("")
  const [importedChapters, setImportedChapters] = useState<ImportedChapterDraft[]>([])
  const [activeImportedChapterIndex, setActiveImportedChapterIndex] = useState(0)
  const importFileInputRef = useRef<HTMLInputElement | null>(null)
  const characterRenameOriginRef = useRef<Record<number, string>>({})
  const settingRenameOriginRef = useRef<Record<number, string>>({})

  useEffect(() => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
  }, [draft])

  useEffect(() => {
    if (!isSubmitting) return

    const timer = window.setInterval(() => {
      setGenerationStepIndex((current) => (current + 1) % GENERATION_STEPS.length)
    }, 1800)

    return () => window.clearInterval(timer)
  }, [isSubmitting])

  useEffect(() => {
    if (!showGenerationOverlay) {
      return
    }

    const timer = window.setTimeout(() => {
      setShowGenerationOverlay(false)
    }, 900)

    return () => window.clearTimeout(timer)
  }, [showGenerationOverlay])

  async function handleLogout() {
    try {
      const accessToken = getAccessToken()
      const refreshToken = getRefreshToken()
      if (accessToken && refreshToken) {
        await logout({ access_token: accessToken, refresh_token: refreshToken })
      }
    } catch (err) {
      console.error("logout error", err)
    } finally {
      clearAuth()
      navigate("/", { replace: true })
    }
  }

  function updateChapter(index: number, field: keyof ScriptChapterInput, value: string) {
    setDraft((prev) => ({
      ...prev,
      chapters: prev.chapters.map((chapter, chapterIndex) =>
        chapterIndex === index ? { ...chapter, [field]: value } : chapter
      ),
    }))
  }

  function addChapter() {
    setDraft((prev) => ({
      ...prev,
      chapters: [
        ...prev.chapters,
        {
          title: `第${prev.chapters.length + 1}章`,
          text: "",
        },
      ],
    }))
  }

  function applyDocumentUpdate(updater: (current: ScriptYamlDocument) => ScriptYamlDocument) {
    setEditableDocument((current) => (current ? updater(current) : current))
  }

  function setResultForEditing(result: WorkshopResult | null) {
    setActiveResult(result)
    setEditableDocument(result ? parseScriptYaml(result.yaml) : null)
    setRegistryTab("characters")
    setSelectedCharacterIndex(0)
    setSelectedSettingIndex(0)
    setShowValidationErrors(false)
    setRenameConfirm(null)
  }

  const {
    activeTaskMeta,
    filteredHistory,
    handleDeleteHistory,
    handleLoadHistory,
    handleRetryHistory,
    handleSubmit,
    historyActionState,
    isHistoryLoading,
    isStatusMenuOpen,
    loadHistory,
    search,
    selectedTaskId,
    setActiveTaskMeta,
    setIsStatusMenuOpen,
    setSearch,
    setSelectedTaskId,
    setStatusFilters,
    statusFilterLabel,
    statusFilters,
    statusMenuRef,
    taskProgressMessage,
    toggleStatusFilter,
  } = useScriptWorkshopTasks({
    draft,
    searchParams,
    setSearchParams,
    activeResultId: activeResult?.id ?? null,
    setResultForEditing,
    setIsSubmitting,
    setShowGenerationOverlay,
    setGenerationStepIndex,
    setGenerationStepText,
    setSelectedNodeId,
    setView,
  })

  function updateScriptChapter(
    chapterIndex: number,
    updater: (chapter: ScriptChapter) => ScriptChapter
  ) {
    applyDocumentUpdate((current) => ({
      ...current,
      chapters: current.chapters.map((chapter, index) =>
        index === chapterIndex ? updater(chapter) : chapter
      ),
    }))
  }

  function updateScriptScene(
    chapterIndex: number,
    sceneIndex: number,
    updater: (scene: ScriptScene) => ScriptScene
  ) {
    updateScriptChapter(chapterIndex, (chapter) => ({
      ...chapter,
      scenes: chapter.scenes.map((scene, index) =>
        index === sceneIndex ? updater(scene) : scene
      ),
    }))
  }

  function updateScriptBeat(
    chapterIndex: number,
    sceneIndex: number,
    beatIndex: number,
    updater: (beat: ScriptBeat) => ScriptBeat
  ) {
    updateScriptScene(chapterIndex, sceneIndex, (scene) => ({
      ...scene,
      beats: scene.beats.map((beat, index) => (index === beatIndex ? updater(beat) : beat)),
    }))
  }

  function moveBeatInScene(chapterIndex: number, sceneIndex: number, fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) {
      return
    }

    updateScriptScene(chapterIndex, sceneIndex, (scene) => {
      const nextBeats = [...scene.beats]
      const [movedBeat] = nextBeats.splice(fromIndex, 1)
      if (!movedBeat) {
        return scene
      }
      nextBeats.splice(toIndex, 0, movedBeat)
      return {
        ...scene,
        beats: nextBeats,
      }
    })
    toast.success("节拍顺序已更新，YAML 结构已同步。")
  }

  function updateScriptCharacter(
    characterIndex: number,
    updater: (character: ScriptYamlDocument["dramatis_personae"][number]) => ScriptYamlDocument["dramatis_personae"][number]
  ) {
    applyDocumentUpdate((current) => ({
      ...current,
      dramatis_personae: current.dramatis_personae.map((character, index) =>
        index === characterIndex ? updater(character) : character
      ),
    }))
  }

  function updateScriptSetting(
    settingIndex: number,
    updater: (setting: ScriptYamlDocument["settings"][number]) => ScriptYamlDocument["settings"][number]
  ) {
    applyDocumentUpdate((current) => ({
      ...current,
      settings: current.settings.map((setting, index) =>
        index === settingIndex ? updater(setting) : setting
      ),
    }))
  }

  function renameCharacterReferences(oldName: string, nextName: string) {
    const previous = oldName.trim()
    const currentName = nextName.trim()
    if (!previous || !currentName || previous === currentName) {
      return
    }

    applyDocumentUpdate((current) => ({
      ...current,
      chapters: current.chapters.map((chapter) => ({
        ...chapter,
        summary: replaceLiteralText(chapter.summary, previous, currentName),
        scenes: chapter.scenes.map((scene) => ({
          ...scene,
          pov: scene.pov === previous ? currentName : scene.pov,
          goal: replaceLiteralText(scene.goal, previous, currentName),
          outcome: replaceLiteralText(scene.outcome, previous, currentName),
          beats: scene.beats.map((beat) =>
            beat.dialogue?.speaker === previous
              ? {
                  ...beat,
                  summary: replaceLiteralText(beat.summary, previous, currentName),
                  dialogue: {
                    speaker: currentName,
                    content: replaceLiteralText(
                      beat.dialogue.content,
                      previous,
                      currentName
                    ),
                  },
                }
              : {
                  ...beat,
                  summary: replaceLiteralText(beat.summary, previous, currentName),
                  dialogue: beat.dialogue
                    ? {
                        speaker: beat.dialogue.speaker,
                        content: replaceLiteralText(
                          beat.dialogue.content,
                          previous,
                          currentName
                        ),
                      }
                    : beat.dialogue,
                }
          ),
        })),
      })),
    }))
  }

  function renameSettingReferences(oldName: string, nextName: string) {
    const previous = oldName.trim()
    const currentName = nextName.trim()
    if (!previous || !currentName || previous === currentName) {
      return
    }

    applyDocumentUpdate((current) => ({
      ...current,
      chapters: current.chapters.map((chapter) => ({
        ...chapter,
        summary: replaceLiteralText(chapter.summary, previous, currentName),
        scenes: chapter.scenes.map((scene) => ({
          ...scene,
          location: scene.location === previous ? currentName : scene.location,
          goal: replaceLiteralText(scene.goal, previous, currentName),
          outcome: replaceLiteralText(scene.outcome, previous, currentName),
          beats: scene.beats.map((beat) => ({
            ...beat,
            summary: replaceLiteralText(beat.summary, previous, currentName),
            dialogue: beat.dialogue
              ? {
                  speaker: beat.dialogue.speaker,
                  content: replaceLiteralText(
                    beat.dialogue.content,
                    previous,
                    currentName
                  ),
                }
              : beat.dialogue,
          })),
        })),
      })),
    }))
  }

  function requestRenameConfirm(kind: RegistryTab, previousName: string, nextName: string) {
    const from = previousName.trim()
    const to = nextName.trim()

    if (!from || !to || from === to) {
      return
    }

    setRenameConfirm({
      kind,
      previousName: from,
      nextName: to,
    })
  }

  function focusValidationTarget(path: string) {
    const characterMatch = path.match(/^dramatis_personae\[(\d+)\]/)
    if (characterMatch) {
      setRegistryTab("characters")
      setSelectedCharacterIndex(Number(characterMatch[1]))
      return
    }

    const settingMatch = path.match(/^settings\[(\d+)\]/)
    if (settingMatch) {
      setRegistryTab("settings")
      setSelectedSettingIndex(Number(settingMatch[1]))
      return
    }

    const beatMatch = path.match(/^chapters\[(\d+)\]\.scenes\[(\d+)\]\.beats\[(\d+)\]/)
    if (beatMatch) {
      setView("structure")
      setSelectedNodeId(
        `beat-${editableDocument?.chapters[Number(beatMatch[1])]?.scenes[Number(beatMatch[2])]?.beats[Number(beatMatch[3])]?.id ?? ""}`
      )
      return
    }

    const sceneMatch = path.match(/^chapters\[(\d+)\]\.scenes\[(\d+)\]/)
    if (sceneMatch) {
      setView("structure")
      setSelectedNodeId(
        `scene-${editableDocument?.chapters[Number(sceneMatch[1])]?.scenes[Number(sceneMatch[2])]?.id ?? ""}`
      )
      return
    }

    const chapterMatch = path.match(/^chapters\[(\d+)\]/)
    if (chapterMatch) {
      setView("structure")
      setSelectedNodeId(`chapter-${editableDocument?.chapters[Number(chapterMatch[1])]?.id ?? ""}`)
    }
  }

  function deleteCharacter(index: number) {
    const target = editableDocument?.dramatis_personae[index]
    if (!target) {
      return
    }

    const confirmed = window.confirm(
      `确定删除人物「${target.name || `角色 ${index + 1}`}」吗？删除后正文里的同名引用不会自动移除，一致性质检会提示你补齐。`
    )
    if (!confirmed) {
      return
    }

    applyDocumentUpdate((current) => ({
      ...current,
      dramatis_personae: current.dramatis_personae.filter((_, itemIndex) => itemIndex !== index),
    }))
    setSelectedCharacterIndex((current) => Math.max(0, Math.min(current, index - 1)))
  }

  function deleteSetting(index: number) {
    const target = editableDocument?.settings[index]
    if (!target) {
      return
    }

    const confirmed = window.confirm(
      `确定删除地点「${target.name || `地点 ${index + 1}`}」吗？删除后场景里的同名引用不会自动移除，一致性质检会提示你补齐。`
    )
    if (!confirmed) {
      return
    }

    applyDocumentUpdate((current) => ({
      ...current,
      settings: current.settings.filter((_, itemIndex) => itemIndex !== index),
    }))
    setSelectedSettingIndex((current) => Math.max(0, Math.min(current, index - 1)))
  }

  function addCharacter() {
    const nextIndex = editableDocument?.dramatis_personae.length ?? 0
    applyDocumentUpdate((current) => ({
      ...current,
      dramatis_personae: [
        ...current.dramatis_personae,
        {
          name: `角色${current.dramatis_personae.length + 1}`,
          archetype: "配角",
          motivation: "",
          traits: [],
          relations: [],
          first_appearance: "Chapter 1",
        },
      ],
    }))
    setRegistryTab("characters")
    setSelectedCharacterIndex(nextIndex)
  }

  function addSetting() {
    const nextIndex = editableDocument?.settings.length ?? 0
    applyDocumentUpdate((current) => ({
      ...current,
      settings: [
        ...current.settings,
        {
          name: `地点${current.settings.length + 1}`,
          description: "",
          importance: "medium",
        },
      ],
    }))
    setRegistryTab("settings")
    setSelectedSettingIndex(nextIndex)
  }

  function handleResetDraft() {
    setDraft(createDefaultDraft())
    setActiveChapterIndex(0)
    setImportSourceText("")
    setImportedChapters([])
    setActiveImportedChapterIndex(0)
    setWorkspaceInputMode("chapter")
    toast.success("草稿已重置。")
  }

  function handleParseImportedText() {
    const trimmed = importSourceText.trim()
    if (!trimmed) {
      toast.error("请先粘贴小说全文，再开始自动拆章。")
      setImportedChapters([])
      setActiveImportedChapterIndex(0)
      return
    }

    const chapters = parseNovelTextToChapters(trimmed).map((chapter, index) => ({
      title: chapter.title || `第 ${index + 1} 章`,
      text: chapter.text,
    }))

    setImportedChapters(chapters)
    setActiveImportedChapterIndex(0)
    if (chapters.length < 2) {
      toast.error("未识别到明确章节标题，已按段落结构给出拆分初稿，请确认后再导入。")
      return
    }
  }

  async function handleImportTextFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) {
      return
    }

    const lowerName = file.name.toLowerCase()
    const isSupported =
      lowerName.endsWith(".txt") || lowerName.endsWith(".md") || lowerName.endsWith(".markdown")

    if (!isSupported) {
      toast.error("目前只支持导入 .txt、.md、.markdown 文件。")
      return
    }

    try {
      const content = await file.text()
      setImportSourceText(content)
      setImportedChapters([])
      setActiveImportedChapterIndex(0)
      setWorkspaceInputMode("import")
      toast.success(`已导入文件《${file.name}》，现在可以开始自动拆章。`)
    } catch {
      toast.error("文件读取失败，请确认文件编码和内容后重试。")
    }
  }

  function handleImportedChapterChange(
    index: number,
    field: keyof ScriptChapterInput,
    value: string
  ) {
    setImportedChapters((current) =>
      current.map((chapter, chapterIndex) =>
        chapterIndex === index ? { ...chapter, [field]: value } : chapter
      )
    )
  }

  function handleAddImportedChapter() {
    setImportedChapters((current) => {
      const next = [...current, { title: `第 ${current.length + 1} 章`, text: "" }]
      setActiveImportedChapterIndex(next.length - 1)
      return next
    })
  }

  function handleRemoveImportedChapter(index: number) {
    setImportedChapters((current) => {
      const next = current.filter((_, chapterIndex) => chapterIndex !== index)
      setActiveImportedChapterIndex((prev) => Math.max(0, Math.min(prev > index ? prev - 1 : prev, next.length - 1)))
      return next
    })
  }

  function handleApplyImportedChapters() {
    const normalized = importedChapters
      .map((chapter, index) => ({
        title: chapter.title.trim() || `第 ${index + 1} 章`,
        text: chapter.text.trim(),
      }))
      .filter((chapter) => chapter.title || chapter.text)

    if (normalized.length === 0) {
      toast.error("请至少保留一章内容后再导入。")
      return
    }

    setDraft((current) => ({
      ...current,
      chapters: normalized,
    }))
    setActiveChapterIndex(0)
    setActiveImportedChapterIndex(0)
    setWorkspaceInputMode("chapter")
    toast.success(`已导入 ${normalized.length} 章内容，你可以继续调整后开始生成。`)
  }

  async function handleCopyYaml() {
    if (!liveYaml) return
    try {
      await navigator.clipboard.writeText(liveYaml)
      toast.success("YAML 已复制到剪贴板。")
    } catch {
      toast.error("复制失败，请手动选中复制。")
    }
  }

  function handleDownloadYaml() {
    if (!liveYaml || !activeResult) return
    const name = `${activeResult.metadata.title || "script-workshop"}.yaml`
    downloadTextFile(name, liveYaml)
    toast.success("YAML 文件已开始下载。")
  }

  async function handleSaveResult() {
    if (!activeResult || !liveYaml) {
      toast.error("当前没有可保存的剧本结果。")
      return
    }

    if (Object.keys(validationErrors).length > 0) {
      const firstInvalidPath = Object.keys(validationErrors)[0]
      setShowValidationErrors(true)
      if (firstInvalidPath) {
        focusValidationTarget(firstInvalidPath)
        toast.error(validationErrors[firstInvalidPath] || "还有必填项未填写，请补充后再保存。")
      }
      return
    }

    setIsSaving(true)
    try {
      const response = await saveScriptResult(activeResult.id, { yaml: liveYaml })
      if (response.code !== 0 || !response.data) {
        const requiredPath = extractSchemaRequiredPath(response.msg || "")
        if (requiredPath) {
          setShowValidationErrors(true)
          focusValidationTarget(requiredPath)
        }
        toast.error(formatSchemaValidationMessage(response.msg || "保存失败，请稍后重试。"))
        return
      }

      const nextResult = makeResultFromDetail(response.data)
      if (!nextResult) {
        toast.error("保存成功，但返回结果为空。")
        return
      }

      setResultForEditing(nextResult)
      setActiveTaskMeta(nextResult.metadata)
      setSelectedTaskId(nextResult.id)
      setSearchParams({ view: "detail", id: nextResult.id })
      toast.success("修改已保存", {
        icon: <CircleCheckBig className="h-5 w-5 text-green-600" />,
        style: {
          background: "#ffffff",
          border: "1px solid rgba(34, 197, 94, 0.18)",
          color: "#0f172a",
        },
      })
      await loadHistory()
    } catch (err) {
      const message = extractErrorMessage(err, "保存失败，请稍后重试。")
      const requiredPath = extractSchemaRequiredPath(message)
      if (requiredPath) {
        setShowValidationErrors(true)
        focusValidationTarget(requiredPath)
      }
      toast.error(
        formatSchemaValidationMessage(message)
      )
    } finally {
      setIsSaving(false)
    }
  }

  const semanticTree = useMemo(() => buildSemanticTree(editableDocument), [editableDocument])
  const activeResultYaml = activeResult?.yaml ?? ""
  const liveYaml = editableDocument ? serializeScriptYaml(editableDocument) : activeResultYaml
  const savedYamlBaseline = useMemo(() => {
    if (!activeResultYaml) {
      return ""
    }

    const parsed = parseScriptYaml(activeResultYaml)
    return parsed ? serializeScriptYaml(parsed) : activeResultYaml
  }, [activeResultYaml])
  const consistency = editableDocument
    ? normalizeConsistency(buildScriptConsistency(editableDocument))
    : activeResult?.consistencyReport ?? {
        rolesMissing: [],
        settingsMissing: [],
        danglingRefs: [],
      }

  const activeChapter = draft.chapters[activeChapterIndex] ?? draft.chapters[0]
  const importSourceTextCount = getTextCount(importSourceText)
  const importedChapterSummaries = useMemo(
    () =>
      importedChapters.map((chapter, index) => {
        const completionState = getChapterCompletionState(chapter)
        const textCount = getTextCount(chapter.text)
        return {
          index,
          title: chapter.title.trim() || `第 ${index + 1} 章`,
          textCount,
          completionState,
          statusLabel:
            completionState === "ready"
              ? "可导入"
              : completionState === "partial"
                ? "待补全"
                : "未开始",
          detailLabel:
            completionState === "ready"
              ? formatTextCount(textCount)
              : completionState === "partial"
                ? "缺标题或正文"
                : "等待输入",
        }
      }),
    [importedChapters]
  )
  const chapterSummaries = useMemo(
    () =>
      draft.chapters.map((chapter, index) => {
        const completionState = getChapterCompletionState(chapter)
        const textCount = getTextCount(chapter.text)
        return {
          index,
          title: chapter.title.trim() || `第 ${index + 1} 章`,
          textCount,
          completionState,
          statusLabel:
            completionState === "ready"
              ? "可生成"
              : completionState === "partial"
                ? "待补全"
                : "未开始",
          detailLabel:
            completionState === "ready"
              ? formatTextCount(textCount)
              : completionState === "partial"
                ? "缺标题或正文"
                : "等待输入",
        }
      }),
    [draft.chapters]
  )
  const completedChaptersCount = chapterSummaries.filter(
    (chapter) => chapter.completionState === "ready"
  ).length
  const incompleteChaptersCount = chapterSummaries.length - completedChaptersCount
  const canSubmitDraft = draft.chapters.length >= 3 && incompleteChaptersCount === 0
  const activeChapterSummary = chapterSummaries[activeChapterIndex] ?? chapterSummaries[0]
  const activeImportedChapter =
    importedChapters[activeImportedChapterIndex] ?? importedChapters[0] ?? null
  const activeImportedChapterSummary =
    importedChapterSummaries[activeImportedChapterIndex] ?? importedChapterSummaries[0]
  const workspaceProgressText =
    draft.chapters.length < 3
      ? `至少需要 3 章内容。当前已有 ${draft.chapters.length} 章，还差 ${3 - draft.chapters.length} 章。`
      : canSubmitDraft
        ? `已完成 ${completedChaptersCount}/${draft.chapters.length} 章，可以直接开始生成。`
        : `已有 ${draft.chapters.length} 章草稿，但仍有 ${incompleteChaptersCount} 章缺少标题或正文。`
  const importProgressText =
    importSourceTextCount === 0
      ? "适合一次粘贴整篇小说，再统一拆章和校对。"
      : importedChapters.length > 0
        ? `已粘贴 ${formatTextCount(importSourceTextCount)}，当前识别出 ${importedChapters.length} 章。`
        : `已粘贴 ${formatTextCount(importSourceTextCount)}，下一步可以开始自动拆章。`
  const sidebarView: SidebarView =
    searchParams.get("view") === "history" ||
    searchParams.get("view") === "detail" ||
    searchParams.get("view") === "workspace"
      ? (searchParams.get("view") as SidebarView)
      : "workspace"
  const selectedNode = useMemo(
    () => findTreeNodeByID(semanticTree, selectedNodeId) ?? semanticTree[0] ?? null,
    [semanticTree, selectedNodeId]
  )
  const selectedChapterData = selectedNode
    ? editableDocument?.chapters[selectedNode.chapterIndex] ?? null
    : null
  const selectedSceneData =
    selectedNode?.sceneIndex !== undefined && selectedChapterData
      ? selectedChapterData.scenes[selectedNode.sceneIndex] ?? null
      : null
  const selectedBeatData =
    selectedNode?.beatIndex !== undefined && selectedSceneData
      ? selectedSceneData.beats[selectedNode.beatIndex] ?? null
      : null
  const registryView: RegistryTab =
    registryTab === "characters"
      ? editableDocument?.dramatis_personae.length === 0 && (editableDocument?.settings.length ?? 0) > 0
        ? "settings"
        : "characters"
      : editableDocument?.settings.length === 0 && (editableDocument?.dramatis_personae.length ?? 0) > 0
        ? "characters"
        : "settings"
  const activeRegistryItems =
    registryView === "characters"
      ? editableDocument?.dramatis_personae ?? []
      : editableDocument?.settings ?? []
  const activeRegistryIndex =
    registryView === "characters"
      ? activeRegistryItems.length === 0
        ? 0
        : Math.min(selectedCharacterIndex, activeRegistryItems.length - 1)
      : activeRegistryItems.length === 0
        ? 0
        : Math.min(selectedSettingIndex, activeRegistryItems.length - 1)
  const selectedCharacter =
    registryView === "characters"
      ? editableDocument?.dramatis_personae[activeRegistryIndex] ?? null
      : null
  const selectedSetting =
    registryView === "settings" ? editableDocument?.settings[activeRegistryIndex] ?? null : null
  const validationErrors = editableDocument ? validateEditableDocument(editableDocument) : {}
  const getFieldError = (path: string) => (showValidationErrors ? validationErrors[path] : undefined)
  const getFieldClassName = (path: string, baseClassName: string) =>
    cn(
      baseClassName,
      getFieldError(path) &&
        "border-rose-300 bg-rose-50/50 text-slate-900 focus:border-rose-300 focus:ring-rose-100"
    )
  const characterNames = editableDocument?.dramatis_personae.map((item) => item.name).filter(Boolean) ?? []
  const settingNames = editableDocument?.settings.map((item) => item.name).filter(Boolean) ?? []
  const currentPovOptions = selectedSceneData?.pov && !characterNames.includes(selectedSceneData.pov)
    ? [selectedSceneData.pov, ...characterNames]
    : characterNames
  const currentLocationOptions =
    selectedSceneData?.location && !settingNames.includes(selectedSceneData.location)
      ? [selectedSceneData.location, ...settingNames]
      : settingNames
  const currentSpeakerOptions =
    selectedBeatData?.dialogue?.speaker &&
    !characterNames.includes(selectedBeatData.dialogue.speaker)
      ? [selectedBeatData.dialogue.speaker, ...characterNames]
      : characterNames

  const activeStatus = getStatusMeta(activeResult?.metadata.status ?? activeTaskMeta?.status ?? "pending")
  const summary = editableDocument
    ? buildScriptSummary(editableDocument)
    : activeResult?.summary ?? {
        chapters: 0,
        scenes: 0,
        beats: 0,
        characters: 0,
        settings: 0,
      }
  const hasUnsavedChanges = Boolean(activeResult && liveYaml && liveYaml !== savedYamlBaseline)
  return (
    <div className="min-h-screen bg-[#f6f6f7] text-slate-900">
      {showGenerationOverlay ? (
        <GenerationOverlay
          stepText={generationStepText || GENERATION_STEPS[generationStepIndex]}
          chapterCount={draft.chapters.length}
          genre={draft.genre}
          tone={draft.tone}
          pacing={draft.pacing}
        />
      ) : null}

      <div className="mx-auto max-w-[1480px] px-4 py-6 lg:px-6">
        <div className="grid gap-6 lg:grid-cols-[88px_minmax(0,1fr)]">
          <AppSidebar
            activeKey={sidebarView}
            username={user?.username}
            animateItemsOnMount={shouldAnimateSidebarOnMount}
            onLogoClick={() => navigate("/")}
            authActionLabel="登出"
            onAuthAction={handleLogout}
            items={[
              { key: "workspace", label: "工作台", icon: Wand2, onClick: () => setSearchParams({ view: "workspace" }) },
              { key: "history", label: "作品", icon: LayoutGrid, onClick: () => setSearchParams({ view: "history" }) },
              {
                key: "detail",
                label: "详情",
                icon: FileText,
                onClick: () =>
                  setSearchParams(
                    selectedTaskId ? { view: "detail", id: selectedTaskId } : { view: "detail" }
                  ),
              },
            ]}
          />

          <section className="space-y-6 pt-3">
            {sidebarView === "workspace" ? (
              <WorkspaceView
                draft={draft}
                setDraft={setDraft}
                workspaceInputMode={workspaceInputMode}
                setWorkspaceInputMode={setWorkspaceInputMode}
                activeChapterIndex={activeChapterIndex}
                setActiveChapterIndex={setActiveChapterIndex}
                activeChapter={activeChapter}
                chapterSummaries={chapterSummaries}
                activeChapterSummary={activeChapterSummary}
                addChapter={addChapter}
                updateChapter={updateChapter}
                canSubmitDraft={canSubmitDraft}
                isSubmitting={isSubmitting}
                handleSubmit={handleSubmit}
                floatingAction={floatingAction}
                setFloatingAction={setFloatingAction}
                handleResetDraft={handleResetDraft}
                workspaceProgressText={workspaceProgressText}
                importProgressText={importProgressText}
                importFileInputRef={importFileInputRef}
                handleImportTextFile={handleImportTextFile}
                importSourceText={importSourceText}
                setImportSourceText={setImportSourceText}
                handleParseImportedText={handleParseImportedText}
                importedChapters={importedChapters}
                importedChapterSummaries={importedChapterSummaries}
                activeImportedChapterIndex={activeImportedChapterIndex}
                setActiveImportedChapterIndex={setActiveImportedChapterIndex}
                activeImportedChapter={activeImportedChapter}
                activeImportedChapterSummary={activeImportedChapterSummary}
                handleAddImportedChapter={handleAddImportedChapter}
                handleRemoveImportedChapter={handleRemoveImportedChapter}
                handleImportedChapterChange={handleImportedChapterChange}
                handleApplyImportedChapters={handleApplyImportedChapters}
              />
            ) : null}

            {sidebarView === "history" ? (
              <HistoryView
                search={search}
                setSearch={setSearch}
                statusMenuRef={statusMenuRef}
                isStatusMenuOpen={isStatusMenuOpen}
                setIsStatusMenuOpen={setIsStatusMenuOpen}
                statusFilterLabel={statusFilterLabel}
                statusFilters={statusFilters}
                setStatusFilters={setStatusFilters}
                toggleStatusFilter={toggleStatusFilter}
                loadHistory={loadHistory}
                isHistoryLoading={isHistoryLoading}
                filteredHistory={filteredHistory}
                selectedTaskId={selectedTaskId}
                historyActionState={historyActionState}
                handleLoadHistory={handleLoadHistory}
                handleRetryHistory={handleRetryHistory}
                handleDeleteHistory={handleDeleteHistory}
              />
            ) : null}

            {sidebarView === "detail" ? (
              <DetailView
                activeResult={activeResult}
                activeTaskMeta={activeTaskMeta}
                activeStatus={activeStatus}
                taskProgressMessage={taskProgressMessage}
                hasUnsavedChanges={hasUnsavedChanges}
                view={view}
                setView={setView}
                summary={summary}
                consistency={consistency}
                wrapYaml={wrapYaml}
                setWrapYaml={setWrapYaml}
                handleCopyYaml={handleCopyYaml}
                handleDownloadYaml={handleDownloadYaml}
                liveYaml={liveYaml}
                semanticTree={semanticTree}
                selectedNode={selectedNode}
                selectedNodeId={selectedNodeId}
                setSelectedNodeId={setSelectedNodeId}
                editableDocument={editableDocument}
                selectedChapterData={selectedChapterData}
                selectedSceneData={selectedSceneData}
                selectedBeatData={selectedBeatData}
                updateScriptChapter={updateScriptChapter}
                updateScriptScene={updateScriptScene}
                updateScriptBeat={updateScriptBeat}
                moveBeatInScene={moveBeatInScene}
                draggedBeatId={draggedBeatId}
                setDraggedBeatId={setDraggedBeatId}
                dragOverBeatId={dragOverBeatId}
                setDragOverBeatId={setDragOverBeatId}
                getFieldClassName={getFieldClassName}
                getFieldError={getFieldError}
                setRegistryTab={setRegistryTab}
                registryView={registryView}
                activeRegistryIndex={activeRegistryIndex}
                setSelectedCharacterIndex={setSelectedCharacterIndex}
                setSelectedSettingIndex={setSelectedSettingIndex}
                selectedCharacter={selectedCharacter}
                selectedSetting={selectedSetting}
                addCharacter={addCharacter}
                addSetting={addSetting}
                deleteCharacter={deleteCharacter}
                deleteSetting={deleteSetting}
                updateScriptCharacter={updateScriptCharacter}
                updateScriptSetting={updateScriptSetting}
                characterRenameOriginRef={characterRenameOriginRef}
                settingRenameOriginRef={settingRenameOriginRef}
                requestRenameConfirm={requestRenameConfirm}
                characterNames={characterNames}
                settingNames={settingNames}
                currentPovOptions={currentPovOptions}
                currentLocationOptions={currentLocationOptions}
                currentSpeakerOptions={currentSpeakerOptions}
              />
            ) : null}
          </section>
        </div>
      </div>

      <RenameConfirmDialog
        renameConfirm={renameConfirm}
        onClose={() => setRenameConfirm(null)}
        onConfirm={() => {
          if (!renameConfirm) {
            return
          }
          if (renameConfirm.kind === "characters") {
            renameCharacterReferences(renameConfirm.previousName, renameConfirm.nextName)
          } else {
            renameSettingReferences(renameConfirm.previousName, renameConfirm.nextName)
          }
          setRenameConfirm(null)
        }}
      />
      {sidebarView === "detail" && activeResult ? (
        <FloatingSaveButton
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
          onClick={() => void handleSaveResult()}
        />
      ) : null}
    </div>
  )
}
