import { useState } from "react"
import { ArrowLeft, LoaderCircle, LockKeyhole, User, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { login } from "@/services"
import { useAuthStore } from "@/stores"
import type { LoginRequest } from "@/types"

type LoginCardDialogProps = {
  open: boolean
  redirectTo?: string | null
  onClose: () => void
  onSuccess: (redirectTo?: string | null) => void
}

export function LoginCardDialog({
  open,
  redirectTo,
  onClose,
  onSuccess,
}: LoginCardDialogProps) {
  const { login: setAuth, setLoading } = useAuthStore()
  const [formData, setFormData] = useState<LoginRequest>({
    username: "",
    password: "",
  })
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleClose() {
    setError("")
    setIsSubmitting(false)
    onClose()
  }

  if (!open) {
    return null
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)
    setLoading(true)

    try {
      const response = await login(formData)

      if (response.code === 0 && response.data) {
        const { access_token, refresh_token, user_id, username } = response.data
        setAuth({ user_id, username }, access_token, refresh_token)
        setError("")
        onSuccess(redirectTo)
        return
      }

      setError(response.msg || "登录失败，请检查账号或密码")
    } catch (err: unknown) {
      const errorLike = err as {
        code?: string
        response?: {
          status?: number
          data?: { msg?: string }
        }
      }

      if (errorLike.response?.status === 401) {
        setError("账号或密码错误")
      } else if (errorLike.response?.status === 500) {
        setError("服务器错误，请稍后重试")
      } else if (errorLike.response?.data?.msg) {
        setError(errorLike.response.data.msg)
      } else if (errorLike.code === "ERR_NETWORK") {
        setError("网络连接失败，请检查后端服务是否启动")
      } else {
        setError("登录失败，请稍后重试")
      }
    } finally {
      setIsSubmitting(false)
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/48 px-4 py-8 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-[540px] rounded-[28px] bg-white px-8 py-8 shadow-[0_32px_90px_rgba(15,23,42,0.2)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleClose}
              aria-label="返回"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-900 transition-colors hover:bg-slate-200"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </button>
            <p className="text-[24px] font-semibold text-slate-900">登录</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="关闭"
            className="text-slate-900 transition-colors hover:text-slate-600"
          >
            <X className="h-7 w-7" strokeWidth={2} />
          </button>
        </div>

        <div className="mt-12">
          <h2 className="text-[32px] font-semibold tracking-tight text-slate-950">
            欢迎回来
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            使用账号和密码继续进入剧本创作工作台
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="sr-only">账号</span>
            <div className="relative">
              <User className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-300" />
              <Input
                type="text"
                placeholder="请输入账号"
                value={formData.username}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    username: event.target.value,
                  }))
                }
                className="h-13 rounded-2xl border border-slate-200 bg-slate-50 pl-11 text-sm text-slate-900 placeholder:text-slate-300 focus-visible:border-sky-300 focus-visible:ring-sky-100"
                required
              />
            </div>
          </label>

          <label className="block">
            <span className="sr-only">密码</span>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-300" />
              <Input
                type="password"
                placeholder="请输入密码"
                value={formData.password}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                className="h-13 rounded-2xl border border-slate-200 bg-slate-100 pl-11 text-sm text-slate-900 placeholder:text-slate-300 focus-visible:border-sky-300 focus-visible:ring-sky-100"
                required
              />
            </div>
          </label>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 h-13 w-full rounded-2xl bg-slate-950 text-sm font-medium text-white hover:bg-slate-800"
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                登录中...
              </>
            ) : (
              "继续"
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
