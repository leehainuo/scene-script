/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuthStore } from "@/stores"
import { login } from "@/services"
import type { LoginRequest } from "@/types"

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login: setAuth, setLoading } = useAuthStore()

  const [formData, setFormData] = useState<LoginRequest>({
    username: "",
    password: "",
  })
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    setLoading(true)

    try {
      const response = await login(formData)

      if (response.code === 0 && response.data) {
        const { access_token, refresh_token, user_id, username } = response.data

        // Save to auth store
        setAuth(
          { user_id, username },
          access_token,
          refresh_token
        )

        // Redirect to the page user tried to access, or dashboard
        const from = (location.state as any)?.from?.pathname || "/"
        navigate(from, { replace: true })
      } else {
        setError(response.msg || "登录失败，请检查用户名或密码")
      }
    } catch (err: any) {
      // Handle different error types
      const status = err.response?.status
      const message = err.response?.data?.msg
      
      if (status === 401) {
        setError("用户名或密码错误")
      } else if (status === 500) {
        setError("服务器错误，请稍后重试")
      } else if (message) {
        setError(message)
      } else if (err.code === 'ERR_NETWORK') {
        setError("网络连接失败，请检查后端服务是否启动")
      } else {
        setError("登录失败，请稍后重试")
      }
    } finally {
      setIsLoading(false)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Scene Script</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            登录以继续访问
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                placeholder="请输入用户名"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "登录中..." : "登录"}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          <p>默认账号: admin / admin</p>
        </div>
      </div>
    </div>
  )
}
