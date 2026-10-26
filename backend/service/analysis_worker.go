package service

import (
	"context"
	"log"
	"time"

	"alfa-business-insights/backend/model"
)

type AnalysisQueue interface {
	ClaimNextAnalysis(context.Context) (*model.AnalysisJob, error)
	ExpireAnalyses(context.Context) error
}

func (s *AnalysisService) Run(ctx context.Context, queue AnalysisQueue) {
	reaperDone := make(chan struct{})

	go func() {
		defer close(reaperDone)
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		for {
			if ctx.Err() != nil {
				return
			}
			opCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			err := queue.ExpireAnalyses(opCtx)
			cancel()

			if err != nil && ctx.Err() == nil {
				log.Printf("Analysis recovery failed: %v", err)
			}

			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
	defer func() { <-reaperDone }()

	for ctx.Err() == nil {
		opCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		job, err := queue.ClaimNextAnalysis(opCtx)
		cancel()

		if err != nil && ctx.Err() == nil {
			log.Printf("Analysis claim failed: %v", err)
		}

		if err == nil && job != nil {
			s.runMLAnalysis(ctx, *job)
			continue
		}

		timer := time.NewTimer(time.Second)

		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
	}
}
