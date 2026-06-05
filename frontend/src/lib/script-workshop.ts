import type {
  ScriptChapterInput,
  ScriptConvertRequest,
  ScriptDetailResponse,
  ScriptHistoryItem,
  ScriptSummary,
  ScriptTaskMeta,
  ScriptYamlDocument,
} from "@/types"
import { normalizeConsistency } from "@/lib/script-yaml"

export type Pacing = ScriptConvertRequest["pacing"]

export type ScriptTreeNode = {
  id: string
  label: string
  description: string
  kind: "chapter" | "scene" | "beat"
  chapterIndex: number
  sceneIndex?: number
  beatIndex?: number
  children: ScriptTreeNode[]
}

export type WorkshopResult = {
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

export type ResultView = "overview" | "yaml" | "structure"
export type SidebarView = "workspace" | "history" | "detail"
export type ScriptTaskStatus = "pending" | "running" | "succeeded" | "failed"
export type RegistryTab = "characters" | "settings"
export type WorkspaceInputMode = "chapter" | "import"
export type ChapterCompletionState = "empty" | "partial" | "ready"
export type ValidationErrors = Record<string, string>
export type RenameConfirmState = {
  kind: RegistryTab
  previousName: string
  nextName: string
} | null

export type ImportedChapterDraft = ScriptChapterInput

export const DRAFT_STORAGE_KEY = "script-workshop-draft"

export const GENRE_OPTIONS = ["悬疑", "言情", "科幻", "现实主义", "奇幻", "其他"]
export const TONE_OPTIONS = ["压抑", "轻松", "热血", "温暖", "冷峻", "诗意"]
export const PACING_OPTIONS: Array<{ label: string; value: Pacing; hint: string }> = [
  { label: "快节奏", value: "fast", hint: "适合悬疑、冒险与事件驱动" },
  { label: "中节奏", value: "medium", hint: "兼顾推进、情绪和角色刻画" },
  { label: "慢节奏", value: "slow", hint: "更强调氛围、心理和留白" },
]

export const DEFAULT_CHAPTERS: ScriptChapterInput[] = [
  { title: "第一章", text: "" },
  { title: "第二章", text: "" },
  { title: "第三章", text: "" },
]

export const GENERATION_STEPS = [
  "正在整理章节内容与改编指令",
  "正在生成角色、场景与节拍结构",
  "正在校验 YAML 并准备一致性质检",
]

export const STATUS_FILTER_OPTIONS: Array<{ value: ScriptTaskStatus; label: string }> = [
  { value: "succeeded", label: "已完成" },
  { value: "failed", label: "失败" },
  { value: "running", label: "生成中" },
  { value: "pending", label: "等待中" },
]

export const WORKSPACE_DRAFT_FORM_ID = "script-workshop-draft-form"

export function buildSemanticTree(document: ScriptYamlDocument | null): ScriptTreeNode[] {
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

export function findTreeNodeByID(nodes: ScriptTreeNode[], id: string | null): ScriptTreeNode | null {
  if (!id) return null
  for (const node of nodes) {
    if (node.id === id) return node
    const childMatch = findTreeNodeByID(node.children, id)
    if (childMatch) return childMatch
  }
  return null
}

export function formatDateTime(value?: string) {
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

export function replaceLiteralText(source: string, from: string, to: string) {
  if (!from || from === to || !source.includes(from)) {
    return source
  }
  return source.split(from).join(to)
}

export function getChapterCompletionState(chapter: ScriptChapterInput): ChapterCompletionState {
  const hasTitle = chapter.title.trim().length > 0
  const hasText = chapter.text.trim().length > 0
  if (hasTitle && hasText) {
    return "ready"
  }
  if (hasTitle || hasText) {
    return "partial"
  }
  return "empty"
}

export function getTextCount(text: string) {
  return text.trim().replace(/\s+/g, "").length
}

export function formatTextCount(count: number) {
  return `${count.toLocaleString("zh-CN")} 字`
}

export function createDefaultDraft(): ScriptConvertRequest {
  return {
    chapters: DEFAULT_CHAPTERS,
    genre: GENRE_OPTIONS[0],
    tone: TONE_OPTIONS[0],
    pacing: "medium",
  }
}

export function makeResultFromDetail(detail: ScriptDetailResponse): WorkshopResult | null {
  if (!detail.yaml) return null
  return {
    id: detail.id,
    yaml: detail.yaml,
    summary: detail.summary,
    consistencyReport: normalizeConsistency(detail.consistency_report),
    metadata: detail.metadata,
  }
}

export function getGenerationStepText(stage?: string, message?: string) {
  if (message) {
    return message
  }

  switch (stage) {
    case "queued":
      return "任务已进入队列，等待后台执行。"
    case "starting":
      return "后台任务已启动，正在准备本次转换。"
    case "summarizing":
      return "原文篇幅较长，正在逐章提炼摘要后再生成剧本。"
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

export function getStatusMeta(status: string) {
  switch (status) {
    case "succeeded":
      return {
        label: "已完成",
        textClass: "text-emerald-600",
      }
    case "failed":
      return {
        label: "生成失败",
        textClass: "text-rose-600",
      }
    case "running":
      return {
        label: "生成中",
        textClass: "text-amber-600",
      }
    default:
      return {
        label: "等待中",
        textClass: "text-slate-500",
      }
  }
}

export function truncateText(value: string, maxLength: number) {
  const trimmed = value.trim()
  if (trimmed.length <= maxLength) {
    return trimmed
  }
  return `${trimmed.slice(0, maxLength).trim()}...`
}

export function getHistoryCardCopy(item: ScriptHistoryItem) {
  if (item.status === "succeeded") {
    return {
      eyebrow: "继续打磨",
      title: "第一版剧本已经生成完成",
      body: "可以继续审阅结构、检查一致性，或直接进入详情编辑。",
      toneClass: "bg-slate-50 text-slate-600",
    }
  }

  if (item.status === "failed") {
    return {
      eyebrow: "需要处理",
      title: "这次生成未能顺利完成",
      body: item.err_msg
        ? truncateText(formatSchemaValidationMessage(item.err_msg), 60)
        : "可以打开详情查看失败原因，调整输入后重新生成。",
      toneClass: "bg-rose-50/80 text-rose-700",
    }
  }

  if (item.status === "running") {
    return {
      eyebrow: "后台处理中",
      title: "AI 正在整理角色、场景与节拍",
      body: "点击卡片即可查看实时进度状态，完成后会自动进入详情结果。",
      toneClass: "bg-amber-50/80 text-amber-700",
    }
  }

  return {
    eyebrow: "已加入队列",
    title: "任务正在等待后台开始执行",
    body: "系统会在空闲 worker 可用后自动开始生成，无需停留在当前页面。",
    toneClass: "bg-slate-50 text-slate-600",
  }
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/yaml;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function extractErrorMessage(error: unknown, fallback: string) {
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

export function getHumanFieldName(path: string) {
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

  const beatMatch = path.match(/^chapters\[(\d+)\]\.scenes\[(\d+)\]\.beats\[(\d+)\]\.(.+)$/)
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

export function formatSchemaValidationMessage(message: string) {
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

export function extractSchemaRequiredPath(message: string) {
  return message.match(/([a-zA-Z0-9_.[\]]+) is required/)?.[1] ?? null
}

export function validateEditableDocument(document: ScriptYamlDocument): ValidationErrors {
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
