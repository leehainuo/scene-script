package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"scene-script/config"
	"scene-script/internal/router"
	"scene-script/internal/svc"
	"scene-script/pkg/logn"
)

func main() {
	// Get environment
	env := flag.String("env", func() string {
		if v := os.Getenv("NEXT_ENV"); v != "" {
			return v
		}
		return "dev"
	}(), "Environment: dev, prod")
	flag.Parse()

	// Load config
	c, err := config.Init("config/config." + *env + ".yaml")
	if err != nil {
		panic(fmt.Sprintf("Failed to load config: %v", err))
	}

	// Init logger
	if err := logn.Init(c.Log); err != nil {
		panic(fmt.Sprintf("Failed to init logger: %v", err))
	}

	// Init service context
	svc, err := svc.NewServiceContext(c)
	if err != nil {
		panic(fmt.Sprintf("Failed to init service: %v", err))
	}

	logn.Info("Application starting")

	// Setup Gin router
	r := router.Setup(svc)

	// Create HTTP server
	addr := fmt.Sprintf("%s:%d", c.Server.Host, c.Server.Port)
	server := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  time.Duration(c.Server.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(c.Server.WriteTimeout) * time.Second,
	}

	// Start server in goroutine
	go func() {
		logn.Info("Server starting at " + addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logn.Error(fmt.Sprintf("Server failed to start: %v", err))
			os.Exit(1)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logn.Info("Shutting down server...")

	// Graceful shutdown with 5 second timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logn.Error(fmt.Sprintf("Server forced to shutdown: %v", err))
		return
	}

	logn.Info("Server exited gracefully")
}
