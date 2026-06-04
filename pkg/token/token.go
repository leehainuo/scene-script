package token

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// JWTConf - JWT configuration
type JWTConf struct {
	Secret            string `mapstructure:"secret"`
	AccessExpireTime  int64  `mapstructure:"access_expire_time"`  // seconds, default 3600 (1 hour)
	RefreshExpireTime int64  `mapstructure:"refresh_expire_time"` // seconds, default 604800 (7 days)
}

// TokenType - Token type
type TokenType string

const (
	AccessToken  TokenType = "access"
	RefreshToken TokenType = "refresh"
)

// Claims - JWT claims
type Claims struct {
	UserID    int64     `json:"user_id"`
	Username  string    `json:"username"`
	TokenType TokenType `json:"token_type"` // access or refresh
	jwt.RegisteredClaims
}

// Manager - JWT token manager
type Manager struct {
	secret            []byte
	accessExpireTime  int64
	refreshExpireTime int64
}

// New - Create token manager
func New(c JWTConf) *Manager {
	// Set default expire time
	if c.AccessExpireTime == 0 {
		c.AccessExpireTime = 3600 // 1 hour
	}
	if c.RefreshExpireTime == 0 {
		c.RefreshExpireTime = 7 * 24 * 3600 // 7 days
	}

	return &Manager{
		secret:            []byte(c.Secret),
		accessExpireTime:  c.AccessExpireTime,
		refreshExpireTime: c.RefreshExpireTime,
	}
}

// GenerateAccessToken - Generate access token (short-lived)
func (m *Manager) GenerateAccessToken(userID int64, username string) (string, error) {
	return m.generateToken(userID, username, AccessToken, m.accessExpireTime)
}

// GenerateRefreshToken - Generate refresh token (long-lived)
func (m *Manager) GenerateRefreshToken(userID int64, username string) (string, error) {
	return m.generateToken(userID, username, RefreshToken, m.refreshExpireTime)
}

// generateToken - Internal method to generate token
func (m *Manager) generateToken(userID int64, username string, tokenType TokenType, expireTime int64) (string, error) {
	now := time.Now()
	claims := &Claims{
		UserID:    userID,
		Username:  username,
		TokenType: tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(expireTime) * time.Second)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

// GetAccessExpireTime - Get access token expire time
func (m *Manager) GetAccessExpireTime() int64 {
	return m.accessExpireTime
}

// GetRefreshExpireTime - Get refresh token expire time
func (m *Manager) GetRefreshExpireTime() int64 {
	return m.refreshExpireTime
}

// ParseToken - Parse and validate JWT token
func (m *Manager) ParseToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		// Validate signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return m.secret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}
