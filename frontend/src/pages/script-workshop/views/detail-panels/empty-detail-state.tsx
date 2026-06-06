import { SectionPanel } from "@/components/shared/section-panel"
import { getPacingLabel } from "@/lib/script-display"
import { formatDateTime } from "@/lib/script-workshop"
import type { DetailViewProps } from "./detail-view-types"

type EmptyDetailStateProps = Pick<
  DetailViewProps,
  "activeTaskMeta" | "activeStatus" | "taskProgressMessage"
>

export function EmptyDetailState({
  activeTaskMeta,
  activeStatus,
  taskProgressMessage,
}: EmptyDetailStateProps) {
  return (
    <SectionPanel
      eyebrow="Detail"
      title={activeTaskMeta ? activeTaskMeta.title || "任务详情" : "详情预览"}
      description={
        activeTaskMeta
          ? "任务状态会实时同步，完成后会自动载入最终 YAML 与结构结果。"
          : "先在工作台生成剧本，或从作品中点开一个历史结果。"
      }
      animateOnMount
      animationDelayMs={0}
      className="rounded-[30px] border-black/6 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
    >
      {activeTaskMeta ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "状态", value: activeStatus.label },
              { label: "体裁", value: activeTaskMeta.genre },
              { label: "语气", value: activeTaskMeta.tone },
              { label: "节奏", value: getPacingLabel(activeTaskMeta.pacing) },
              { label: "章节", value: `${activeTaskMeta.source_chapters} 章` },
            ].map((item) => (
              <div key={item.label} className="rounded-[22px] border border-black/6 bg-slate-50 px-4 py-4">
                <p className="text-xs text-slate-400">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-[24px] border border-black/6 bg-slate-50 p-5">
            <p className="text-xs text-slate-400">当前进度</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {taskProgressMessage ||
                (activeTaskMeta.status === "failed"
                  ? activeTaskMeta.err_msg || "任务执行失败，请稍后重试。"
                  : "任务仍在处理中，已连接后台状态流，请稍候。")}
            </p>
            <p className="mt-4 text-sm text-slate-400">
              最近更新：{formatDateTime(activeTaskMeta.updated_at)}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-black/8 px-4 py-16 text-center">
          <p className="text-lg font-medium text-slate-800">还没有可展示的详情</p>
          <p className="mt-2 text-sm text-slate-400">
            你可以前往工作台生成，或者打开左侧“作品”选择一个已生成结果。
          </p>
        </div>
      )}
    </SectionPanel>
  )
}
