package model

import "errors"

var (
	// ErrNotFound Record not found error (compatible with go-zero's sqlc.ErrNotFound)
	ErrNotFound = errors.New("record not found")

	// ErrInvalidObjectId Invalid object ID error
	ErrInvalidObjectId = errors.New("invalid object id")

	// ErrRowsAffectedZero No rows affected error
	ErrRowsAffectedZero = errors.New("no rows affected")
)
