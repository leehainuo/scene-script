import { useEffect, useMemo, useRef, useState } from "react"
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
import { cn } from "@/lib/utils"

const TYPING_LINES = [
  "Novel in，Script out。",
  "从原文抵达剧本，让故事有结构可打磨。",
  "章节、场景、节拍，语义化编辑与联动。",
  "结构化 YAML，结果可复制、可下载、可复用。",
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
  const [animateIn, setAnimateIn] = useState(false)
  const [typedText, setTypedText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [lineIndex, setLineIndex] = useState(0)
  const longestLine = useMemo(
    () => TYPING_LINES.reduce((a, b) => (b.length > a.length ? b : a), ""),
    []
  )

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

  useEffect(() => {
    const t = setTimeout(() => setAnimateIn(true), 20)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const current = TYPING_LINES[lineIndex]
    let timeout = 0 as unknown as number
    const typingBase = 58
    const deletingBase = 40
    const typeJitter = 18
    const deleteJitter = 12
    const pauseEnd = 1200
    const pauseStart = 420

    if (!isDeleting) {
      if (typedText.length < current.length) {
        timeout = window.setTimeout(() => {
          setTypedText(current.slice(0, typedText.length + 1))
        }, typingBase + Math.floor(Math.random() * typeJitter))
      } else {
        timeout = window.setTimeout(() => setIsDeleting(true), pauseEnd)
      }
    } else {
      if (typedText.length > 0) {
        timeout = window.setTimeout(() => {
          setTypedText(current.slice(0, typedText.length - 1))
        }, deletingBase + Math.floor(Math.random() * deleteJitter))
      } else {
        timeout = window.setTimeout(() => {
          setIsDeleting(false)
          setLineIndex((i) => (i + 1) % TYPING_LINES.length)
        }, pauseStart)
      }
    }

    return () => clearTimeout(timeout)
  }, [typedText, isDeleting, lineIndex])

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
                <h1
                  className={cn(
                    "mt-4 text-5xl font-semibold tracking-tighter text-slate-950 sm:text-7xl transition-all duration-700 ease-out",
                    animateIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                  )}
                  style={{ willChange: "transform, opacity" }}
                >
                  Scene Script
                </h1>
                <p
                  className={cn(
                    "mx-auto mt-5 max-w-3xl text-sm leading-7 text-slate-500 sm:text-base sm:leading-8 transition-all duration-700 ease-out",
                    animateIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  )}
                  style={{ willChange: "transform, opacity", transitionDelay: animateIn ? "80ms" : undefined }}
                >
                  把小说章节推成可继续打磨的结构化剧本初稿，让生成、浏览、回看和编辑都留在同一条创作链路里。
                </p>
              </div>

              <div
                className={cn(
                  "relative overflow-hidden transition-all duration-700 ease-out",
                  animateIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                )}
                style={{
                  willChange: "transform, opacity",
                  transitionDelay: animateIn ? "140ms" : undefined,
                  WebkitMaskImage:
                    "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 14%, rgba(0,0,0,1) 86%, rgba(0,0,0,0) 100%)",
                  WebkitMaskRepeat: "no-repeat",
                  WebkitMaskSize: "100% 100%",
                  maskImage:
                    "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 14%, rgba(0,0,0,1) 86%, rgba(0,0,0,0) 100%)",
                  maskRepeat: "no-repeat",
                  maskSize: "100% 100%",
                }}
              >
                <div
                  className="absolute inset-0 opacity-90"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, rgba(148,163,184,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.22) 1px, transparent 1px)",
                    backgroundSize: "42px 42px",
                  }}
                />
                <div className="absolute inset-x-0 top-0 z-0 h-24 bg-linear-to-b from-[#f6f6f7] via-[#f6f6f7]/80 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 z-0 h-24 bg-linear-to-t from-[#f6f6f7] via-[#f6f6f7]/80 to-transparent" />

                <div
                  className="pointer-events-none absolute inset-x-0 inset-y-0 z-10"
                  style={{
                    WebkitMaskImage:
                      "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,1) 82%, rgba(0,0,0,0) 100%)",
                    WebkitMaskRepeat: "no-repeat",
                    WebkitMaskSize: "100% 100%",
                    maskImage:
                      "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,1) 82%, rgba(0,0,0,0) 100%)",
                    maskRepeat: "no-repeat",
                    maskSize: "100% 100%",
                  }}
                >
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

                <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-40 bg-linear-to-r from-[#f6f6f7] to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-40 bg-linear-to-l from-[#f6f6f7] to-transparent" />

                <div className="relative z-10 -mt-6 flex min-h-[640px] items-center justify-center px-6 py-12 sm:-mt-12 sm:px-10">
                  <div className="max-w-3xl rounded-[32px] border border-white/80 bg-white/72 px-6 py-8 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-md sm:px-10 sm:py-10">
                    <h2
                      className={cn(
                        "mx-auto max-w-3xl text-center text-xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-xl transition-all duration-700 ease-out",
                        animateIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                      )}
                      style={{ willChange: "transform, opacity", transitionDelay: animateIn ? "100ms" : undefined }}
                    >
                      <span className="relative inline-block align-middle">
                        <span aria-hidden className="invisible block whitespace-pre">{longestLine}</span>
                        <span className="absolute inset-0 w-full text-center">{typedText}</span>
                      </span>
                    </h2>

                    <div className="mt-7 flex items-center justify-center">
                      <Button
                        onClick={() => handleProtectedNavigate("/script-workshop?view=workspace")}
                        className="h-11 rounded-2xl bg-slate-900 px-6 text-white hover:bg-slate-800"
                      >
                        即可前往
                        <ArrowRight className="ml-2 h-4 w-4" />
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

        @keyframes type-caret-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .type-caret { animation: type-caret-blink 1s steps(1, start) infinite; }
      `}</style>
    </div>
  )
}
