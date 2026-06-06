import { BEAT_TYPE_LABEL_MAP } from "./constants"

export function getBeatTypeLabel(type?: string) {
  if (!type) {
    return "未设置类型"
  }
  return BEAT_TYPE_LABEL_MAP[type] ?? type
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

export function truncateText(value: string, maxLength: number) {
  const trimmed = value.trim()
  if (trimmed.length <= maxLength) {
    return trimmed
  }
  return `${trimmed.slice(0, maxLength).trim()}...`
}
