import client from "@/lib/axios"
import type {
  ApiResponse,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  LogoutRequest,
} from "@/types"

// Login
export const login = async (data: LoginRequest) => {
  const response = await client.post<ApiResponse<LoginResponse>>("/login", data)
  return response.data
}

// Refresh Token
export const refreshToken = async (data: RefreshTokenRequest) => {
  const response = await client.post<ApiResponse<RefreshTokenResponse>>(
    "/refresh",
    data
  )
  return response.data
}

// Logout
export const logout = async (data: LogoutRequest) => {
  const response = await client.post<ApiResponse<void>>("/logout", data)
  return response.data
}
