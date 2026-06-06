import type { ValidationErrors } from "./types"

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
    return `第 ${chapter} 章第 ${scene} 个场景的${fieldMap[sceneMatch[3]] ?? sceneMatch[3]}`
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

export function mergeValidationErrors(...errorSets: ValidationErrors[]) {
  return Object.assign({}, ...errorSets)
}
