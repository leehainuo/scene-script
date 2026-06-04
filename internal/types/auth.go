package types

// LoginReq - Login request
type LoginReq struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

// LoginResp - Login response
type LoginResp struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"` // access token expire seconds
	UserID       int64  `json:"user_id"`
	Username     string `json:"username"`
}

// RefreshReq - Refresh token request
type RefreshReq struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// RefreshResp - Refresh token response
type RefreshResp struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int64  `json:"expires_in"`
}

// LogoutReq - Logout request
type LogoutReq struct {
	RefreshToken string `json:"refresh_token"` // optional
}
