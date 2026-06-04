import { useEffect, useMemo, useRef, useState } from "react"
import type { ComponentProps } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  ChevronDown,
  ChevronRight,
  Check,
  Copy,
  Download,
  FileText,
  GripVertical,
  History,
  LayoutTemplate,
  LoaderCircle,
  ListFilter,
  RefreshCw,
  ShieldAlert,
  Wand2,
} from "lucide-react"
import { AppSidebar } from "@/components/studio/app-sidebar"
import { StudioPanel } from "@/components/studio/studio-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  buildScriptConsistency,
  buildScriptSummary,
  normalizeConsistency,
  parseScriptYaml,
  serializeScriptYaml,
} from "@/lib/script-yaml"
import { cn } from "@/lib/utils"
import { getAccessToken, getRefreshToken } from "@/lib/axios"
import { convertScript, getScriptDetail, getScriptHistory, logout } from "@/services"
import { useAuthStore } from "@/stores"
import type {
  ScriptBeat,
  ScriptChapter,
  ScriptChapterInput,
  ScriptConsistencyReport,
  ScriptConvertRequest,
  ScriptDetailResponse,
  ScriptHistoryItem,
  ScriptScene,
  ScriptSummary,
  ScriptTaskMeta,
  ScriptYamlDocument,
} from "@/types"

type Pacing = ScriptConvertRequest["pacing"]

type ScriptTreeNode = {
  id: string
  label: string
  description: string
  kind: "chapter" | "scene" | "beat"
  chapterIndex: number
  sceneIndex?: number
  beatIndex?: number
  children: ScriptTreeNode[]
}

type WorkshopResult = {
  id: string
  yaml: string
  summary: ScriptSummary
  consistencyReport: {
    rolesMissing: string[]
    settingsMissing: string[]
    danglingRefs: string[]
  }
  metadata: ScriptTaskMeta
}

type ResultView = "overview" | "yaml" | "structure"
type SidebarView = "workspace" | "history" | "detail"
type ScriptTaskStatus = "pending" | "running" | "succeeded" | "failed"

const DRAFT_STORAGE_KEY = "script-workshop-draft"

const GENRE_OPTIONS = ["悬疑", "言情", "科幻", "现实主义", "奇幻", "其他"]
const TONE_OPTIONS = ["压抑", "轻松", "热血", "温暖", "冷峻", "诗意"]
const PACING_OPTIONS: Array<{ label: string; value: Pacing; hint: string }> = [
  { label: "快节奏", value: "fast", hint: "适合悬疑、冒险与事件驱动" },
  { label: "中节奏", value: "medium", hint: "兼顾推进、情绪和角色刻画" },
  { label: "慢节奏", value: "slow", hint: "更强调氛围、心理和留白" },
]

const DEFAULT_CHAPTERS: ScriptChapterInput[] = [
  { title: "第一章", text: "" },
  { title: "第二章", text: "" },
  { title: "第三章", text: "" },
]

const GENERATION_STEPS = [
  "正在整理章节内容与改编指令",
  "正在生成角色、场景与节拍结构",
  "正在校验 YAML 并准备一致性质检",
]

const STATUS_FILTER_OPTIONS: Array<{ value: ScriptTaskStatus; label: string }> = [
  { value: "succeeded", label: "已完成" },
  { value: "failed", label: "失败" },
  { value: "running", label: "生成中" },
  { value: "pending", label: "等待中" },
]

function buildSemanticTree(document: ScriptYamlDocument | null): ScriptTreeNode[] {
  if (!document) {
    return []
  }

  return document.chapters.map((chapter, chapterIndex) => ({
    id: `chapter-${chapter.id}`,
    label: chapter.title || `第 ${chapterIndex + 1} 章`,
    description: chapter.summary || "点击查看这一章的梗概与场景。",
    kind: "chapter",
    chapterIndex,
    children: chapter.scenes.map((scene, sceneIndex) => ({
      id: `scene-${scene.id}`,
      label: scene.title || `场景 ${sceneIndex + 1}`,
      description: `${scene.location || "未设置地点"} / ${scene.time || "未设置时间"}`,
      kind: "scene",
      chapterIndex,
      sceneIndex,
      children: scene.beats.map((beat, beatIndex) => ({
        id: `beat-${beat.id}`,
        label: beat.summary || `节拍 ${beatIndex + 1}`,
        description:
          beat.type === "dialogue" || beat.type === "inner"
            ? `${beat.dialogue?.speaker || "未设置角色"}：${beat.dialogue?.content || "待补充对白"}`
            : beat.type,
        kind: "beat",
        chapterIndex,
        sceneIndex,
        beatIndex,
        children: [],
      })),
    })),
  }))
}

function findTreeNodeByID(nodes: ScriptTreeNode[], id: string | null): ScriptTreeNode | null {
  if (!id) return null
  for (const node of nodes) {
    if (node.id === id) return node
    const childMatch = findTreeNodeByID(node.children, id)
    if (childMatch) return childMatch
  }
  return null
}

function formatDateTime(value?: string) {
  if (!value) return "刚刚"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function createDefaultDraft(): ScriptConvertRequest {
  return {
    chapters: DEFAULT_CHAPTERS,
    genre: GENRE_OPTIONS[0],
    tone: TONE_OPTIONS[0],
    pacing: "medium",
  }
}

function makeResultFromConvert(
  req: ScriptConvertRequest,
  response: {
    id: string
    yaml: string
    summary: ScriptSummary
    consistency_report: ScriptConsistencyReport
  }
): WorkshopResult {
  const now = new Date().toISOString()
  return {
    id: response.id,
    yaml: response.yaml,
    summary: response.summary,
    consistencyReport: normalizeConsistency(response.consistency_report),
    metadata: {
      id: response.id,
      title: req.chapters[0]?.title || "未命名剧本",
      genre: req.genre,
      tone: req.tone,
      pacing: req.pacing,
      source_chapters: req.chapters.length,
      status: "succeeded",
      created_at: now,
      updated_at: now,
    },
  }
}

function makeResultFromDetail(detail: ScriptDetailResponse): WorkshopResult | null {
  if (!detail.yaml) return null
  return {
    id: detail.id,
    yaml: detail.yaml,
    summary: detail.summary,
    consistencyReport: normalizeConsistency(detail.consistency_report),
    metadata: detail.metadata,
  }
}

function getStatusMeta(status: string) {
  switch (status) {
    case "succeeded":
      return {
        label: "已完成",
        badgeClass: "border-emerald-300/20 bg-emerald-400/12 text-emerald-200",
      }
    case "failed":
      return {
        label: "生成失败",
        badgeClass: "border-rose-300/20 bg-rose-400/12 text-rose-200",
      }
    case "running":
      return {
        label: "生成中",
        badgeClass: "border-sky-300/20 bg-sky-400/12 text-sky-200",
      }
    default:
      return {
        label: "等待中",
        badgeClass: "border-white/10 bg-white/8 text-white/68",
      }
  }
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/yaml;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function GenerationOverlay({
  stepText,
  chapterCount,
  genre,
  tone,
  pacing,
}: {
  stepText: string
  chapterCount: number
  genre: string
  tone: string
  pacing: string
}) {
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
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {stepText}
          </p>

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

function TreeNode({
  node,
  selectedId,
  onSelect,
  level = 0,
}: {
  node: ScriptTreeNode
  selectedId: string | null
  onSelect: (node: ScriptTreeNode) => void
  level?: number
}) {
  const [open, setOpen] = useState(level < 2)
  const hasChildren = node.children.length > 0

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => {
          onSelect(node)
          if (hasChildren) {
            setOpen((value) => !value)
          }
        }}
        className={cn(
          "flex w-full items-start gap-2 rounded-2xl px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950",
          selectedId === node.id && "bg-slate-100 text-slate-950"
        )}
        style={{ paddingLeft: `${level * 14 + 12}px` }}
      >
        {hasChildren ? (
          open ? (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          )
        ) : (
          <span className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <div className="min-w-0">
          <span className="block break-all">{node.label}</span>
          <span className="mt-0.5 block truncate text-xs text-slate-400">
            {node.description}
          </span>
        </div>
      </button>
      {hasChildren && open ? (
        <div className="space-y-1">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function extractErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "msg" in error.response.data &&
    typeof error.response.data.msg === "string"
  ) {
    return error.response.data.msg
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message
  }
  return fallback
}

export default function ScriptWorkshopPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, logout: clearAuth } = useAuthStore()

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
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [statusFilters, setStatusFilters] = useState<ScriptTaskStatus[]>([])
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [feedback, setFeedback] = useState("")
  const [history, setHistory] = useState<ScriptHistoryItem[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [activeResult, setActiveResult] = useState<WorkshopResult | null>(null)
  const [editableDocument, setEditableDocument] = useState<ScriptYamlDocument | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [activeChapterIndex, setActiveChapterIndex] = useState(0)
  const [view, setView] = useState<ResultView>("overview")
  const [wrapYaml, setWrapYaml] = useState(true)
  const [generationStepIndex, setGenerationStepIndex] = useState(0)
  const [draggedBeatId, setDraggedBeatId] = useState<string | null>(null)
  const [dragOverBeatId, setDragOverBeatId] = useState<string | null>(null)
  const statusMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
  }, [draft])

  useEffect(() => {
    void loadHistory()
  }, [])

  useEffect(() => {
    if (!isSubmitting) return

    const timer = window.setInterval(() => {
      setGenerationStepIndex((current) => (current + 1) % GENERATION_STEPS.length)
    }, 1800)

    return () => window.clearInterval(timer)
  }, [isSubmitting])

  useEffect(() => {
    if (!isStatusMenuOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!statusMenuRef.current?.contains(event.target as Node)) {
        setIsStatusMenuOpen(false)
      }
    }

    window.addEventListener("mousedown", handlePointerDown)
    return () => window.removeEventListener("mousedown", handlePointerDown)
  }, [isStatusMenuOpen])

  async function loadHistory() {
    setIsHistoryLoading(true)
    try {
      const response = await getScriptHistory({ page: 1, page_size: 20 })
      if (response.code === 0) {
        setHistory(response.data.items)
      } else {
        setError(response.msg || "历史记录加载失败")
      }
    } catch (err) {
      setError(extractErrorMessage(err, "历史记录加载失败"))
    } finally {
      setIsHistoryLoading(false)
    }
  }

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

  function toggleStatusFilter(status: ScriptTaskStatus) {
    setStatusFilters((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status]
    )
  }

  function applyDocumentUpdate(updater: (current: ScriptYamlDocument) => ScriptYamlDocument) {
    setEditableDocument((current) => (current ? updater(current) : current))
  }

  function setResultForEditing(result: WorkshopResult | null) {
    setActiveResult(result)
    setEditableDocument(result ? parseScriptYaml(result.yaml) : null)
  }

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
    setFeedback("节拍顺序已更新，YAML 结构已同步。")
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
        scenes: chapter.scenes.map((scene) => ({
          ...scene,
          pov: scene.pov === previous ? currentName : scene.pov,
          beats: scene.beats.map((beat) =>
            beat.dialogue?.speaker === previous
              ? {
                  ...beat,
                  dialogue: {
                    speaker: currentName,
                    content: beat.dialogue.content,
                  },
                }
              : beat
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
        scenes: chapter.scenes.map((scene) => ({
          ...scene,
          location: scene.location === previous ? currentName : scene.location,
        })),
      })),
    }))
  }

  function addCharacter() {
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
  }

  function addSetting() {
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
  }

  async function handleSubmit(
    event: Parameters<NonNullable<ComponentProps<"form">["onSubmit"]>>[0]
  ) {
    event.preventDefault()
    setError("")
    setFeedback("")

    const trimmedChapters = draft.chapters.map((chapter) => ({
      title: chapter.title.trim(),
      text: chapter.text.trim(),
    }))

    if (trimmedChapters.length < 3) {
      setError("至少需要输入 3 个章节内容。")
      return
    }
    if (trimmedChapters.some((chapter) => !chapter.title || !chapter.text)) {
      setError("每一章都需要填写标题和正文。")
      return
    }

    setGenerationStepIndex(0)
    setIsSubmitting(true)
    try {
      const response = await convertScript({
        ...draft,
        chapters: trimmedChapters,
      })

      if (response.code !== 0 || !response.data) {
        setError(response.msg || "生成失败，请稍后重试。")
        return
      }

      const result = makeResultFromConvert(
        { ...draft, chapters: trimmedChapters },
        response.data
      )
      setResultForEditing(result)
      setSelectedTaskId(result.id)
      setSelectedNodeId(null)
      setSearchParams({ view: "detail" })
      setView("overview")
      setFeedback("第一版剧本舞台已经搭好，你可以继续看结构、复制 YAML 或回载历史。")
      await loadHistory()
    } catch (err) {
      setError(extractErrorMessage(err, "生成失败，请检查服务状态后重试。"))
    } finally {
      setIsSubmitting(false)
      setGenerationStepIndex(0)
    }
  }

  async function handleLoadHistory(item: ScriptHistoryItem) {
    setSelectedTaskId(item.id)
    setError("")
    setFeedback("")

    try {
      const response = await getScriptDetail(item.id)
      if (response.code !== 0 || !response.data) {
        setError(response.msg || "历史详情加载失败。")
        return
      }

      const detail = response.data
      const result = makeResultFromDetail(detail)
      if (result) {
        setResultForEditing(result)
        setSelectedNodeId(null)
        setSearchParams({ view: "detail" })
        setView("overview")
        setFeedback(`已载入「${detail.metadata.title}」的结果，你可以继续审阅结构。`)
      } else {
        setResultForEditing(null)
        setFeedback(
          detail.metadata.status === "failed"
            ? `该任务生成失败：${detail.metadata.err_msg || "请重试"}`
            : "该任务仍在处理中，请稍后刷新。"
        )
      }
    } catch (err) {
      setError(extractErrorMessage(err, "历史详情加载失败。"))
    }
  }

  async function handleCopyYaml() {
    if (!liveYaml) return
    try {
      await navigator.clipboard.writeText(liveYaml)
      setFeedback("YAML 已复制到剪贴板。")
    } catch {
      setError("复制失败，请手动选中复制。")
    }
  }

  function handleDownloadYaml() {
    if (!liveYaml || !activeResult) return
    const name = `${activeResult.metadata.title || "script-workshop"}.yaml`
    downloadTextFile(name, liveYaml)
    setFeedback("YAML 文件已开始下载。")
  }

  const semanticTree = useMemo(() => buildSemanticTree(editableDocument), [editableDocument])
  const liveYaml = useMemo(
    () => (editableDocument ? serializeScriptYaml(editableDocument) : activeResult?.yaml ?? ""),
    [editableDocument, activeResult?.yaml]
  )
  const consistency = editableDocument
    ? normalizeConsistency(buildScriptConsistency(editableDocument))
    : activeResult?.consistencyReport ?? {
        rolesMissing: [],
        settingsMissing: [],
        danglingRefs: [],
      }

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchesStatus =
        statusFilters.length === 0 || statusFilters.includes(item.status as ScriptTaskStatus)
      const matchesSearch =
        search.trim() === "" ||
        item.title.toLowerCase().includes(search.trim().toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [history, search, statusFilters])

  const statusFilterLabel =
    statusFilters.length === 0
      ? "全部状态"
      : statusFilters.length === 1
        ? STATUS_FILTER_OPTIONS.find((item) => item.value === statusFilters[0])?.label ??
          "状态筛选"
        : `已选 ${statusFilters.length} 项`

  const activeChapter = draft.chapters[activeChapterIndex] ?? draft.chapters[0]
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

  const activeStatus = getStatusMeta(activeResult?.metadata.status ?? "pending")
  const summary = editableDocument
    ? buildScriptSummary(editableDocument)
    : activeResult?.summary ?? {
        chapters: 0,
        scenes: 0,
        beats: 0,
        characters: 0,
        settings: 0,
      }
  return (
    <div className="min-h-screen bg-[#f6f6f7] text-slate-900">
      {isSubmitting ? (
        <GenerationOverlay
          stepText={GENERATION_STEPS[generationStepIndex]}
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
            footerLabel={activeResult ? activeStatus.label : "等待生成"}
            onLogoClick={() => navigate("/")}
            authActionLabel="登出"
            onAuthAction={handleLogout}
            items={[
              { key: "workspace", label: "工作台", icon: Wand2, onClick: () => setSearchParams({ view: "workspace" }) },
              { key: "history", label: "列表", icon: History, onClick: () => setSearchParams({ view: "history" }) },
              { key: "detail", label: "详情", icon: FileText, onClick: () => setSearchParams({ view: "detail" }) },
            ]}
          />

          <section className="space-y-6 pt-3">
            {sidebarView === "workspace" ? (
              <div className="mx-auto max-w-[980px] space-y-6">
                <div className="text-center">
                  <p className="text-lg font-semibold text-slate-800">
                    使用这个开始创作：
                    <span className="ml-2 text-sky-500">AI 剧本转换</span>
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    从灵感开始，或上传章节内容，快速生成可编辑的剧本 YAML 初稿
                  </p>
                </div>

                <StudioPanel
                  eyebrow="Workspace"
                  title="创作输入面板"
                  description="像即梦的主输入框一样，把注意力集中在内容输入本身。"
                  className="rounded-[30px] border-black/6 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
                >
                  <form className="space-y-6" onSubmit={handleSubmit}>
                    <div className="grid gap-4 lg:grid-cols-[116px_minmax(0,1fr)]">
                      <div className="flex h-28 items-center justify-center rounded-[24px] bg-slate-100 text-slate-400">
                        <LayoutTemplate className="h-7 w-7" />
                      </div>
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {draft.chapters.map((chapter, index) => (
                            <button
                              key={`${chapter.title}-${index}`}
                              type="button"
                              onClick={() => setActiveChapterIndex(index)}
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                                activeChapterIndex === index
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-black/8 bg-white text-slate-500 hover:bg-slate-50"
                              )}
                            >
                              第 {index + 1} 章
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={addChapter}
                            className="rounded-full border border-dashed border-black/10 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
                          >
                            + 新增章节
                          </button>
                        </div>

                        <Input
                          value={activeChapter?.title ?? ""}
                          onChange={(event) =>
                            updateChapter(activeChapterIndex, "title", event.target.value)
                          }
                          placeholder="给这一章起一个标题"
                          className="h-11 border-black/8 bg-slate-50 text-slate-900 placeholder:text-slate-400"
                        />

                        <textarea
                          value={activeChapter?.text ?? ""}
                          onChange={(event) =>
                            updateChapter(activeChapterIndex, "text", event.target.value)
                          }
                          placeholder="把这一章的小说正文粘贴到这里..."
                          className="min-h-[220px] w-full rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-slate-900/10"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-3">
                        <Label className="text-slate-600">体裁</Label>
                        <div className="flex flex-wrap gap-2">
                          {GENRE_OPTIONS.map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() =>
                                setDraft((prev) => ({ ...prev, genre: item }))
                              }
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                                draft.genre === item
                                  ? "border-sky-200 bg-sky-50 text-sky-700"
                                  : "border-black/8 bg-white text-slate-500 hover:bg-slate-50"
                              )}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-slate-600">语气</Label>
                        <div className="flex flex-wrap gap-2">
                          {TONE_OPTIONS.map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() =>
                                setDraft((prev) => ({ ...prev, tone: item }))
                              }
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                                draft.tone === item
                                  ? "border-slate-200 bg-slate-900 text-white"
                                  : "border-black/8 bg-white text-slate-500 hover:bg-slate-50"
                              )}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-slate-600">节奏</Label>
                        <div className="space-y-2">
                          {PACING_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() =>
                                setDraft((prev) => ({ ...prev, pacing: option.value }))
                              }
                              className={cn(
                                "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors",
                                draft.pacing === option.value
                                  ? "border-sky-200 bg-sky-50"
                                  : "border-black/8 bg-white hover:bg-slate-50"
                              )}
                            >
                              <div>
                                <p className="text-sm font-medium text-slate-800">
                                  {option.label}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {option.hint}
                                </p>
                              </div>
                              <div
                                className={cn(
                                  "h-3.5 w-3.5 rounded-full border",
                                  draft.pacing === option.value
                                    ? "border-slate-900 bg-slate-900"
                                    : "border-slate-300"
                                )}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        {[
                          "至少 3 章",
                          "自动生成 YAML",
                          "自动一致性质检",
                          "历史结果可回载",
                        ].map((item) => (
                          <span
                            key={item}
                            className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-xs text-slate-500"
                          >
                            {item}
                          </span>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setDraft(createDefaultDraft())
                            setActiveChapterIndex(0)
                            setFeedback("草稿已重置。")
                          }}
                          className="border-black/8 bg-white text-slate-700 hover:bg-slate-50"
                        >
                          重置
                        </Button>
                        <Button
                          type="submit"
                          disabled={isSubmitting}
                          className="h-11 rounded-2xl bg-slate-900 px-6 text-white hover:bg-slate-800"
                        >
                          {isSubmitting ? (
                            <>
                              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                              生成中...
                            </>
                          ) : (
                            <>
                              <Wand2 className="mr-2 h-4 w-4" />
                              开始生成
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </form>
                </StudioPanel>

                {(feedback || error) && (
                  <div className="space-y-3">
                    {feedback ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        {feedback}
                      </div>
                    ) : null}
                    {error ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}

            {sidebarView === "history" ? (
              <div className="mx-auto max-w-[1040px] space-y-6">
                <StudioPanel
                  eyebrow="History"
                  title="生成列表"
                  description="在这里查看全部生成记录，点击任一项进入详情。"
                  actions={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void loadHistory()}
                      className="text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  }
                  className="rounded-[30px] border-black/6 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
                >
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 md:flex-row">
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="搜索剧本标题"
                        className="h-11 flex-1 border-black/8 bg-slate-50 text-slate-900 placeholder:text-slate-400"
                      />
                      <div ref={statusMenuRef} className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsStatusMenuOpen((open) => !open)}
                          className="flex h-11 min-w-[148px] items-center justify-between gap-3 rounded-2xl border border-black/8 bg-white px-4 text-sm text-slate-600 transition-colors hover:bg-slate-50"
                        >
                          <span className="inline-flex items-center gap-2">
                            <ListFilter className="h-4 w-4 text-slate-400" />
                            {statusFilterLabel}
                          </span>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-slate-400 transition-transform",
                              isStatusMenuOpen && "rotate-180"
                            )}
                          />
                        </button>

                        {isStatusMenuOpen ? (
                          <div className="absolute right-0 top-[calc(100%+10px)] z-20 w-56 rounded-[22px] border border-black/6 bg-white/95 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.1)] backdrop-blur-xl">
                            <div className="flex items-center justify-between px-2 py-1.5">
                              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                                状态筛选
                              </span>
                              {statusFilters.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setStatusFilters([])}
                                  className="text-xs text-slate-400 transition-colors hover:text-slate-900"
                                >
                                  清空
                                </button>
                              ) : null}
                            </div>

                            <div className="space-y-1">
                              {STATUS_FILTER_OPTIONS.map((item) => {
                                const checked = statusFilters.includes(item.value)
                                return (
                                  <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => toggleStatusFilter(item.value)}
                                    className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950"
                                  >
                                    <span>{item.label}</span>
                                    <span
                                      className={cn(
                                        "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
                                        checked
                                          ? "border-slate-900 bg-slate-900 text-white"
                                          : "border-black/8 bg-white text-transparent"
                                      )}
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {isHistoryLoading ? (
                        <div className="rounded-[24px] border border-dashed border-black/8 px-4 py-10 text-center text-sm text-slate-400">
                          正在加载生成列表...
                        </div>
                      ) : filteredHistory.length === 0 ? (
                        <div className="rounded-[24px] border border-dashed border-black/8 px-4 py-10 text-center text-sm text-slate-400">
                          还没有生成记录。
                        </div>
                      ) : (
                        filteredHistory.map((item) => {
                          const meta = getStatusMeta(item.status)
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => void handleLoadHistory(item)}
                              className={cn(
                                "w-full rounded-[24px] border px-5 py-4 text-left transition-colors",
                                selectedTaskId === item.id
                                  ? "border-slate-200 bg-slate-50"
                                  : "border-black/6 bg-white hover:bg-slate-50"
                              )}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-base font-medium text-slate-900">
                                    {item.title}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-400">
                                    {item.genre} / {item.tone} / {item.pacing}
                                  </p>
                                </div>
                                <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-xs text-slate-500">
                                  {meta.label}
                                </span>
                              </div>
                              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                                <span>{formatDateTime(item.updated_at)}</span>
                                <span>{item.source_chapters} 章输入</span>
                              </div>
                              {item.err_msg ? (
                                <p className="mt-3 text-xs text-rose-600">{item.err_msg}</p>
                              ) : null}
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                </StudioPanel>
              </div>
            ) : null}

            {sidebarView === "detail" ? (
              <div className="mx-auto max-w-[1040px] space-y-6">
                {!activeResult ? (
                  <StudioPanel
                    eyebrow="Detail"
                    title="详情预览"
                    description="先在工作台生成剧本，或从生成列表中点开一个历史结果。"
                    className="rounded-[30px] border-black/6 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
                  >
                    <div className="rounded-[24px] border border-dashed border-black/8 px-4 py-16 text-center">
                      <p className="text-lg font-medium text-slate-800">还没有可展示的详情</p>
                      <p className="mt-2 text-sm text-slate-400">
                        你可以前往工作台生成，或者打开左侧“列表”选择一个已生成结果。
                      </p>
                    </div>
                  </StudioPanel>
                ) : (
                  <>
                    <StudioPanel
                      eyebrow="Detail"
                      title={activeResult.metadata.title}
                      description="结果详情保持简单干净，只展示最关键的信息。"
                      actions={
                        <div className="flex flex-wrap gap-2">
                          {([
                            { key: "overview", label: "概览" },
                            { key: "yaml", label: "YAML" },
                            { key: "structure", label: "结构" },
                          ] as const).map((item) => (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => setView(item.key)}
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                                view === item.key
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-black/8 bg-white text-slate-500 hover:bg-slate-50"
                              )}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      }
                      className="rounded-[30px] border-black/6 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
                    >
                      {view === "overview" ? (
                        <div className="space-y-5">
                          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                            {[
                              { label: "章节", value: summary.chapters },
                              { label: "场景", value: summary.scenes },
                              { label: "节拍", value: summary.beats },
                              { label: "角色", value: summary.characters },
                              { label: "地点", value: summary.settings },
                            ].map((item) => (
                              <div
                                key={item.label}
                                className="rounded-[22px] border border-black/6 bg-slate-50 px-4 py-4"
                              >
                                <p className="text-xs text-slate-400">{item.label}</p>
                                <p className="mt-2 text-2xl font-semibold text-slate-900">
                                  {item.value}
                                </p>
                              </div>
                            ))}
                          </div>

                          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                            <div className="rounded-[24px] border border-black/6 bg-slate-50 p-5">
                              <p className="text-xs text-slate-400">结果摘要</p>
                              <p className="mt-3 text-sm leading-7 text-slate-600">
                                当前体裁为 {activeResult.metadata.genre}，语气为 {activeResult.metadata.tone}，节奏为 {activeResult.metadata.pacing}。本次结果基于 {activeResult.metadata.source_chapters} 章输入生成。
                              </p>
                              <p className="mt-4 text-sm text-slate-400">
                                最近更新：{formatDateTime(activeResult.metadata.updated_at)}
                              </p>
                            </div>
                            <div className="rounded-[24px] border border-black/6 bg-slate-50 p-5">
                              <p className="text-xs text-slate-400">一致性质检</p>
                              <div className="mt-4 space-y-3 text-sm">
                                <div className="rounded-2xl bg-white px-4 py-3 text-slate-600">
                                  角色缺失：{consistency.rolesMissing.length}
                                </div>
                                <div className="rounded-2xl bg-white px-4 py-3 text-slate-600">
                                  地点缺失：{consistency.settingsMissing.length}
                                </div>
                                <div className="rounded-2xl bg-white px-4 py-3 text-slate-600">
                                  悬空引用：{consistency.danglingRefs.length}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {view === "yaml" ? (
                        <div className="space-y-4">
                          <div className="flex flex-wrap gap-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setWrapYaml((value) => !value)}
                              className="border-black/8 bg-white text-slate-700 hover:bg-slate-50"
                            >
                              {wrapYaml ? "关闭换行" : "自动换行"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleCopyYaml()}
                              className="border-black/8 bg-white text-slate-700 hover:bg-slate-50"
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              复制
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleDownloadYaml}
                              className="bg-slate-900 text-white hover:bg-slate-800"
                            >
                              <Download className="mr-2 h-4 w-4" />
                              下载
                            </Button>
                          </div>
                          <div className="rounded-[24px] border border-black/6 bg-slate-900 p-4">
                            <pre
                              className={cn(
                                "max-h-[560px] overflow-auto font-mono text-sm leading-6 text-slate-100",
                                wrapYaml ? "whitespace-pre-wrap wrap-break-word" : "whitespace-pre"
                              )}
                            >
                              {liveYaml}
                            </pre>
                          </div>
                        </div>
                      ) : null}

                      {view === "structure" ? (
                        <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
                          <div className="space-y-4">
                            <div className="rounded-[24px] border border-black/6 bg-slate-50 p-4">
                              <p className="text-xs text-slate-400">结构树</p>
                              <p className="mt-2 text-sm leading-6 text-slate-500">
                                按章节、场景、节拍逐层查看。点击任意节点，中间表单会自动切到对应内容。
                              </p>
                            </div>
                            <div className="max-h-[560px] overflow-y-auto rounded-[24px] border border-black/6 bg-slate-50 p-3">
                              <div className="space-y-1">
                                {semanticTree.map((node) => (
                                  <TreeNode
                                    key={node.id}
                                    node={node}
                                    selectedId={selectedNode?.id ?? null}
                                    onSelect={(node) => setSelectedNodeId(node.id)}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-[24px] border border-black/6 bg-slate-50 p-5">
                            {!editableDocument ? (
                              <div className="rounded-[20px] border border-dashed border-black/8 bg-white px-4 py-10 text-center text-sm text-slate-400">
                                当前结果暂时无法解析成语义结构，请先重新生成一次剧本。
                              </div>
                            ) : !selectedNode ? (
                              <div className="rounded-[20px] border border-dashed border-black/8 bg-white px-4 py-10 text-center text-sm text-slate-400">
                                选择左侧节点开始编辑。
                              </div>
                            ) : (
                              <div className="space-y-5">
                                <div className="flex flex-wrap items-start justify-between gap-4 rounded-[20px] bg-white px-4 py-4">
                                  <div>
                                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                      {selectedNode.kind === "chapter"
                                        ? "章节编辑"
                                        : selectedNode.kind === "scene"
                                          ? "场景编辑"
                                          : "节拍编辑"}
                                    </p>
                                    <h3 className="mt-2 text-lg font-semibold text-slate-900">
                                      {selectedNode.label}
                                    </h3>
                                    <p className="mt-2 text-sm leading-6 text-slate-500">
                                      修改这里的可视化字段后，YAML 源码视图会实时同步更新。
                                    </p>
                                  </div>
                                  <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs text-sky-600">
                                    子节点 {selectedNode.children.length}
                                  </span>
                                </div>

                                {selectedNode.kind === "chapter" && selectedChapterData ? (
                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <Label className="text-slate-600">章节标题</Label>
                                      <Input
                                        value={selectedChapterData.title}
                                        onChange={(event) =>
                                          updateScriptChapter(selectedNode.chapterIndex, (chapter) => ({
                                            ...chapter,
                                            title: event.target.value,
                                          }))
                                        }
                                        placeholder="请输入章节标题"
                                        className="h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-slate-600">章节梗概</Label>
                                      <textarea
                                        value={selectedChapterData.summary}
                                        onChange={(event) =>
                                          updateScriptChapter(selectedNode.chapterIndex, (chapter) => ({
                                            ...chapter,
                                            summary: event.target.value,
                                          }))
                                        }
                                        placeholder="概括这一章的主要推进"
                                        className="min-h-[180px] w-full rounded-[24px] border border-black/8 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                      />
                                    </div>
                                  </div>
                                ) : null}

                                {selectedNode.kind === "scene" && selectedSceneData ? (
                                  <div className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-2">
                                      <div className="space-y-2">
                                        <Label className="text-slate-600">场景标题</Label>
                                        <Input
                                          value={selectedSceneData.title}
                                          onChange={(event) =>
                                            updateScriptScene(
                                              selectedNode.chapterIndex,
                                              selectedNode.sceneIndex ?? 0,
                                              (scene) => ({ ...scene, title: event.target.value })
                                            )
                                          }
                                          placeholder="请输入场景标题"
                                          className="h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-slate-600">地点</Label>
                                        <select
                                          value={selectedSceneData.location}
                                          onChange={(event) =>
                                            updateScriptScene(
                                              selectedNode.chapterIndex,
                                              selectedNode.sceneIndex ?? 0,
                                              (scene) => ({ ...scene, location: event.target.value })
                                            )
                                          }
                                          className="h-11 w-full rounded-2xl border border-black/8 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                        >
                                          <option value="">请选择地点</option>
                                          {currentLocationOptions.map((item) => (
                                            <option key={item} value={item}>
                                              {settingNames.includes(item) ? item : `${item}（未注册）`}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-slate-600">时间</Label>
                                        <Input
                                          value={selectedSceneData.time}
                                          onChange={(event) =>
                                            updateScriptScene(
                                              selectedNode.chapterIndex,
                                              selectedNode.sceneIndex ?? 0,
                                              (scene) => ({ ...scene, time: event.target.value })
                                            )
                                          }
                                          placeholder="如 Day / Night"
                                          className="h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-slate-600">视角角色</Label>
                                        <select
                                          value={selectedSceneData.pov}
                                          onChange={(event) =>
                                            updateScriptScene(
                                              selectedNode.chapterIndex,
                                              selectedNode.sceneIndex ?? 0,
                                              (scene) => ({ ...scene, pov: event.target.value })
                                            )
                                          }
                                          className="h-11 w-full rounded-2xl border border-black/8 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                        >
                                          <option value="">请选择角色</option>
                                          {currentPovOptions.map((item) => (
                                            <option key={item} value={item}>
                                              {characterNames.includes(item) ? item : `${item}（未注册）`}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-slate-600">场景目标</Label>
                                      <textarea
                                        value={selectedSceneData.goal}
                                        onChange={(event) =>
                                          updateScriptScene(
                                            selectedNode.chapterIndex,
                                            selectedNode.sceneIndex ?? 0,
                                            (scene) => ({ ...scene, goal: event.target.value })
                                          )
                                        }
                                        placeholder="写下这一场景的推进目标"
                                        className="min-h-[120px] w-full rounded-[24px] border border-black/8 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                      />
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                      <div className="space-y-2">
                                        <Label className="text-slate-600">氛围</Label>
                                        <Input
                                          value={selectedSceneData.mood}
                                          onChange={(event) =>
                                            updateScriptScene(
                                              selectedNode.chapterIndex,
                                              selectedNode.sceneIndex ?? 0,
                                              (scene) => ({ ...scene, mood: event.target.value })
                                            )
                                          }
                                          placeholder="如 紧张 / 温暖"
                                          className="h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                        />
                                      </div>
                                      <div className="rounded-[20px] border border-black/6 bg-white px-4 py-4 text-sm text-slate-500">
                                        该场景共有 {selectedSceneData.beats.length} 个节拍。你可以直接拖拽下方卡片调整顺序，或点击左侧节拍节点编辑内容。
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <Label className="text-slate-600">节拍排序</Label>
                                        <span className="text-xs text-slate-400">
                                          拖拽卡片可调整顺序
                                        </span>
                                      </div>
                                      <div className="space-y-3">
                                        {selectedSceneData.beats.map((beat, beatIndex) => {
                                          const beatNodeId = `beat-${beat.id}`
                                          const active = selectedNodeId === beatNodeId
                                          const isDragOver = dragOverBeatId === beat.id

                                          return (
                                            <button
                                              key={beat.id}
                                              type="button"
                                              draggable
                                              onDragStart={() => setDraggedBeatId(beat.id)}
                                              onDragOver={(event) => {
                                                event.preventDefault()
                                                if (dragOverBeatId !== beat.id) {
                                                  setDragOverBeatId(beat.id)
                                                }
                                              }}
                                              onDragEnd={() => {
                                                setDraggedBeatId(null)
                                                setDragOverBeatId(null)
                                              }}
                                              onDrop={(event) => {
                                                event.preventDefault()
                                                const fromIndex = selectedSceneData.beats.findIndex(
                                                  (item) => item.id === draggedBeatId
                                                )
                                                if (fromIndex >= 0) {
                                                  moveBeatInScene(
                                                    selectedNode.chapterIndex,
                                                    selectedNode.sceneIndex ?? 0,
                                                    fromIndex,
                                                    beatIndex
                                                  )
                                                }
                                                setDraggedBeatId(null)
                                                setDragOverBeatId(null)
                                              }}
                                              onClick={() => setSelectedNodeId(beatNodeId)}
                                              className={cn(
                                                "flex w-full items-start gap-3 rounded-[20px] border bg-white px-4 py-4 text-left transition-all",
                                                active
                                                  ? "border-sky-200 bg-sky-50/70"
                                                  : "border-black/6 hover:bg-slate-50",
                                                isDragOver && "border-sky-300 shadow-[0_0_0_3px_rgba(125,211,252,0.25)]",
                                                draggedBeatId === beat.id && "opacity-60"
                                              )}
                                            >
                                              <div className="mt-0.5 flex items-center gap-3 text-slate-300">
                                                <GripVertical className="h-4 w-4" />
                                                <span className="text-xs font-medium text-slate-400">
                                                  {beatIndex + 1}
                                                </span>
                                              </div>
                                              <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                  <span className="rounded-full border border-black/8 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-500">
                                                    {beat.type}
                                                  </span>
                                                  <span className="text-sm font-medium text-slate-900">
                                                    {beat.summary || `节拍 ${beatIndex + 1}`}
                                                  </span>
                                                </div>
                                                <p className="mt-2 text-sm leading-6 text-slate-500">
                                                  {beat.dialogue?.speaker
                                                    ? `${beat.dialogue.speaker}：${beat.dialogue.content || "待补充对白"}`
                                                    : "动作 / 叙述类节拍，可点击进入编辑详情。"}
                                                </p>
                                              </div>
                                            </button>
                                          )
                                        })}
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-slate-600">场景收尾</Label>
                                      <textarea
                                        value={selectedSceneData.outcome}
                                        onChange={(event) =>
                                          updateScriptScene(
                                            selectedNode.chapterIndex,
                                            selectedNode.sceneIndex ?? 0,
                                            (scene) => ({ ...scene, outcome: event.target.value })
                                          )
                                        }
                                        placeholder="描述这一场的收尾结果或悬念"
                                        className="min-h-[120px] w-full rounded-[24px] border border-black/8 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                      />
                                    </div>
                                  </div>
                                ) : null}

                                {selectedNode.kind === "beat" && selectedBeatData ? (
                                  <div className="space-y-4">
                                    <div className="flex flex-wrap gap-2">
                                      {(["action", "dialogue", "inner", "exposition"] as const).map(
                                        (type) => (
                                          <button
                                            key={type}
                                            type="button"
                                            onClick={() =>
                                              updateScriptBeat(
                                                selectedNode.chapterIndex,
                                                selectedNode.sceneIndex ?? 0,
                                                selectedNode.beatIndex ?? 0,
                                                (beat) => ({
                                                  ...beat,
                                                  type,
                                                  dialogue:
                                                    type === "dialogue" || type === "inner"
                                                      ? beat.dialogue ?? { speaker: "", content: "" }
                                                      : undefined,
                                                })
                                              )
                                            }
                                            className={cn(
                                              "rounded-full border px-3 py-1.5 text-sm transition-colors",
                                              selectedBeatData.type === type
                                                ? "border-sky-200 bg-sky-50 text-sky-700"
                                                : "border-black/8 bg-white text-slate-500 hover:bg-slate-50"
                                            )}
                                          >
                                            {type}
                                          </button>
                                        )
                                      )}
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-slate-600">节拍摘要</Label>
                                      <Input
                                        value={selectedBeatData.summary}
                                        onChange={(event) =>
                                          updateScriptBeat(
                                            selectedNode.chapterIndex,
                                            selectedNode.sceneIndex ?? 0,
                                            selectedNode.beatIndex ?? 0,
                                            (beat) => ({ ...beat, summary: event.target.value })
                                          )
                                        }
                                        placeholder="概括这一拍发生了什么"
                                        className="h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                      />
                                    </div>
                                    {selectedBeatData.type === "dialogue" ||
                                    selectedBeatData.type === "inner" ? (
                                      <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                          <Label className="text-slate-600">角色名</Label>
                                          <select
                                            value={selectedBeatData.dialogue?.speaker ?? ""}
                                            onChange={(event) =>
                                              updateScriptBeat(
                                                selectedNode.chapterIndex,
                                                selectedNode.sceneIndex ?? 0,
                                                selectedNode.beatIndex ?? 0,
                                                (beat) => ({
                                                  ...beat,
                                                  dialogue: {
                                                    speaker: event.target.value,
                                                    content: beat.dialogue?.content ?? "",
                                                  },
                                                })
                                              )
                                            }
                                            className="h-11 w-full rounded-2xl border border-black/8 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                          >
                                            <option value="">请选择角色</option>
                                            {currentSpeakerOptions.map((item) => (
                                              <option key={item} value={item}>
                                                {characterNames.includes(item) ? item : `${item}（未注册）`}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="rounded-[20px] border border-black/6 bg-white px-4 py-4 text-sm text-slate-500">
                                          这里修改角色名后，源码视图中的 `dialogue.speaker` 会实时同步。
                                        </div>
                                      </div>
                                    ) : null}
                                    {selectedBeatData.type === "dialogue" ||
                                    selectedBeatData.type === "inner" ? (
                                      <div className="space-y-2">
                                        <Label className="text-slate-600">对白内容</Label>
                                        <textarea
                                          value={selectedBeatData.dialogue?.content ?? ""}
                                          onChange={(event) =>
                                            updateScriptBeat(
                                              selectedNode.chapterIndex,
                                              selectedNode.sceneIndex ?? 0,
                                              selectedNode.beatIndex ?? 0,
                                              (beat) => ({
                                                ...beat,
                                                dialogue: {
                                                  speaker: beat.dialogue?.speaker ?? "",
                                                  content: event.target.value,
                                                },
                                              })
                                            )
                                          }
                                          placeholder="请输入对白或内心独白"
                                          className="min-h-[160px] w-full rounded-[24px] border border-black/8 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                        />
                                      </div>
                                    ) : (
                                      <div className="rounded-[20px] border border-dashed border-black/8 bg-white px-4 py-6 text-sm text-slate-400">
                                        当前节拍类型无需对白字段，你可以继续编辑节拍摘要，或切换成 dialogue / inner 类型。
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </StudioPanel>

                    <StudioPanel
                      eyebrow="Registry"
                      title="人物表与地点表"
                      description="在这里维护全剧角色和地点注册表；改名时会自动同步场景视角、对白说话人和场景地点引用。"
                      className="rounded-[30px] border-black/6 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
                    >
                      {!editableDocument ? (
                        <div className="rounded-[24px] border border-dashed border-black/8 px-4 py-12 text-center text-sm text-slate-400">
                          当前结果暂时无法编辑人物表和地点表。
                        </div>
                      ) : (
                        <div className="grid gap-5 xl:grid-cols-2">
                          <div className="space-y-4 rounded-[24px] border border-black/6 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-slate-900">人物表</p>
                                <p className="mt-1 text-xs text-slate-400">
                                  角色名修改后会自动同步场景视角和对白说话人。
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addCharacter}
                                className="border-black/8 bg-white text-slate-700 hover:bg-slate-50"
                              >
                                新增角色
                              </Button>
                            </div>

                            <div className="space-y-3">
                              {editableDocument.dramatis_personae.map((character, index) => (
                                <div
                                  key={`${character.name}-${index}`}
                                  className="space-y-3 rounded-[20px] border border-black/6 bg-white p-4"
                                >
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                      <Label className="text-slate-600">角色名</Label>
                                      <Input
                                        value={character.name}
                                        onChange={(event) => {
                                          const nextName = event.target.value
                                          updateScriptCharacter(index, (item) => ({
                                            ...item,
                                            name: nextName,
                                          }))
                                          renameCharacterReferences(character.name, nextName)
                                        }}
                                        placeholder="请输入角色名"
                                        className="h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-slate-600">角色类型</Label>
                                      <Input
                                        value={character.archetype}
                                        onChange={(event) =>
                                          updateScriptCharacter(index, (item) => ({
                                            ...item,
                                            archetype: event.target.value,
                                          }))
                                        }
                                        placeholder="主角 / 配角 / 反派"
                                        className="h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-slate-600">动机</Label>
                                    <textarea
                                      value={character.motivation}
                                      onChange={(event) =>
                                        updateScriptCharacter(index, (item) => ({
                                          ...item,
                                          motivation: event.target.value,
                                        }))
                                      }
                                      placeholder="写下角色核心行动动机"
                                      className="min-h-[100px] w-full rounded-[20px] border border-black/8 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                    />
                                  </div>
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                      <Label className="text-slate-600">性格标签</Label>
                                      <Input
                                        value={character.traits.join("，")}
                                        onChange={(event) =>
                                          updateScriptCharacter(index, (item) => ({
                                            ...item,
                                            traits: event.target.value
                                              .split(/[,，]/)
                                              .map((value) => value.trim())
                                              .filter(Boolean),
                                          }))
                                        }
                                        placeholder="冷静，执着"
                                        className="h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-slate-600">首次出现</Label>
                                      <Input
                                        value={character.first_appearance}
                                        onChange={(event) =>
                                          updateScriptCharacter(index, (item) => ({
                                            ...item,
                                            first_appearance: event.target.value,
                                          }))
                                        }
                                        placeholder="Chapter 1"
                                        className="h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-4 rounded-[24px] border border-black/6 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-slate-900">地点表</p>
                                <p className="mt-1 text-xs text-slate-400">
                                  地点名修改后会自动同步所有场景的 `location` 引用。
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addSetting}
                                className="border-black/8 bg-white text-slate-700 hover:bg-slate-50"
                              >
                                新增地点
                              </Button>
                            </div>

                            <div className="space-y-3">
                              {editableDocument.settings.map((setting, index) => (
                                <div
                                  key={`${setting.name}-${index}`}
                                  className="space-y-3 rounded-[20px] border border-black/6 bg-white p-4"
                                >
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                      <Label className="text-slate-600">地点名</Label>
                                      <Input
                                        value={setting.name}
                                        onChange={(event) => {
                                          const nextName = event.target.value
                                          updateScriptSetting(index, (item) => ({
                                            ...item,
                                            name: nextName,
                                          }))
                                          renameSettingReferences(setting.name, nextName)
                                        }}
                                        placeholder="请输入地点名"
                                        className="h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-slate-600">重要程度</Label>
                                      <select
                                        value={setting.importance}
                                        onChange={(event) =>
                                          updateScriptSetting(index, (item) => ({
                                            ...item,
                                            importance: event.target.value,
                                          }))
                                        }
                                        className="h-11 w-full rounded-2xl border border-black/8 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                      >
                                        <option value="high">high</option>
                                        <option value="medium">medium</option>
                                        <option value="low">low</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-slate-600">地点描述</Label>
                                    <textarea
                                      value={setting.description}
                                      onChange={(event) =>
                                        updateScriptSetting(index, (item) => ({
                                          ...item,
                                          description: event.target.value,
                                        }))
                                      }
                                      placeholder="描述环境、氛围和重要细节"
                                      className="min-h-[120px] w-full rounded-[20px] border border-black/8 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </StudioPanel>

                    <StudioPanel
                      eyebrow="Consistency"
                      title="一致性质检详情"
                      description="保持和页面主风格一致，不再单独堆很多颜色块。"
                      className="rounded-[30px] border-black/6 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
                    >
                      <div className="grid gap-4 md:grid-cols-3">
                        {[
                          {
                            label: "角色引用缺失",
                            items: consistency.rolesMissing,
                          },
                          {
                            label: "场景地点缺失",
                            items: consistency.settingsMissing,
                          },
                          {
                            label: "悬空引用",
                            items: consistency.danglingRefs,
                          },
                        ].map((group) => (
                          <div
                            key={group.label}
                            className="rounded-[24px] border border-black/6 bg-slate-50 p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4 text-slate-400" />
                                <p className="text-sm font-medium text-slate-800">
                                  {group.label}
                                </p>
                              </div>
                              <span className="rounded-full border border-black/8 bg-white px-2 py-0.5 text-xs text-slate-500">
                                {group.items.length}
                              </span>
                            </div>
                            {group.items.length > 0 ? (
                              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                                {group.items.map((item) => (
                                  <li
                                    key={`${group.label}-${item}`}
                                    className="rounded-2xl bg-white px-3 py-2"
                                  >
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-3 text-sm text-slate-400">暂无问题</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </StudioPanel>
                  </>
                )}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  )
}
