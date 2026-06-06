import type { ConsistencyKind } from "./types"

export function formatConsistencyItem(kind: ConsistencyKind, item: string) {
  if (kind === "rolesMissing") {
    return `人物「${item}」在正文里已经用到，但人物表里还没登记。`
  }

  if (kind === "settingsMissing") {
    return `地点「${item}」在场景里已经用到，但地点表里还没登记。`
  }

  const danglingRoleMatch = item.match(/^角色 '(.+)' 已定义但未在任何场景中出现$/)
  if (danglingRoleMatch) {
    return `人物表里有「${danglingRoleMatch[1]}」，但当前正文还没用到。`
  }

  const danglingSettingMatch = item.match(/^(场景|地点) '(.+)' 已定义但未被任何场景使用$/)
  if (danglingSettingMatch) {
    return `地点表里有「${danglingSettingMatch[2]}」，但当前场景还没引用。`
  }

  return item
}
