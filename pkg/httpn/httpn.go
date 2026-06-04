package httpn

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"

	"scene-script/pkg/errorn"
)

var validate = validator.New()

// Response - Standard response structure
type Response struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data any    `json:"data,omitempty"`
}

// Ok - Success response
func Ok(c *gin.Context, data any) {
	c.JSON(http.StatusOK, Response{
		Code: 0,
		Msg:  "ok",
		Data: data,
	})
}

// Error - Error response
func Error(c *gin.Context, err error) {
	c.JSON(http.StatusBadRequest, Response{
		Code: http.StatusBadRequest,
		Msg:  err.Error(),
	})
}

// BadRequest - 400 error
func BadRequest(c *gin.Context, msg string) {
	c.JSON(http.StatusBadRequest, Response{
		Code: http.StatusBadRequest,
		Msg:  msg,
	})
}

// HandleError - Handle business error
func HandleError(c *gin.Context, err error) {
	if e, ok := err.(*errorn.CodeError); ok {
		c.JSON(e.Code, Response{
			Code: e.Code,
			Msg:  e.Msg,
		})
		return
	}
	c.JSON(http.StatusInternalServerError, Response{
		Code: http.StatusInternalServerError,
		Msg:  err.Error(),
	})
}

// BindJSON - Bind and validate JSON
func BindJSON(c *gin.Context, obj any) error {
	if err := c.ShouldBindJSON(obj); err != nil {
		return err
	}
	return validate.Struct(obj)
}

// PathInt64 - Get path parameter as int64
func PathInt64(c *gin.Context, name string) (int64, error) {
	return strconv.ParseInt(c.Param(name), 10, 64)
}

// PathString - Get path parameter as string
func PathString(c *gin.Context, name string) string {
	return c.Param(name)
}
