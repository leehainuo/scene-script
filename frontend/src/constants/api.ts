// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: "/login",
  LOGOUT: "/logout",
  REFRESH: "/refresh",

  // Users
  USERS: "/users",
  USER_BY_ID: (id: number) => `/users/${id}`,
} as const

// API Base URL
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080"

// API Version
export const API_VERSION = import.meta.env.VITE_API_VERSION || "v1"
