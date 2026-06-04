import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores"
import { logout } from "@/services"
import { getAccessToken, getRefreshToken } from "@/lib/axios"

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout: clearAuth } = useAuthStore()

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
      navigate("/login", { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <h1 className="text-xl font-bold">Scene Script</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              欢迎, {user?.username}
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              退出登录
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">仪表盘</h2>
            <p className="text-muted-foreground">欢迎使用 Scene Script</p>
          </div>

          {/* User Info Card */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold">用户信息</h3>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">用户 ID:</dt>
                <dd className="font-medium">{user?.user_id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">用户名:</dt>
                <dd className="font-medium">{user?.username}</dd>
              </div>
              {user?.email && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">邮箱:</dt>
                  <dd className="font-medium">{user.email}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </main>
    </div>
  )
}
