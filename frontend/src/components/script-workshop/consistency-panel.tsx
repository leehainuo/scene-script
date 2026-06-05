import { ShieldAlert } from "lucide-react"
import { StudioPanel } from "@/components/studio/studio-panel"

type ConsistencyPanelProps = {
  consistency: {
    rolesMissing: string[]
    settingsMissing: string[]
    danglingRefs: string[]
  }
}

function formatConsistencyItem(
  kind: "rolesMissing" | "settingsMissing" | "danglingRefs",
  item: string
) {
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

export function ConsistencyPanel({ consistency }: ConsistencyPanelProps) {
  return (
    <StudioPanel
      eyebrow="Consistency"
      title="一致性质检详情"
      description="保持和页面主风格一致，不再单独堆很多颜色块。"
      animateOnMount
      animationDelayMs={160}
      className="rounded-[30px] border-black/6 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
    >
      <div className="grid gap-4 md:grid-cols-3">
        {([
          {
            label: "正文用了但人物表没登记",
            items: consistency.rolesMissing,
            kind: "rolesMissing",
          },
          {
            label: "场景用了但地点表没登记",
            items: consistency.settingsMissing,
            kind: "settingsMissing",
          },
          {
            label: "已登记但当前未使用",
            items: consistency.danglingRefs,
            kind: "danglingRefs",
          },
        ] as const).map((group) => (
          <div
            key={group.label}
            className="rounded-[24px] border border-black/6 bg-slate-50 p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-slate-400" />
                <p className="text-sm font-medium text-slate-800">{group.label}</p>
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
                    {formatConsistencyItem(group.kind, item)}
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
  )
}
