import { Suspense } from "react"
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom"
import { AuthGuard } from "./AuthGuard"

// Lazy load pages
import Dashboard from "@/pages/dashboard"
import ScriptWorkshop from "@/pages/script-workshop"
import NotFound from "@/pages/404"

// Loading component
function PageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

// Create router with route guards
const router = createBrowserRouter([
  {
    path: "/login",
    element: <Navigate to="/?login=1" replace />,
  },
  {
    path: "/",
    element: (
      <Suspense fallback={<PageLoading />}>
        <Dashboard />
      </Suspense>
    ),
  },
  {
    path: "/script-workshop",
    element: (
      <AuthGuard>
        <Suspense fallback={<PageLoading />}>
          <ScriptWorkshop />
        </Suspense>
      </AuthGuard>
    ),
  },
  {
    path: "/dashboard",
    element: <Navigate to="/" replace />,
  },
  {
    path: "*",
    element: (
      <Suspense fallback={<PageLoading />}>
        <NotFound />
      </Suspense>
    ),
  },
])

export function Router() {
  return <RouterProvider router={router} />
}

export default Router
