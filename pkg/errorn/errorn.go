package errorn

const defaultCode = 500

// CodeError - Custom error with code
type CodeError struct {
	Code int
	Msg  string
}

func (e *CodeError) Error() string {
	return e.Msg
}

// New - Create a new code error
func New(code int, msg string) *CodeError {
	return &CodeError{Code: code, Msg: msg}
}

// NewDefault - Create a default error (500)
func NewDefault(msg string) *CodeError {
	return &CodeError{Code: defaultCode, Msg: msg}
}
