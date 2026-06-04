import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  ArrowRight,
  FileText,
  History,
  LayoutTemplate,
  Sparkles,
  Wand2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppSidebar } from "@/components/studio/app-sidebar"
import { LoginCardDialog } from "@/components/studio/login-card-dialog"
import { StudioPanel } from "@/components/studio/studio-panel"
import { useAuthStore } from "@/stores"
import { logout } from "@/services"
import { getAccessToken, getRefreshToken } from "@/lib/axios"

export default function DashboardPage() {
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

      <div className="mx-auto max-w-[1440px] px-4 py-18 lg:px-6">
        <div className="grid gap-6 lg:grid-cols-[88px_minmax(0,1fr)]">
          <AppSidebar
            activeKey={isAuthenticated ? "workspace" : ""}
            username={user?.username ?? "未登录"}
            onLogoClick={() => navigate("/")}
            authActionLabel={isAuthenticated ? "登出" : "登录"}
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
                label: "列表",
                icon: History,
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

          <section className="space-y-6 pt-3">
            <div className="mx-auto max-w-[1020px] space-y-6">
              <div className="text-center">
                <p className="text-lg font-semibold text-slate-800">
                  使用这个开始创作：
                  <span className="ml-2 text-sky-500">AI 剧本转换</span>
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  保持简单干净的创作体验，从小说章节直接进入剧本工作台
                </p>
              </div>

              <StudioPanel
                title="Scene Script"
                description="以更接近即梦的透明白色风格组织首页，只保留最核心的创作入口。"
                className="rounded-[30px] border-white/70 bg-white/72"
              >
                <div className="grid gap-4 lg:grid-cols-[116px_minmax(0,1fr)]">
                  <div className="flex h-28 items-center justify-center rounded-[24px] bg-slate-100 text-slate-400">
                    <LayoutTemplate className="h-7 w-7" />
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-black/6 bg-slate-50 px-4 py-4">
                      <p className="text-sm leading-7 text-slate-500">
                        从 3 个章节以上的小说文本自动转换为结构化剧本（YAML 格式），同时保留生成列表、详情回看和一致性质检能力。
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "3 章起步",
                        "YAML 输出",
                        "生成列表",
                        "详情回看",
                        "一致性质检",
                      ].map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-sm text-slate-500"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                  <div className="rounded-2xl border border-black/6 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    左侧导航支持前往工作台、生成列表和详情预览
                  </div>
                  <Button
                    onClick={() => handleProtectedNavigate("/script-workshop?view=workspace")}
                    className="h-11 rounded-2xl bg-slate-900 px-6 text-white hover:bg-slate-800"
                  >
                    {isAuthenticated ? "进入工作台" : "登录后开始"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </StudioPanel>

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    title: "更像创作平台",
                    desc: "页面以单主面板和轻导航为主，不再堆满后台信息。",
                  },
                  {
                    title: "结果可继续使用",
                    desc: "支持查看生成列表、回载详情、复制和下载 YAML。",
                  },
                  {
                    title: "适合面试展示",
                    desc: "从产品感、输入体验到结果表达都更像完整平台。",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[24px] border border-black/6 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.04)]"
                  >
                    <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs text-sky-600">
                      <Sparkles className="h-3.5 w-3.5" />
                      亮点
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
