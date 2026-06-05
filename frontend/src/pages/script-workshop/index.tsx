import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ComponentProps } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  ChevronDown,
  ChevronRight,
  Check,
  CircleCheckBig,
  Copy,
  Download,
  FileText,
  GripVertical,
  History,
  LoaderCircle,
  ListFilter,
  RefreshCw,
  Trash2,
  Wand2,
} from "lucide-react"
import { ConsistencyPanel } from "@/components/script-workshop/consistency-panel"
import { ScriptDetailHeader } from "@/components/script-workshop/detail-header"
import { FloatingSaveButton } from "@/components/script-workshop/floating-save-button"
import { GenerationOverlay } from "@/components/script-workshop/generation-overlay"
import { RenameConfirmDialog } from "@/components/script-workshop/rename-confirm-dialog"
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
import { toast } from "sonner"
import {
  convertScript,
  getScriptDetail,
  getScriptHistory,
  logout,
  openScriptEventStream,
  saveScriptResult,
} from "@/services"
import { useAuthStore } from "@/stores"
import type {
  ScriptBeat,
  ScriptChapter,
  ScriptChapterInput,
  ScriptConvertRequest,
  ScriptDetailResponse,
  ScriptHistoryItem,
  ScriptScene,
  ScriptSummary,
  ScriptTaskEvent,
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
type RegistryTab = "characters" | "settings"
type ValidationErrors = Record<string, string>
type RenameConfirmState = {
  kind: RegistryTab
  previousName: string
  nextName: string
} | null

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

function replaceLiteralText(source: string, from: string, to: string) {
  if (!from || from === to || !source.includes(from)) {
    return source
  }
  return source.split(from).join(to)
}

function createDefaultDraft(): ScriptConvertRequest {
  return {
    chapters: DEFAULT_CHAPTERS,
    genre: GENRE_OPTIONS[0],
    tone: TONE_OPTIONS[0],
    pacing: "medium",
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

function getGenerationStepText(stage?: string, message?: string) {
  if (message) {
    return message
  }

  switch (stage) {
    case "queued":
      return "任务已进入队列，等待后台执行。"
    case "starting":
      return "后台任务已启动，正在准备本次转换。"
    case "generating":
      return "正在调用大模型生成角色、场景与节拍结构。"
    case "validating":
      return "正在校验 YAML 结构并整理一致性质检。"
    case "repairing":
      return "首轮结果需要修复，正在自动重试。"
    case "persisting":
      return "结构校验通过，正在写入结果。"
    case "completed":
      return "第一版剧本已经生成完成。"
    case "failed":
      return "任务执行失败。"
    default:
      return GENERATION_STEPS[0]
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

function ValidationMessage({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="text-xs text-rose-500">{message}</p>
}

function getHumanFieldName(path: string) {
  const topLevelFields: Record<string, string> = {
    version: "版本号",
    metadata: "元数据",
    "metadata.title": "剧本标题",
    "metadata.author": "作者",
    "metadata.genre": "体裁",
    "metadata.tone": "语气",
    "metadata.pacing": "节奏",
    "metadata.source_chapters": "章节数量",
  }

  if (topLevelFields[path]) {
    return topLevelFields[path]
  }

  const characterMatch = path.match(/^dramatis_personae\[(\d+)\]\.(.+)$/)
  if (characterMatch) {
    const index = Number(characterMatch[1]) + 1
    const fieldMap: Record<string, string> = {
      name: "角色名",
      archetype: "角色类型",
      motivation: "角色动机",
      first_appearance: "首次出现",
    }
    return `人物表第 ${index} 项${fieldMap[characterMatch[2]] ?? characterMatch[2]}`
  }

  const settingMatch = path.match(/^settings\[(\d+)\]\.(.+)$/)
  if (settingMatch) {
    const index = Number(settingMatch[1]) + 1
    const fieldMap: Record<string, string> = {
      name: "地点名",
      description: "地点描述",
      importance: "重要程度",
    }
    return `地点表第 ${index} 项${fieldMap[settingMatch[2]] ?? settingMatch[2]}`
  }

  const beatMatch = path.match(
    /^chapters\[(\d+)\]\.scenes\[(\d+)\]\.beats\[(\d+)\]\.(.+)$/
  )
  if (beatMatch) {
    const chapter = Number(beatMatch[1]) + 1
    const scene = Number(beatMatch[2]) + 1
    const beat = Number(beatMatch[3]) + 1
    const fieldMap: Record<string, string> = {
      summary: "节拍摘要",
      type: "节拍类型",
      "dialogue.speaker": "对白角色",
      "dialogue.content": "对白内容",
    }
    return `第 ${chapter} 章第 ${scene} 个场景第 ${beat} 个节拍的${
      fieldMap[beatMatch[4]] ?? beatMatch[4]
    }`
  }

  const sceneMatch = path.match(/^chapters\[(\d+)\]\.scenes\[(\d+)\]\.(.+)$/)
  if (sceneMatch) {
    const chapter = Number(sceneMatch[1]) + 1
    const scene = Number(sceneMatch[2]) + 1
    const fieldMap: Record<string, string> = {
      title: "场景标题",
      goal: "场景目标",
      location: "场景地点",
      time: "时间",
      pov: "视角角色",
      mood: "氛围",
      outcome: "场景收尾",
    }
    return `第 ${chapter} 章第 ${scene} 个场景的${
      fieldMap[sceneMatch[3]] ?? sceneMatch[3]
    }`
  }

  const chapterMatch = path.match(/^chapters\[(\d+)\]\.(.+)$/)
  if (chapterMatch) {
    const chapter = Number(chapterMatch[1]) + 1
    const fieldMap: Record<string, string> = {
      title: "章节标题",
      summary: "章节梗概",
    }
    return `第 ${chapter} 章的${fieldMap[chapterMatch[2]] ?? chapterMatch[2]}`
  }

  return ""
}

function formatSchemaValidationMessage(message: string) {
  const requiredMatch = message.match(/([a-zA-Z0-9_.[\]]+) is required/)
  if (requiredMatch) {
    const label = getHumanFieldName(requiredMatch[1])
    return label ? `${label}为必填项，请补充后再保存。` : "还有必填项未填写，请补充后再保存。"
  }

  if (message.includes("must be one of")) {
    return "有字段填写格式不正确，请检查后再保存。"
  }

  if (message.includes("yaml parse failed")) {
    return "当前剧本内容格式有误，请检查后再保存。"
  }

  return message
}

function extractSchemaRequiredPath(message: string) {
  return message.match(/([a-zA-Z0-9_.[\]]+) is required/)?.[1] ?? null
}

function validateEditableDocument(document: ScriptYamlDocument): ValidationErrors {
  const errors: ValidationErrors = {}

  document.dramatis_personae.forEach((character, index) => {
    if (!character.name.trim()) {
      errors[`dramatis_personae[${index}].name`] = "请输入角色名"
    }
    if (!character.archetype.trim()) {
      errors[`dramatis_personae[${index}].archetype`] = "请输入角色类型"
    }
    if (!character.motivation.trim()) {
      errors[`dramatis_personae[${index}].motivation`] = "请输入角色动机"
    }
    if (!character.first_appearance.trim()) {
      errors[`dramatis_personae[${index}].first_appearance`] = "请输入首次出现"
    }
  })

  document.settings.forEach((setting, index) => {
    if (!setting.name.trim()) {
      errors[`settings[${index}].name`] = "请输入地点名"
    }
    if (!setting.description.trim()) {
      errors[`settings[${index}].description`] = "请输入地点描述"
    }
    if (!setting.importance.trim()) {
      errors[`settings[${index}].importance`] = "请选择重要程度"
    }
  })

  document.chapters.forEach((chapter, chapterIndex) => {
    if (!chapter.title.trim()) {
      errors[`chapters[${chapterIndex}].title`] = "请输入章节标题"
    }
    if (!chapter.summary.trim()) {
      errors[`chapters[${chapterIndex}].summary`] = "请输入章节梗概"
    }

    chapter.scenes.forEach((scene, sceneIndex) => {
      if (!scene.title.trim()) {
        errors[`chapters[${chapterIndex}].scenes[${sceneIndex}].title`] = "请输入场景标题"
      }
      if (!scene.goal.trim()) {
        errors[`chapters[${chapterIndex}].scenes[${sceneIndex}].goal`] = "请输入场景目标"
      }
      if (!scene.location.trim()) {
        errors[`chapters[${chapterIndex}].scenes[${sceneIndex}].location`] = "请选择场景地点"
      }
      if (!scene.time.trim()) {
        errors[`chapters[${chapterIndex}].scenes[${sceneIndex}].time`] = "请输入场景时间"
      }
      if (!scene.pov.trim()) {
        errors[`chapters[${chapterIndex}].scenes[${sceneIndex}].pov`] = "请选择视角角色"
      }
      if (!scene.mood.trim()) {
        errors[`chapters[${chapterIndex}].scenes[${sceneIndex}].mood`] = "请输入场景氛围"
      }
      if (!scene.outcome.trim()) {
        errors[`chapters[${chapterIndex}].scenes[${sceneIndex}].outcome`] = "请输入场景收尾"
      }

      scene.beats.forEach((beat, beatIndex) => {
        if (!beat.summary.trim()) {
          errors[`chapters[${chapterIndex}].scenes[${sceneIndex}].beats[${beatIndex}].summary`] =
            "请输入节拍摘要"
        }
        if (!beat.type.trim()) {
          errors[`chapters[${chapterIndex}].scenes[${sceneIndex}].beats[${beatIndex}].type`] =
            "请选择节拍类型"
        }

        if (beat.type === "dialogue" || beat.type === "inner") {
          if (!beat.dialogue?.speaker.trim()) {
            errors[
              `chapters[${chapterIndex}].scenes[${sceneIndex}].beats[${beatIndex}].dialogue.speaker`
            ] = "请选择对白角色"
          }
          if (!beat.dialogue?.content.trim()) {
            errors[
              `chapters[${chapterIndex}].scenes[${sceneIndex}].beats[${beatIndex}].dialogue.content`
            ] = "请输入对白内容"
          }
        }
      })
    })
  })

  return errors
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
  const [isSaving, setIsSaving] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [statusFilters, setStatusFilters] = useState<ScriptTaskStatus[]>([])
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [feedback, setFeedback] = useState("")
  const [history, setHistory] = useState<ScriptHistoryItem[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [activeResult, setActiveResult] = useState<WorkshopResult | null>(null)
  const [activeTaskMeta, setActiveTaskMeta] = useState<ScriptTaskMeta | null>(null)
  const [taskProgressMessage, setTaskProgressMessage] = useState("")
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
  const statusMenuRef = useRef<HTMLDivElement | null>(null)
  const characterRenameOriginRef = useRef<Record<number, string>>({})
  const settingRenameOriginRef = useRef<Record<number, string>>({})
  const taskEventSourceRef = useRef<{ taskId: string; source: EventSource } | null>(null)
  const loadDetailByIdRef = useRef<(taskId: string) => Promise<void>>(async () => {})

  useEffect(() => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
  }, [draft])

  useEffect(() => {
    return () => {
      taskEventSourceRef.current?.source.close()
      taskEventSourceRef.current = null
    }
  }, [])

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
    if (!showGenerationOverlay) {
      return
    }

    const timer = window.setTimeout(() => {
      setShowGenerationOverlay(false)
    }, 900)

    return () => window.clearTimeout(timer)
  }, [showGenerationOverlay])

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

  function closeTaskEventStream(taskId?: string) {
    if (!taskEventSourceRef.current) {
      return
    }
    if (taskId && taskEventSourceRef.current.taskId !== taskId) {
      return
    }
    taskEventSourceRef.current.source.close()
    taskEventSourceRef.current = null
  }

  function upsertHistoryTask(
    taskId: string,
    patch: Partial<ScriptHistoryItem> & Pick<ScriptHistoryItem, "status">
  ) {
    setHistory((current) => {
      const index = current.findIndex((item) => item.id === taskId)
      if (index === -1) {
        return current
      }
      const next = [...current]
      next[index] = {
        ...next[index],
        ...patch,
      }
      return next
    })
  }

  async function handleTaskEvent(taskId: string, event: ScriptTaskEvent) {
      setGenerationStepText(getGenerationStepText(event.stage, event.message))
      setTaskProgressMessage(event.message || "")
      setActiveTaskMeta((current) =>
        current && current.id === taskId
          ? {
              ...current,
              status: event.status,
              err_msg: event.error || current.err_msg,
              updated_at: event.timestamp || current.updated_at,
            }
          : current
      )
      upsertHistoryTask(taskId, {
        status: event.status,
        err_msg: event.error,
        updated_at: event.timestamp || new Date().toISOString(),
      })

      if (event.status === "succeeded") {
        closeTaskEventStream(taskId)
        setIsSubmitting(false)
        setShowGenerationOverlay(false)
        setGenerationStepIndex(0)
        setGenerationStepText(GENERATION_STEPS[0])
        setTaskProgressMessage("")
        await loadDetailById(taskId, "第一版剧本已生成完成，你可以继续审阅结构和编辑 YAML。")
        await loadHistory()
        return
      }

      if (event.status === "failed") {
        closeTaskEventStream(taskId)
        setIsSubmitting(false)
        setShowGenerationOverlay(false)
        setGenerationStepIndex(0)
        setGenerationStepText(GENERATION_STEPS[0])
        setTaskProgressMessage(event.error || event.message || "任务执行失败。")
        setError(event.error || event.message || "生成失败，请稍后重试。")
        await loadDetailById(taskId)
        await loadHistory()
      }
    }

  function startTaskEventStream(taskId: string, eventUrl: string) {
      if (taskEventSourceRef.current?.taskId === taskId) {
        return
      }

      closeTaskEventStream()

      const eventSource = openScriptEventStream(
        eventUrl,
        (event) => {
          void handleTaskEvent(taskId, event)
        },
        () => {
          // Native EventSource auto-reconnects. Keep the UI in submitting state
          // and only surface an error if the task is not already terminal.
          setTaskProgressMessage((current) =>
            current || "状态流短暂断开，正在尝试自动重连。"
          )
        }
      )

      taskEventSourceRef.current = {
        taskId,
        source: eventSource,
      }
    }

  async function loadDetailById(taskId: string, successMessage?: string) {
    setSelectedTaskId(taskId)
    setError("")
    if (!successMessage) {
      setFeedback("")
    }

    try {
      const response = await getScriptDetail(taskId)
      if (response.code !== 0 || !response.data) {
        setError(response.msg || "历史详情加载失败。")
        return
      }

      const detail = response.data
      setActiveTaskMeta(detail.metadata)
      const result = makeResultFromDetail(detail)
      if (result) {
        setResultForEditing(result)
        closeTaskEventStream(taskId)
        setIsSubmitting(false)
        setTaskProgressMessage("")
        setSelectedNodeId(null)
        setSearchParams({ view: "detail", id: taskId })
        setView("overview")
        if (successMessage) {
          setFeedback(successMessage)
        }
      } else {
        setResultForEditing(null)
        setSearchParams({ view: "detail", id: taskId })
        if (detail.metadata.status === "pending" || detail.metadata.status === "running") {
          setTaskProgressMessage("任务仍在处理中，正在同步后台进度。")
          setGenerationStepText(getGenerationStepText(detail.metadata.status, taskProgressMessage))
          setIsSubmitting(true)
          setShowGenerationOverlay(false)
          startTaskEventStream(taskId, `/api/v1/script/${taskId}/events`)
        } else {
          setTaskProgressMessage(detail.metadata.err_msg || "")
        }
      }
    } catch (err) {
      setError(extractErrorMessage(err, "历史详情加载失败。"))
    }
  }

  loadDetailByIdRef.current = async (taskId: string) => {
    await loadDetailById(taskId)
  }

  useEffect(() => {
    const taskIdFromQuery = searchParams.get("id")
    const viewFromQuery = searchParams.get("view")

    if (viewFromQuery !== "detail" || !taskIdFromQuery) {
      return
    }

    if (
      selectedTaskId === taskIdFromQuery &&
      (activeResult?.id === taskIdFromQuery || activeTaskMeta?.id === taskIdFromQuery)
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      void loadDetailByIdRef.current(taskIdFromQuery)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [searchParams, selectedTaskId, activeResult?.id, activeTaskMeta?.id])

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
    setActiveTaskMeta(result?.metadata ?? null)
    setEditableDocument(result ? parseScriptYaml(result.yaml) : null)
    setRegistryTab("characters")
    setSelectedCharacterIndex(0)
    setSelectedSettingIndex(0)
    setShowValidationErrors(false)
    setRenameConfirm(null)
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
    setShowGenerationOverlay(true)
    try {
      const response = await convertScript({
        ...draft,
        chapters: trimmedChapters,
      })

      if (response.code !== 0 || !response.data) {
        setError(response.msg || "生成失败，请稍后重试。")
        return
      }

      const now = new Date().toISOString()
      const taskMeta: ScriptTaskMeta = {
        id: response.data.id,
        title: trimmedChapters[0]?.title || "未命名剧本",
        genre: draft.genre,
        tone: draft.tone,
        pacing: draft.pacing,
        source_chapters: trimmedChapters.length,
        status: response.data.status,
        created_at: now,
        updated_at: now,
      }

      setResultForEditing(null)
      setActiveTaskMeta(taskMeta)
      setTaskProgressMessage("任务已提交，正在连接后台进度。")
      setGenerationStepText(getGenerationStepText(response.data.status, "任务已提交，正在连接后台进度。"))
      setSelectedTaskId(response.data.id)
      setSelectedNodeId(null)
      setSearchParams({ view: "detail", id: response.data.id })
      setView("overview")
      await loadHistory()
      startTaskEventStream(response.data.id, response.data.event_url)
    } catch (err) {
      setError(extractErrorMessage(err, "生成失败，请检查服务状态后重试。"))
    } finally {
      if (!taskEventSourceRef.current) {
        setIsSubmitting(false)
        setShowGenerationOverlay(false)
        setGenerationStepIndex(0)
        setGenerationStepText(GENERATION_STEPS[0])
      }
    }
  }

  async function handleLoadHistory(item: ScriptHistoryItem) {
    await loadDetailById(item.id, `已载入「${item.title}」的结果，你可以继续审阅结构。`)
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

    setError("")
    setFeedback("")
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
  const liveYaml = useMemo(
    () => (editableDocument ? serializeScriptYaml(editableDocument) : activeResult?.yaml ?? ""),
    [editableDocument, activeResult?.yaml]
  )
  const savedYamlBaseline = useMemo(() => {
    if (!activeResult?.yaml) {
      return ""
    }

    const parsed = parseScriptYaml(activeResult.yaml)
    return parsed ? serializeScriptYaml(parsed) : activeResult.yaml
  }, [activeResult?.yaml])
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
  const validationErrors = useMemo(
    () => (editableDocument ? validateEditableDocument(editableDocument) : {}),
    [editableDocument]
  )
  const getFieldError = useCallback(
    (path: string) => (showValidationErrors ? validationErrors[path] : undefined),
    [showValidationErrors, validationErrors]
  )
  const getFieldClassName = useCallback(
    (path: string, baseClassName: string) =>
      cn(
        baseClassName,
        getFieldError(path) &&
          "border-rose-300 bg-rose-50/50 text-slate-900 focus:border-rose-300 focus:ring-rose-100"
      ),
    [getFieldError]
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
            footerLabel={activeStatus.label}
            onLogoClick={() => navigate("/")}
            authActionLabel="登出"
            onAuthAction={handleLogout}
            items={[
              { key: "workspace", label: "工作台", icon: Wand2, onClick: () => setSearchParams({ view: "workspace" }) },
              { key: "history", label: "列表", icon: History, onClick: () => setSearchParams({ view: "history" }) },
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
                  title="开始输入你的小说章节"
                  description="主输入区负责内容，右侧参数区负责改编风格，避免所有控件挤在同一层。"
                  className="overflow-hidden rounded-[34px] border-black/6 bg-white/92 shadow-[0_24px_80px_rgba(15,23,42,0.08)]"
                >
                  <form className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]" onSubmit={handleSubmit}>
                    <div className="space-y-5">
                      <div className="rounded-[28px] border border-black/6 bg-slate-50/80 p-4 sm:p-5">
                        <div className="flex flex-col gap-4 border-b border-black/6 pb-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                                当前输入
                              </p>
                              <p className="mt-1 text-base font-semibold text-slate-900">
                                第 {activeChapterIndex + 1} 章
                              </p>
                            </div>
                            <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-xs text-slate-500">
                              共 {draft.chapters.length} 章
                            </span>
                          </div>
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
                              className="rounded-full border border-dashed border-black/10 bg-white px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
                            >
                              + 新增章节
                            </button>
                          </div>
                        </div>

                        <div className="mt-5 space-y-4">
                          <Input
                            value={activeChapter?.title ?? ""}
                            onChange={(event) =>
                              updateChapter(activeChapterIndex, "title", event.target.value)
                            }
                            placeholder="给这一章起一个更容易理解的标题"
                            className="h-12 rounded-2xl border-black/8 bg-white text-base text-slate-900 placeholder:text-slate-400"
                          />

                          <textarea
                            value={activeChapter?.text ?? ""}
                            onChange={(event) =>
                              updateChapter(activeChapterIndex, "text", event.target.value)
                            }
                            placeholder="把这一章的小说正文粘贴到这里，尽量保持段落清晰。AI 会基于这些内容生成章节、场景和节拍结构。"
                            className="min-h-[420px] w-full rounded-[26px] border border-black/8 bg-white px-5 py-5 text-[15px] leading-8 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-200 focus:ring-3 focus:ring-sky-100"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {[
                          "至少 3 章",
                          "自动生成 YAML",
                          "自动一致性质检",
                          "历史结果可回载",
                        ].map((item) => (
                          <span
                            key={item}
                            className="rounded-full border border-black/8 bg-white px-3 py-1 text-xs text-slate-500"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4 xl:sticky xl:top-8 xl:self-start">
                      <div className="rounded-[28px] border border-black/6 bg-slate-50/80 p-5">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                          改编设定
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">
                          先定风格，再开始生成
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          这些参数不需要很多，但会明显影响第一版剧本的气质和节奏。
                        </p>

                        <div className="mt-5 space-y-5">
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
                      </div>

                      <div className="rounded-[28px] bg-slate-950 p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
                        <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                          生成动作
                        </p>
                        <p className="mt-2 text-lg font-semibold">准备把这几章转成剧本</p>
                        <p className="mt-2 text-sm leading-6 text-white/68">
                          当前会基于 {draft.chapters.length} 章内容，按照「{draft.genre} / {draft.tone} /{" "}
                          {draft.pacing === "fast"
                            ? "快节奏"
                            : draft.pacing === "medium"
                              ? "中节奏"
                              : "慢节奏"}
                          」生成第一版结构化剧本。
                        </p>
                        <div className="mt-5 flex flex-col gap-3">
                          <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="h-12 rounded-2xl bg-white text-slate-950 hover:bg-slate-100"
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
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setDraft(createDefaultDraft())
                              setActiveChapterIndex(0)
                              setFeedback("草稿已重置。")
                            }}
                            className="h-11 rounded-2xl border-white/12 bg-white/6 text-white hover:bg-white/10 hover:text-white"
                          >
                            重置草稿
                          </Button>
                        </div>
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
                    title={activeTaskMeta ? activeTaskMeta.title || "任务详情" : "详情预览"}
                    description={
                      activeTaskMeta
                        ? "任务状态会实时同步，完成后会自动载入最终 YAML 与结构结果。"
                        : "先在工作台生成剧本，或从生成列表中点开一个历史结果。"
                    }
                    className="rounded-[30px] border-black/6 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
                  >
                    {activeTaskMeta ? (
                      <div className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                          {[
                            { label: "状态", value: activeStatus.label },
                            { label: "体裁", value: activeTaskMeta.genre },
                            { label: "语气", value: activeTaskMeta.tone },
                            { label: "节奏", value: activeTaskMeta.pacing },
                            { label: "章节", value: `${activeTaskMeta.source_chapters} 章` },
                          ].map((item) => (
                            <div
                              key={item.label}
                              className="rounded-[22px] border border-black/6 bg-slate-50 px-4 py-4"
                            >
                              <p className="text-xs text-slate-400">{item.label}</p>
                              <p className="mt-2 text-lg font-semibold text-slate-900">
                                {item.value}
                              </p>
                            </div>
                          ))}
                        </div>
                        <div className="rounded-[24px] border border-black/6 bg-slate-50 p-5">
                          <p className="text-xs text-slate-400">当前进度</p>
                          <p className="mt-3 text-sm leading-7 text-slate-600">
                            {taskProgressMessage ||
                              (activeTaskMeta.status === "failed"
                                ? activeTaskMeta.err_msg || "任务执行失败，请稍后重试。"
                                : "任务仍在处理中，已连接后台状态流，请稍候。")}
                          </p>
                          <p className="mt-4 text-sm text-slate-400">
                            最近更新：{formatDateTime(activeTaskMeta.updated_at)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-[24px] border border-dashed border-black/8 px-4 py-16 text-center">
                        <p className="text-lg font-medium text-slate-800">还没有可展示的详情</p>
                        <p className="mt-2 text-sm text-slate-400">
                          你可以前往工作台生成，或者打开左侧“列表”选择一个已生成结果。
                        </p>
                      </div>
                    )}
                  </StudioPanel>
                ) : (
                  <>
                    <ScriptDetailHeader
                      title={activeResult.metadata.title}
                      hasUnsavedChanges={hasUnsavedChanges}
                      view={view}
                      onViewChange={setView}
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
                                  正文用了但人物表没登记：{consistency.rolesMissing.length}
                                </div>
                                <div className="rounded-2xl bg-white px-4 py-3 text-slate-600">
                                  场景用了但地点表没登记：{consistency.settingsMissing.length}
                                </div>
                                <div className="rounded-2xl bg-white px-4 py-3 text-slate-600">
                                  已登记但当前未使用：{consistency.danglingRefs.length}
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
                                        className={getFieldClassName(
                                          `chapters[${selectedNode.chapterIndex}].title`,
                                          "h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                        )}
                                      />
                                      <ValidationMessage
                                        message={getFieldError(`chapters[${selectedNode.chapterIndex}].title`)}
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
                                        className={getFieldClassName(
                                          `chapters[${selectedNode.chapterIndex}].summary`,
                                          "min-h-[180px] w-full rounded-[24px] border border-black/8 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                        )}
                                      />
                                      <ValidationMessage
                                        message={getFieldError(`chapters[${selectedNode.chapterIndex}].summary`)}
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
                                          className={getFieldClassName(
                                            `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].title`,
                                            "h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                          )}
                                        />
                                        <ValidationMessage
                                          message={getFieldError(
                                            `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].title`
                                          )}
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
                                          className={getFieldClassName(
                                            `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].location`,
                                            "h-11 w-full rounded-2xl border border-black/8 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                          )}
                                        >
                                          <option value="">请选择地点</option>
                                          {currentLocationOptions.map((item) => (
                                            <option key={item} value={item}>
                                              {settingNames.includes(item) ? item : `${item}（未注册）`}
                                            </option>
                                          ))}
                                        </select>
                                        <ValidationMessage
                                          message={getFieldError(
                                            `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].location`
                                          )}
                                        />
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
                                          className={getFieldClassName(
                                            `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].time`,
                                            "h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                          )}
                                        />
                                        <ValidationMessage
                                          message={getFieldError(
                                            `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].time`
                                          )}
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
                                          className={getFieldClassName(
                                            `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].pov`,
                                            "h-11 w-full rounded-2xl border border-black/8 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                          )}
                                        >
                                          <option value="">请选择角色</option>
                                          {currentPovOptions.map((item) => (
                                            <option key={item} value={item}>
                                              {characterNames.includes(item) ? item : `${item}（未注册）`}
                                            </option>
                                          ))}
                                        </select>
                                        <ValidationMessage
                                          message={getFieldError(
                                            `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].pov`
                                          )}
                                        />
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
                                        className={getFieldClassName(
                                          `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].goal`,
                                          "min-h-[120px] w-full rounded-[24px] border border-black/8 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                        )}
                                      />
                                      <ValidationMessage
                                        message={getFieldError(
                                          `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].goal`
                                        )}
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
                                          className={getFieldClassName(
                                            `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].mood`,
                                            "h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                          )}
                                        />
                                        <ValidationMessage
                                          message={getFieldError(
                                            `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].mood`
                                          )}
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
                                        className={getFieldClassName(
                                          `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].outcome`,
                                          "min-h-[120px] w-full rounded-[24px] border border-black/8 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                        )}
                                      />
                                      <ValidationMessage
                                        message={getFieldError(
                                          `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].outcome`
                                        )}
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
                                        className={getFieldClassName(
                                          `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].beats[${selectedNode.beatIndex ?? 0}].summary`,
                                          "h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                        )}
                                      />
                                      <ValidationMessage
                                        message={getFieldError(
                                          `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].beats[${selectedNode.beatIndex ?? 0}].summary`
                                        )}
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
                                            className={getFieldClassName(
                                              `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].beats[${selectedNode.beatIndex ?? 0}].dialogue.speaker`,
                                              "h-11 w-full rounded-2xl border border-black/8 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                            )}
                                          >
                                            <option value="">请选择角色</option>
                                            {currentSpeakerOptions.map((item) => (
                                              <option key={item} value={item}>
                                                {characterNames.includes(item) ? item : `${item}（未注册）`}
                                              </option>
                                            ))}
                                          </select>
                                          <ValidationMessage
                                            message={getFieldError(
                                              `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].beats[${selectedNode.beatIndex ?? 0}].dialogue.speaker`
                                            )}
                                          />
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
                                          className={getFieldClassName(
                                            `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].beats[${selectedNode.beatIndex ?? 0}].dialogue.content`,
                                            "min-h-[160px] w-full rounded-[24px] border border-black/8 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                          )}
                                        />
                                        <ValidationMessage
                                          message={getFieldError(
                                            `chapters[${selectedNode.chapterIndex}].scenes[${selectedNode.sceneIndex ?? 0}].beats[${selectedNode.beatIndex ?? 0}].dialogue.content`
                                          )}
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
                    </ScriptDetailHeader>

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
                        <div className="space-y-5">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2 rounded-full border border-black/6 bg-slate-50 p-1">
                              {([
                                {
                                  key: "characters",
                                  label: "人物",
                                  count: editableDocument.dramatis_personae.length,
                                },
                                {
                                  key: "settings",
                                  label: "地点",
                                  count: editableDocument.settings.length,
                                },
                              ] as const).map((item) => (
                                <button
                                  key={item.key}
                                  type="button"
                                  onClick={() => setRegistryTab(item.key)}
                                  className={cn(
                                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors",
                                    registryView === item.key
                                      ? "bg-slate-900 text-white"
                                      : "text-slate-500 hover:bg-white hover:text-slate-900"
                                  )}
                                >
                                  <span>{item.label}</span>
                                  <span
                                    className={cn(
                                      "rounded-full px-2 py-0.5 text-xs",
                                      registryView === item.key
                                        ? "bg-white/15 text-white"
                                        : "bg-white text-slate-400"
                                    )}
                                  >
                                    {item.count}
                                  </span>
                                </button>
                              ))}
                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={registryView === "characters" ? addCharacter : addSetting}
                              className="border-black/8 bg-white text-slate-700 hover:bg-slate-50"
                            >
                              {registryView === "characters" ? "新增角色" : "新增地点"}
                            </Button>
                          </div>

                          <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
                            <div className="rounded-[24px] border border-black/6 bg-slate-50 p-3">
                              <div className="max-h-[560px] space-y-2 overflow-y-auto">
                                {registryView === "characters"
                                  ? editableDocument.dramatis_personae.map((character, index) => (
                                      <button
                                        key={`character-item-${index}`}
                                        type="button"
                                        onClick={() => setSelectedCharacterIndex(index)}
                                        className={cn(
                                          "w-full rounded-[20px] border px-4 py-4 text-left transition-colors",
                                          activeRegistryIndex === index
                                            ? "border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
                                            : "border-transparent bg-transparent hover:border-black/6 hover:bg-white/80"
                                        )}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-slate-900">
                                              {character.name || `角色 ${index + 1}`}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-400">
                                              {character.archetype || "未设置角色类型"}
                                            </p>
                                          </div>
                                          <span className="rounded-full border border-black/6 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
                                            {character.first_appearance || "待补充"}
                                          </span>
                                        </div>
                                        <p className="mt-3 line-clamp-2 text-xs leading-6 text-slate-500">
                                          {character.motivation || "还没有填写角色动机。"}
                                        </p>
                                      </button>
                                    ))
                                  : editableDocument.settings.map((setting, index) => (
                                      <button
                                        key={`setting-item-${index}`}
                                        type="button"
                                        onClick={() => setSelectedSettingIndex(index)}
                                        className={cn(
                                          "w-full rounded-[20px] border px-4 py-4 text-left transition-colors",
                                          activeRegistryIndex === index
                                            ? "border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
                                            : "border-transparent bg-transparent hover:border-black/6 hover:bg-white/80"
                                        )}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-slate-900">
                                              {setting.name || `地点 ${index + 1}`}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-400">
                                              {setting.description || "还没有填写地点描述。"}
                                            </p>
                                          </div>
                                          <span className="rounded-full border border-black/6 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
                                            {setting.importance}
                                          </span>
                                        </div>
                                      </button>
                                    ))}
                              </div>
                            </div>

                            <div className="rounded-[24px] border border-black/6 bg-slate-50 p-5">
                              {registryView === "characters" ? (
                                selectedCharacter ? (
                                  <div className="space-y-5">
                                    <div className="rounded-[20px] bg-white px-4 py-4">
                                      <div className="flex items-start justify-between gap-4">
                                        <div>
                                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                            人物编辑
                                          </p>
                                          <h3 className="mt-2 text-lg font-semibold text-slate-900">
                                            {selectedCharacter.name || `角色 ${activeRegistryIndex + 1}`}
                                          </h3>
                                          <p className="mt-2 text-sm leading-6 text-slate-500">
                                            这里维护角色注册表，改名时会先确认是否同步更新视角角色、对白说话人和命中的正文文本。
                                          </p>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => deleteCharacter(activeRegistryIndex)}
                                          className="border-rose-200 bg-white text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          删除
                                        </Button>
                                      </div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                      <div className="space-y-2">
                                        <Label className="text-slate-600">角色名</Label>
                                        <Input
                                          value={selectedCharacter.name}
                                          onFocus={() => {
                                            characterRenameOriginRef.current[activeRegistryIndex] =
                                              selectedCharacter.name
                                          }}
                                          onChange={(event) =>
                                            updateScriptCharacter(activeRegistryIndex, (item) => ({
                                              ...item,
                                              name: event.target.value,
                                            }))
                                          }
                                          onBlur={(event) => {
                                            const previousName =
                                              characterRenameOriginRef.current[activeRegistryIndex] ??
                                              selectedCharacter.name
                                            requestRenameConfirm("characters", previousName, event.target.value)
                                            delete characterRenameOriginRef.current[activeRegistryIndex]
                                          }}
                                          placeholder="请输入角色名"
                                          className={getFieldClassName(
                                            `dramatis_personae[${activeRegistryIndex}].name`,
                                            "h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                          )}
                                        />
                                        <ValidationMessage
                                          message={getFieldError(`dramatis_personae[${activeRegistryIndex}].name`)}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-slate-600">角色类型</Label>
                                        <Input
                                          value={selectedCharacter.archetype}
                                          onChange={(event) =>
                                            updateScriptCharacter(activeRegistryIndex, (item) => ({
                                              ...item,
                                              archetype: event.target.value,
                                            }))
                                          }
                                          placeholder="主角 / 配角 / 反派"
                                          className={getFieldClassName(
                                            `dramatis_personae[${activeRegistryIndex}].archetype`,
                                            "h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                          )}
                                        />
                                        <ValidationMessage
                                          message={getFieldError(
                                            `dramatis_personae[${activeRegistryIndex}].archetype`
                                          )}
                                        />
                                      </div>
                                    </div>

                                    <div className="space-y-2">
                                      <Label className="text-slate-600">动机</Label>
                                      <textarea
                                        value={selectedCharacter.motivation}
                                        onChange={(event) =>
                                          updateScriptCharacter(activeRegistryIndex, (item) => ({
                                            ...item,
                                            motivation: event.target.value,
                                          }))
                                        }
                                        placeholder="写下角色核心行动动机"
                                        className={getFieldClassName(
                                          `dramatis_personae[${activeRegistryIndex}].motivation`,
                                          "min-h-[120px] w-full rounded-[24px] border border-black/8 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                        )}
                                      />
                                      <ValidationMessage
                                        message={getFieldError(
                                          `dramatis_personae[${activeRegistryIndex}].motivation`
                                        )}
                                      />
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                      <div className="space-y-2">
                                        <Label className="text-slate-600">性格标签</Label>
                                        <Input
                                          value={selectedCharacter.traits.join("，")}
                                          onChange={(event) =>
                                            updateScriptCharacter(activeRegistryIndex, (item) => ({
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
                                          value={selectedCharacter.first_appearance}
                                          onChange={(event) =>
                                            updateScriptCharacter(activeRegistryIndex, (item) => ({
                                              ...item,
                                              first_appearance: event.target.value,
                                            }))
                                          }
                                          placeholder="Chapter 1"
                                          className={getFieldClassName(
                                            `dramatis_personae[${activeRegistryIndex}].first_appearance`,
                                            "h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                          )}
                                        />
                                        <ValidationMessage
                                          message={getFieldError(
                                            `dramatis_personae[${activeRegistryIndex}].first_appearance`
                                          )}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="rounded-[20px] border border-dashed border-black/8 bg-white px-4 py-12 text-center text-sm text-slate-400">
                                    当前还没有角色，点击左上角“新增角色”开始维护。
                                  </div>
                                )
                              ) : selectedSetting ? (
                                <div className="space-y-5">
                                  <div className="rounded-[20px] bg-white px-4 py-4">
                                    <div className="flex items-start justify-between gap-4">
                                      <div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                          地点编辑
                                        </p>
                                        <h3 className="mt-2 text-lg font-semibold text-slate-900">
                                          {selectedSetting.name || `地点 ${activeRegistryIndex + 1}`}
                                        </h3>
                                        <p className="mt-2 text-sm leading-6 text-slate-500">
                                          这里维护地点注册表，改名时会先确认是否同步更新场景地点引用和命中的正文文本。
                                        </p>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => deleteSetting(activeRegistryIndex)}
                                        className="border-rose-200 bg-white text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        删除
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                      <Label className="text-slate-600">地点名</Label>
                                      <Input
                                        value={selectedSetting.name}
                                        onFocus={() => {
                                          settingRenameOriginRef.current[activeRegistryIndex] =
                                            selectedSetting.name
                                        }}
                                        onChange={(event) =>
                                          updateScriptSetting(activeRegistryIndex, (item) => ({
                                            ...item,
                                            name: event.target.value,
                                          }))
                                        }
                                        onBlur={(event) => {
                                          const previousName =
                                            settingRenameOriginRef.current[activeRegistryIndex] ??
                                            selectedSetting.name
                                          requestRenameConfirm("settings", previousName, event.target.value)
                                          delete settingRenameOriginRef.current[activeRegistryIndex]
                                        }}
                                        placeholder="请输入地点名"
                                        className={getFieldClassName(
                                          `settings[${activeRegistryIndex}].name`,
                                          "h-11 rounded-2xl border-black/8 bg-white text-slate-900"
                                        )}
                                      />
                                      <ValidationMessage
                                        message={getFieldError(`settings[${activeRegistryIndex}].name`)}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-slate-600">重要程度</Label>
                                      <select
                                        value={selectedSetting.importance}
                                        onChange={(event) =>
                                          updateScriptSetting(activeRegistryIndex, (item) => ({
                                            ...item,
                                            importance: event.target.value,
                                          }))
                                        }
                                        className={getFieldClassName(
                                          `settings[${activeRegistryIndex}].importance`,
                                          "h-11 w-full rounded-2xl border border-black/8 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                        )}
                                      >
                                        <option value="high">high</option>
                                        <option value="medium">medium</option>
                                        <option value="low">low</option>
                                      </select>
                                      <ValidationMessage
                                        message={getFieldError(`settings[${activeRegistryIndex}].importance`)}
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <Label className="text-slate-600">地点描述</Label>
                                    <textarea
                                      value={selectedSetting.description}
                                      onChange={(event) =>
                                        updateScriptSetting(activeRegistryIndex, (item) => ({
                                          ...item,
                                          description: event.target.value,
                                        }))
                                      }
                                      placeholder="描述环境、氛围和重要细节"
                                      className={getFieldClassName(
                                        `settings[${activeRegistryIndex}].description`,
                                        "min-h-[180px] w-full rounded-[24px] border border-black/8 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-3 focus:ring-sky-100"
                                      )}
                                    />
                                    <ValidationMessage
                                      message={getFieldError(`settings[${activeRegistryIndex}].description`)}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="rounded-[20px] border border-dashed border-black/8 bg-white px-4 py-12 text-center text-sm text-slate-400">
                                  当前还没有地点，点击左上角“新增地点”开始维护。
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </StudioPanel>

                    <ConsistencyPanel consistency={consistency} />
                  </>
                )}
              </div>
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
