// Login Request
export interface LoginRequest {
  username: string
  password: string
}

// Login Response (matches backend dual token system)
export interface LoginResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  user_id: number
  username: string
}

// Refresh Token Request
export interface RefreshTokenRequest {
  refresh_token: string
}

// Refresh Token Response
export interface RefreshTokenResponse {
  access_token: string
  expires_in: number
}

// Logout Request
export interface LogoutRequest {
  access_token: string
  refresh_token: string
}
