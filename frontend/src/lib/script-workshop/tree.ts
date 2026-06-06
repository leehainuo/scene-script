import type { ScriptYamlDocument } from "@/types"
import type { ScriptTreeNode } from "./types"
import { getBeatTypeLabel } from "./utils"

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
            : getBeatTypeLabel(beat.type),
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
