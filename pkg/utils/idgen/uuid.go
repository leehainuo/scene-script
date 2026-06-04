package idgen

import (
	"strings"

	"github.com/google/uuid"
)

// UUID - Generate UUID v4
func UUID() string {
	return uuid.New().String()
}

// ShortUUID - Generate short UUID (without hyphens)
func ShortUUID() string {
	return strings.ReplaceAll(uuid.New().String(), "-", "")
}
