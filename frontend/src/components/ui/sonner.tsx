import { CircleAlert, CircleCheckBig, Info, LoaderCircle, TriangleAlert } from "lucide-react"
import { Toaster as SonnerToaster } from "sonner"

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      theme="light"
      richColors={false}
      icons={{
        success: <CircleCheckBig className="h-5 w-5 text-emerald-500" strokeWidth={2.2} />,
        error: <CircleAlert className="h-5 w-5 text-rose-500" strokeWidth={2.2} />,
        info: <Info className="h-5 w-5 text-sky-500" strokeWidth={2.2} />,
        warning: <TriangleAlert className="h-5 w-5 text-amber-500" strokeWidth={2.2} />,
        loading: <LoaderCircle className="h-5 w-5 animate-spin text-slate-500" strokeWidth={2.2} />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "rounded-[24px] border border-black/8 bg-white px-5 py-4 font-sans shadow-[0_18px_44px_rgba(15,23,42,0.08)]",
          content: "gap-2.5",
          title: "text-[15px] font-normal leading-7 text-slate-950",
          description: "text-sm leading-6 text-slate-500",
          icon: "mr-2.5",
          success: "[&_[data-title]]:text-slate-950 [&_[data-description]]:text-slate-500",
          error:
            "border-rose-100 [&_[data-title]]:text-rose-600 [&_[data-description]]:text-rose-500",
          info: "[&_[data-title]]:text-slate-950 [&_[data-description]]:text-slate-500",
          warning: "[&_[data-title]]:text-slate-950 [&_[data-description]]:text-slate-500",
          loading: "[&_[data-title]]:text-slate-950 [&_[data-description]]:text-slate-500",
          closeButton:
            "border-black/8 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700",
          actionButton: "bg-slate-950 text-white hover:bg-slate-800",
          cancelButton: "bg-slate-100 text-slate-700 hover:bg-slate-200",
        },
      }}
    />
  )
}
