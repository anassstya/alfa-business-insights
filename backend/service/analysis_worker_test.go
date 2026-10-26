package service

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"alfa-business-insights/backend/model"
)

type brokenQueue struct {
	claims  atomic.Int32
	claimed chan struct{}
}

func (q *brokenQueue) ClaimNextAnalysis(context.Context) (*model.AnalysisJob, error) {
	if q.claims.Add(1) == 1 {
		close(q.claimed)
	}
	return nil, errors.New("database unavailable")
}

func (*brokenQueue) ExpireAnalyses(context.Context) error { return errors.New("database unavailable") }

func TestWorkerDatabaseFailureAndCancellation(t *testing.T) {
	r := &memoryAnalysisRepo{updated: make(chan model.AnalysisJob, 1)}
	queue := &brokenQueue{claimed: make(chan struct{})}
	s := NewAnalysisService(r, stubAnalyzer{err: errors.New("ML must not run without a successful claim")})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	done := make(chan struct{})
	go func() { defer close(done); s.Run(ctx, queue) }()

	select {
	case <-queue.claimed:
	case <-time.After(time.Second):
		t.Fatal("worker did not try the queue")
	}
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("worker did not stop during database outage")
	}
	if queue.claims.Load() != 1 {
		t.Fatalf("unexpected repeated claim: %d", queue.claims.Load())
	}
	select {
	case <-r.updated:
		t.Fatal("ML ran without a durable claim")
	default:
	}
}
