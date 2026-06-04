// Export all constants
export * from "./api"

// App Constants
export const APP_NAME = import.meta.env.VITE_APP_NAME || "Next Admin"
export const APP_DESCRIPTION =
  import.meta.env.VITE_APP_DESCRIPTION || "Next.js Admin System"

// Storage Keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: "access_token",
  REFRESH_TOKEN: "refresh_token",
  USER: "user",
  THEME: "theme",
} as const

// Pagination
export const DEFAULT_PAGE_SIZE = 10
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
