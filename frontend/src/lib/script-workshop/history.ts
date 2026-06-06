import type { ScriptHistoryItem } from "@/types"
import { GENERATION_STEPS } from "./constants"
import { formatSchemaValidationMessage } from "./errors"
import { truncateText } from "./utils"

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
      return "剧本已经生成完成。"
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

export function getHistoryCardCopy(item: ScriptHistoryItem) {
  if (item.status === "succeeded") {
    return {
      eyebrow: "继续打磨",
      title: "剧本已经生成完成",
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
