import axios from "axios"
import type { 
  InternalAxiosRequestConfig, 
  AxiosError 
} from "axios"

// API Base Configuration
const isDev = import.meta.env.DEV
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ""
const API_VERSION = import.meta.env.VITE_API_VERSION || "v1"

// Development: use relative path (Vite proxy)
// Production: use full URL
const baseURL = isDev && !API_BASE_URL 
  ? `/api/${API_VERSION}`
  : `${API_BASE_URL}/api/${API_VERSION}`

// Token Storage Keys
const ACCESS_TOKEN_KEY = "access_token"
const REFRESH_TOKEN_KEY = "refresh_token"

// Create Axios Instance
const client = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
})

// Development logging
if (isDev) {
  console.log("Axios Config:", {
    baseURL,
    mode: import.meta.env.MODE,
    isDev,
  })
}

// Request Interceptor - Add Access Token
client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// Flag to prevent multiple refresh requests
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: string) => void
  reject: (reason?: unknown) => void
}> = []

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token!)
    }
  })
  failedQueue = []
}

// Response Interceptor - Handle 401 and Auto Refresh Token
client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    // Handle 401 Unauthorized - Auto Refresh Token
    // Skip refresh logic for login endpoint or if no access token
    const isLoginRequest = originalRequest.url?.includes('/login')
    const hasAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
    
    if (error.response?.status === 401 && !originalRequest._retry && !isLoginRequest && hasAccessToken) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`
            }
            return client(originalRequest)
          })
          .catch((err) => {
            return Promise.reject(err)
          })
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)

      if (!refreshToken) {
        // No refresh token, clear tokens and reject (don't redirect here)
        clearTokens()
        return Promise.reject(error)
      }

      try {
        // Call refresh token API
        const { data } = await axios.post(`${API_BASE_URL}/api/${API_VERSION}/refresh`, {
          refresh_token: refreshToken,
        })

        const newAccessToken = data.data.access_token

        // Save new access token
        localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken)

        // Update authorization header
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        }

        // Process queued requests
        processQueue(null, newAccessToken)

        // Retry original request
        return client(originalRequest)
      } catch (refreshError) {
        // Refresh token failed, clear tokens and redirect to login
        processQueue(refreshError as AxiosError, null)
        clearTokens()
        window.location.href = "/login"
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    // Handle other errors
    return Promise.reject(error)
  }
)

// Token Management Utilities
export const setTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export const getAccessToken = () => {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export const getRefreshToken = () => {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export const clearTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export const isAuthenticated = () => {
  return !!getAccessToken()
}

export default client
