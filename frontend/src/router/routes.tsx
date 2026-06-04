import type { RouteObject } from "react-router-dom"

// Route paths configuration
export const ROUTES = {
  LOGIN: "/login",
  DASHBOARD: "/",
  NOT_FOUND: "*",
} as const

// Route configuration (components are lazy loaded in router/index.tsx)
export const routes: RouteObject[] = []
