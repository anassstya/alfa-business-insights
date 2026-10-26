package main

import "testing"

func TestHTTPStartupStillRequiresCallbackToken(t *testing.T) {
	// Validation must fail before opening a database or starting any worker.
	t.Setenv("DATABASE_URL", "postgres://alfa_test:local_test_only@127.0.0.1:55432/alfa_insights_test?sslmode=disable")
	t.Setenv("ML_MODE", "http")
	t.Setenv("ML_SERVICE_URL", "http://127.0.0.1:8001")
	t.Setenv("ML_SERVICE_TOKEN", "")
	t.Setenv("ML_CALLBACK_TOKEN", "")
	if err := run(); err == nil || err.Error() != "ML_CALLBACK_TOKEN is not set" {
		t.Fatalf("expected mandatory callback token, got %v", err)
	}
}
