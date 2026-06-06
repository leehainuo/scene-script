import type { ScriptChapterInput } from "@/types"
import type { Pacing, ScriptTaskStatus } from "./types"

export const DRAFT_STORAGE_KEY = "script-workshop-draft"
export const MIN_SOURCE_CHAPTERS = 3
export const MAX_SOURCE_CHAPTERS = 12

export const GENRE_OPTIONS = ["悬疑", "言情", "科幻", "现实主义", "奇幻", "其他"]
export const TONE_OPTIONS = ["压抑", "轻松", "热血", "温暖", "冷峻", "诗意"]
export const PACING_OPTIONS: Array<{ label: string; value: Pacing; hint: string }> = [
  { label: "快节奏", value: "fast", hint: "适合悬疑、冒险与事件驱动" },
  { label: "中节奏", value: "medium", hint: "兼顾推进、情绪和角色刻画" },
  { label: "慢节奏", value: "slow", hint: "更强调氛围、心理和留白" },
]

export const BEAT_TYPE_OPTIONS = [
  { value: "action", label: "动作", hint: "人物行为、调度与具体动作推进" },
  { value: "dialogue", label: "对白", hint: "角色明确说出口的台词" },
  { value: "inner", label: "内心", hint: "角色心理活动或内心独白" },
  { value: "exposition", label: "叙述", hint: "背景交代、信息说明或画面描述" },
] as const

export const BEAT_TYPE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  BEAT_TYPE_OPTIONS.map((item) => [item.value, item.label])
)

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
