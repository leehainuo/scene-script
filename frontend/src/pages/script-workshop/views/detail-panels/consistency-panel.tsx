import { formatConsistencyItem } from "@/lib/script-workshop"
import { cn } from "@/lib/utils"
import type { DetailViewProps } from "./detail-view-types"
import { detailCardEnterClass, getDetailCardAnimationDelay } from "./detail-view-utils"

type ConsistencyPanelProps = Pick<DetailViewProps, "consistency">

export function ConsistencyPanel({ consistency }: ConsistencyPanelProps) {
  return (
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
      ] as const).map((group, index) => (
        <div
          key={group.label}
          className={cn(
            "rounded-[24px] border border-black/6 bg-slate-50 p-4",
            detailCardEnterClass
          )}
          style={getDetailCardAnimationDelay(index)}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-800">{group.label}</p>
            <span className="rounded-full border border-black/8 bg-white px-2 py-0.5 text-xs text-slate-500">
              {group.items.length}
            </span>
          </div>
          {group.items.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {group.items.map((item) => (
                <li key={`${group.label}-${item}`} className="rounded-2xl bg-white px-3 py-2">
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
  )
}
