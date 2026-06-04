package sqlx

import (
	"fmt"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
)

// MySQLConf MySQL configuration for database connection
type MySQLConf struct {
	Host            string `mapstructure:"host"`
	Port            int    `mapstructure:"port"`
	User            string `mapstructure:"user"`
	Password        string `mapstructure:"password"`
	Database        string `mapstructure:"database"`
	MaxOpenConns    int    `mapstructure:"max_open_conns"`
	MaxIdleConns    int    `mapstructure:"max_idle_conns"`
	ConnMaxLifetime int    `mapstructure:"conn_max_lifetime"` // in seconds
}

// DSN returns the MySQL data source name
func (c MySQLConf) DSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		c.User,
		c.Password,
		c.Host,
		c.Port,
		c.Database,
	)
}

// MySQLConfig MySQL connection pool configuration (internal use)
type MySQLConfig struct {
	DSN             string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime int // in seconds
}

// NewMysql creates a new MySQL SqlConn from DSN
// This is compatible with go-zero's sqlx.NewMysql() interface
func NewMysql(dsn string, opts ...func(*MySQLConfig)) (SqlConn, error) {
	// Default configuration
	c := &MySQLConfig{
		DSN:             dsn,
		MaxOpenConns:    100,
		MaxIdleConns:    10,
		ConnMaxLifetime: 3600,
	}

	// Apply options
	for _, opt := range opts {
		opt(c)
	}

	db, err := sqlx.Connect("mysql", c.DSN)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to mysql: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(c.MaxOpenConns)
	db.SetMaxIdleConns(c.MaxIdleConns)
	db.SetConnMaxLifetime(time.Duration(c.ConnMaxLifetime) * time.Second)

	// Test the connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping mysql: %w", err)
	}

	return NewSqlxAdapter(db), nil
}

// WithMaxOpenConns sets max open connections
func WithMaxOpenConns(n int) func(*MySQLConfig) {
	return func(c *MySQLConfig) {
		c.MaxOpenConns = n
	}
}

// WithMaxIdleConns sets max idle connections
func WithMaxIdleConns(n int) func(*MySQLConfig) {
	return func(c *MySQLConfig) {
		c.MaxIdleConns = n
	}
}

// WithConnMaxLifetime sets connection max lifetime
func WithConnMaxLifetime(seconds int) func(*MySQLConfig) {
	return func(c *MySQLConfig) {
		c.ConnMaxLifetime = seconds
	}
}

// MustNewMysql creates a new MySQL SqlConn and panics on error
func MustNewMysql(dsn string, opts ...func(*MySQLConfig)) SqlConn {
	conn, err := NewMysql(dsn, opts...)
	if err != nil {
		panic(err)
	}
	return conn
}
