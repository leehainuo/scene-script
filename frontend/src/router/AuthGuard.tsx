import { Navigate, useLocation } from "react-router-dom"
import { useAuthStore } from "@/stores"

interface AuthGuardProps {
  children: React.ReactNode
}

// Route Guard - Protect routes that require authentication
export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated) {
    const redirectTo = `${location.pathname}${location.search}${location.hash}`
    const params = new URLSearchParams({
      login: "1",
      redirect: redirectTo,
    })

    return <Navigate to={`/?${params.toString()}`} replace />
  }

  return <>{children}</>
}
