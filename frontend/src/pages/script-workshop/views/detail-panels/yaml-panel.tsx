import { Copy, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { DetailViewProps } from "./detail-view-types"
import { detailCardEnterClass, getDetailCardAnimationDelay } from "./detail-view-utils"

type YamlPanelProps = Pick<DetailViewProps, "liveYaml" | "handleCopyYaml" | "handleDownloadYaml">

export function YamlPanel({ liveYaml, handleCopyYaml, handleDownloadYaml }: YamlPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleCopyYaml()}
          className="border-black/8 bg-white text-slate-700 hover:bg-slate-50"
        >
          <Copy className="mr-2 h-4 w-4" />
          复制
        </Button>
        <Button
          size="sm"
          onClick={handleDownloadYaml}
          className="bg-slate-900 text-white hover:bg-slate-800"
        >
          <Download className="mr-2 h-4 w-4" />
          下载
        </Button>
      </div>
      <div
        className={cn(
          "rounded-[24px] border border-black/6 bg-slate-900 p-4",
          detailCardEnterClass
        )}
        style={getDetailCardAnimationDelay(0)}
      >
        <pre className="max-h-[560px] overflow-auto whitespace-pre font-mono text-sm leading-6 text-slate-100">
          {liveYaml}
        </pre>
      </div>
    </div>
  )
}
