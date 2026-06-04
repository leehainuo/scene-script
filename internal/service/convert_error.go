package service

import "fmt"

// ConvertErrorCode - Stable categories for script conversion failures.
type ConvertErrorCode string

const (
	ConvertErrorLLM          ConvertErrorCode = "llm_error"
	ConvertErrorYAMLParse    ConvertErrorCode = "yaml_parse_error"
	ConvertErrorSchema       ConvertErrorCode = "schema_validation_error"
	ConvertErrorSerialization ConvertErrorCode = "serialization_error"
)

// ConvertError - Typed error for logic-level mapping and persistence.
type ConvertError struct {
	Code    ConvertErrorCode
	Message string
	Err     error
}

func (e *ConvertError) Error() string {
	if e.Err == nil {
		return e.Message
	}
	return fmt.Sprintf("%s: %v", e.Message, e.Err)
}

func (e *ConvertError) Unwrap() error {
	return e.Err
}

// NewConvertError - Wrap conversion failures with a stable error category.
func NewConvertError(code ConvertErrorCode, message string, err error) *ConvertError {
	return &ConvertError{
		Code:    code,
		Message: message,
		Err:     err,
	}
}
