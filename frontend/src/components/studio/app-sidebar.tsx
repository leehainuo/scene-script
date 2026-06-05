import type { LucideIcon } from "lucide-react"
import { Brush } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function getUsernameInitial(username?: string) {
  const trimmed = username?.trim()
  if (!trimmed) {
    return "?"
  }

  const firstChar = Array.from(trimmed)[0] ?? "?"
  return /^[a-zA-Z]$/.test(firstChar) ? firstChar.toUpperCase() : firstChar
}

export type SidebarItem = {
  key: string
  label: string
  icon: LucideIcon
  onClick: () => void
}

export function AppSidebar({
  activeKey,
  items,
  username,
  onLogoClick,
  authActionLabel = "登录",
  onAuthAction,
}: {
  activeKey: string
  items: SidebarItem[]
  username?: string
  onLogoClick?: () => void
  authActionLabel?: string
  onAuthAction: () => void
}) {
  const userInitial = getUsernameInitial(username)

  return (
    <aside className="hidden lg:block w-[72px] shrink-0">
      <div className="fixed left-4 top-0 flex h-screen w-[72px] flex-col items-center justify-between px-1 py-6">
        <div className="flex flex-col items-center gap-20">
          <button
            type="button"
            onClick={onLogoClick}
            aria-label="返回首页"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white shadow-[0_10px_25px_rgba(15,23,42,0.16)] transition-transform hover:scale-[1.03]"
          >
            <Brush className="h-4 w-4" strokeWidth={2.1} />
          </button>
          <div className="flex flex-col items-center gap-6">
            {items.map((item) => {
              const active = activeKey === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  className="flex w-full flex-col items-center gap-2"
                >
                  <div
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-2xl transition-colors",
                      active
                        ? "text-slate-950"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <item.icon className="h-4 w-4" strokeWidth={2.2} />
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium tracking-tight",
                      active ? "text-slate-950" : "text-slate-500"
                    )}
                  >
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-4 pb-2">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600"
            aria-label={username || "未登录"}
            title={username || "未登录"}
          >
            {userInitial}
          </div>
          <Button
            variant="outline"
            onClick={onAuthAction}
            className="h-8 rounded-md border-black/8 bg-white/65 px-4 text-slate-700 backdrop-blur-xl hover:bg-white hover:text-slate-900"
          >
            <p className="text-xs">{authActionLabel}</p>
          </Button>
        </div>
      </div>
    </aside>
  )
}
