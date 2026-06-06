import { formatScriptStyleSummary } from "@/lib/script-display"
import { formatDateTime } from "@/lib/script-workshop"
import { cn } from "@/lib/utils"
import type { DetailViewProps } from "./detail-view-types"
import { detailCardEnterClass, getDetailCardAnimationDelay } from "./detail-view-utils"

type SummaryPanelProps = Pick<DetailViewProps, "activeResult" | "summary" | "consistency">

export function SummaryPanel({ activeResult, summary, consistency }: SummaryPanelProps) {
  if (!activeResult) {
    return null
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "章节", value: summary.chapters },
            { label: "场景", value: summary.scenes },
            { label: "节拍", value: summary.beats },
            { label: "角色", value: summary.characters },
            { label: "地点", value: summary.settings },
          ].map((item, index) => (
            <div
              key={item.label}
              className={cn(
                "rounded-[22px] border border-black/6 bg-slate-50 px-4 py-4",
                detailCardEnterClass
              )}
              style={getDetailCardAnimationDelay(index)}
            >
              <p className="text-xs text-slate-400">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div
            className={cn(
              "rounded-[24px] border border-black/6 bg-slate-50 p-5",
              detailCardEnterClass
            )}
            style={getDetailCardAnimationDelay(5)}
          >
            <p className="text-xs text-slate-400">结果摘要</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              当前风格为{" "}
              {formatScriptStyleSummary(
                activeResult.metadata.genre,
                activeResult.metadata.tone,
                activeResult.metadata.pacing
              )}
              。本次结果基于 {activeResult.metadata.source_chapters} 章输入生成。
            </p>
            <p className="mt-4 text-sm text-slate-400">
              最近更新：{formatDateTime(activeResult.metadata.updated_at)}
            </p>
          </div>
          <div
            className={cn(
              "rounded-[24px] border border-black/6 bg-slate-50 p-5",
              detailCardEnterClass
            )}
            style={getDetailCardAnimationDelay(6)}
          >
            <p className="text-xs text-slate-400">一致性质检概况</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-2xl bg-white px-4 py-3 text-slate-600">
                正文用了但人物表没登记：{consistency.rolesMissing.length}
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 text-slate-600">
                场景用了但地点表没登记：{consistency.settingsMissing.length}
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 text-slate-600">
                已登记但当前未使用：{consistency.danglingRefs.length}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
