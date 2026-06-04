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
    // Redirect to login, save the attempted URL
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
