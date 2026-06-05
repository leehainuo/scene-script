import { useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  ArrowRight,
  FileText,
  LayoutGrid,
  Wand2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppSidebar } from "@/components/studio/app-sidebar"
import { LoginCardDialog } from "@/components/studio/login-card-dialog"
import { useAuthStore } from "@/stores"
import { logout } from "@/services"
import { getAccessToken, getRefreshToken } from "@/lib/axios"
import { consumeSidebarEntranceAnimation } from "@/lib/sidebar-animation"

const HERO_FEATURES = [
  "YAML 剧本初稿",
  "异步生成",
  "继续打磨",
]

const MARQUEE_ROWS = [
  [
    "雨夜里，旧钟楼的钟摆停在三点十七分，所有人都以为那只是停电前的最后一声回响。",
    "把小说章节自动转换成结构化剧本。",
    "从章节、人物、场景到节拍，快速获得第一版可编辑初稿。",
    "支持异步生成、作品浏览、详情回看与一致性质检。",
  ],
  [
    "她推开档案室最里侧的门，发霉的纸张气味像一段没说完的证词扑面而来。",
    "Scene Script 让非专业作者也能直接打磨剧本结构。",
    "从故事氛围、人物动机到对白节奏，都能继续修改。",
    "不止生成结果，更保留完整创作工作流。",
  ],
  [
    "窗外的霓虹映在积水里，像被人故意剪碎后重新拼回去的城市记忆。",
    "Novel in, script out.",
    "将长文本改编成更适合创作、展示与继续迭代的剧本格式。",
    "让 YAML、结构树和作品墙共同服务于创作表达。",
  ],
  [
    "他把那封从未寄出的信夹进剧本页边，忽然明白真相一直藏在旁白之外。",
    "核心目标不是一次生成完美结果，而是更快抵达可打磨的第一稿。",
    "适合产品演示、面试展示，也适合真实创作起步。",
    "把灵感变成可以继续推进的戏剧结构。",
  ],
]

const MARQUEE_ROW_LAYOUT = [
  { top: "15%", offsetX: "-3%", offsetY: "-18px" },
  { top: "31%", offsetX: "6%", offsetY: "12px" },
  { top: "49%", offsetX: "-8%", offsetY: "-10px" },
  { top: "65%", offsetX: "4%", offsetY: "16px" },
]

const MARQUEE_ITEM_OFFSET_PATTERN = [-18, 10, -8, 14, -12, 6, 0, 12]

export default function DashboardPage() {
  useRef(consumeSidebarEntranceAnimation())
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, isAuthenticated, logout: clearAuth } = useAuthStore()

  const isLoginOpen = searchParams.get("login") === "1"
  const redirectAfterLogin = searchParams.get("redirect")

  const handleLogout = async () => {
    try {
      const accessToken = getAccessToken()
      const refreshToken = getRefreshToken()

      if (accessToken && refreshToken) {
        await logout({ access_token: accessToken, refresh_token: refreshToken })
      }
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      // Clear auth state and redirect to login
      clearAuth()
      navigate("/", { replace: true })
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !isLoginOpen) {
      return
    }

    const redirect = searchParams.get("redirect")
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete("login")
    nextParams.delete("redirect")
    setSearchParams(nextParams, { replace: true })

    if (redirect) {
      navigate(redirect, { replace: true })
    }
  }, [isAuthenticated, isLoginOpen, navigate, searchParams, setSearchParams])

  const openLogin = (redirectTo?: string) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set("login", "1")
    if (redirectTo) {
      nextParams.set("redirect", redirectTo)
    } else {
      nextParams.delete("redirect")
    }
    setSearchParams(nextParams, { replace: true })
  }

  const closeLogin = () => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete("login")
    nextParams.delete("redirect")
    setSearchParams(nextParams, { replace: true })
  }

  const handleProtectedNavigate = (target: string) => {
    if (!isAuthenticated) {
      openLogin(target)
      return
    }
    navigate(target)
  }

  const handleAuthAction = () => {
    if (!isAuthenticated) {
      openLogin()
      return
    }

    void handleLogout()
  }

  return (
    <div className="min-h-screen bg-[#f6f6f7] text-slate-900">
      <LoginCardDialog
        open={isLoginOpen}
        redirectTo={redirectAfterLogin}
        onClose={closeLogin}
        onSuccess={(redirectTo) => {
          closeLogin()
          if (redirectTo) {
            navigate(redirectTo, { replace: true })
          }
        }}
      />

      <div className="mx-auto max-w-[1440px] px-4 py-14 lg:px-6">
        <div className="grid gap-6 lg:grid-cols-[88px_minmax(0,1fr)]">
          <AppSidebar
            activeKey=""
            username={user?.username ?? "未登录"}
            onLogoClick={() => navigate("/")}
            authActionLabel={isAuthenticated ? "登出" : "登录"}
            animateItemsOnMount
            onAuthAction={handleAuthAction}
            items={[
              {
                key: "workspace",
                label: "工作台",
                icon: Wand2,
                onClick: () => handleProtectedNavigate("/script-workshop?view=workspace"),
              },
              {
                key: "history",
                label: "作品",
                icon: LayoutGrid,
                onClick: () => handleProtectedNavigate("/script-workshop?view=history"),
              },
              {
                key: "detail",
                label: "详情",
                icon: FileText,
                onClick: () => handleProtectedNavigate("/script-workshop?view=detail"),
              },
            ]}
          />

          <section className="space-y-6">
            <div className="mx-auto max-w-[1180px] space-y-10">
              <div className="text-center">
                <p className="text-[11px] font-medium uppercase tracking-[0.42em] text-slate-400">
                  AI Novel To Script
                </p>
                <h1 className="mt-4 text-5xl font-semibold tracking-tighter text-slate-950 sm:text-7xl">
                  Scene Script
                </h1>
                <p className="mx-auto mt-5 max-w-3xl text-sm leading-7 text-slate-500 sm:text-base sm:leading-8">
                  把小说章节推成可继续打磨的结构化剧本初稿，让生成、浏览、回看和编辑都留在同一条创作链路里。
                </p>
              </div>

              <div className="relative overflow-hidden rounded-[40px] bg-[#f6f6f7]/72 shadow-[0_24px_70px_rgba(15,23,42,0.05)] backdrop-blur-[2px]">
                <div
                  className="absolute inset-0 opacity-90"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, rgba(148,163,184,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.22) 1px, transparent 1px)",
                    backgroundSize: "42px 42px",
                  }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(circle at center, rgba(246,246,247,0) 32%, rgba(246,246,247,0.46) 70%, rgba(246,246,247,0.92) 100%)",
                  }}
                />
                <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 120px rgba(246,246,247,0.72)" }} />
                <div className="absolute inset-y-0 left-0 w-36 bg-linear-to-r from-[#f6f6f7] via-[#f6f6f7]/88 to-transparent" />
                <div className="absolute inset-y-0 right-0 w-36 bg-linear-to-l from-[#f6f6f7] via-[#f6f6f7]/88 to-transparent" />
                <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-[#f6f6f7] via-[#f6f6f7]/82 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-[#f6f6f7] via-[#f6f6f7]/82 to-transparent" />

                <div className="pointer-events-none absolute inset-x-[-12%] inset-y-0">
                  {MARQUEE_ROWS.map((row, index) => (
                    <div
                      key={`row-${index}`}
                      className="absolute left-0 right-0 overflow-visible py-6"
                      style={{
                        top: MARQUEE_ROW_LAYOUT[index]?.top ?? `${18 + index * 20}%`,
                        transform: `translate3d(${MARQUEE_ROW_LAYOUT[index]?.offsetX ?? "0%"}, ${MARQUEE_ROW_LAYOUT[index]?.offsetY ?? "0px"}, 0)`,
                      }}
                    >
                      <div
                        className="flex min-w-max items-center gap-3 whitespace-nowrap"
                        style={{
                          animation: `dashboard-marquee ${30 + index * 6}s linear infinite`,
                          animationDelay: `${-index * 4}s`,
                        }}
                      >
                        {[...row, ...row].map((item, itemIndex) => (
                          <span
                            key={`${index}-${itemIndex}-${item}`}
                            className="rounded-full border border-white/80 bg-white/72 px-4 py-2 text-sm text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur-sm"
                            style={{
                              transform: `translateY(${MARQUEE_ITEM_OFFSET_PATTERN[(itemIndex + index) % MARQUEE_ITEM_OFFSET_PATTERN.length]}px)`,
                            }}
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="relative z-10 flex min-h-[720px] items-center justify-center px-6 py-16 sm:px-10">
                  <div className="max-w-3xl rounded-[32px] border border-white/80 bg-white/72 px-6 py-8 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-md sm:px-10 sm:py-10">
                    <h2 className="text-2xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                      3 章以上小说，快速转成可编辑剧本初稿。
                    </h2>
                    <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base sm:leading-8">
                      异步生成、作品墙回看和详情编辑都留在同一条创作链路里，让结果真正可用。
                    </p>

                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                      {HERO_FEATURES.map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-black/8 bg-white/85 px-3 py-1.5 text-sm text-slate-600"
                        >
                          {item}
                        </span>
                      ))}
                    </div>

                    <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                      <Button
                        onClick={() => handleProtectedNavigate("/script-workshop?view=workspace")}
                        className="h-11 rounded-2xl bg-slate-900 px-6 text-white hover:bg-slate-800"
                      >
                        {isAuthenticated ? "进入工作台" : "登录后开始"}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => handleProtectedNavigate("/script-workshop?view=history")}
                        className="h-11 rounded-2xl px-4 text-slate-500 hover:bg-white/60 hover:text-slate-950"
                      >
                        查看作品墙
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      <style>{`
        @keyframes dashboard-marquee {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }
      `}</style>
    </div>
  )
}
