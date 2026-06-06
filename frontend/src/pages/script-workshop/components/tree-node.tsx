import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ScriptTreeNode } from "@/lib/script-workshop"

type TreeNodeProps = {
  node: ScriptTreeNode
  selectedId: string | null
  onSelect: (node: ScriptTreeNode) => void
  level?: number
}

function truncateTreeText(value: string, maxChars: number) {
  const normalized = value.trim()
  const chars = Array.from(normalized)
  if (chars.length <= maxChars) {
    return normalized
  }
  return `${chars.slice(0, maxChars).join("")}...`
}

export function TreeNode({ node, selectedId, onSelect, level = 0 }: TreeNodeProps) {
  const [open, setOpen] = useState(level < 2)
  const hasChildren = node.children.length > 0
  const labelMaxChars = node.kind === "chapter" ? 18 : node.kind === "scene" ? 14 : 16
  const descriptionMaxChars = node.kind === "chapter" ? 26 : 20
  const displayLabel = truncateTreeText(node.label, labelMaxChars)
  const displayDescription = truncateTreeText(node.description, descriptionMaxChars)

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
          <span className="block truncate" title={node.label}>
            {displayLabel}
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-400" title={node.description}>
            {displayDescription}
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
