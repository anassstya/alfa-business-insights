package mlclient

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"time"
)

type Analyzer interface {
	Analyze(context.Context, AnalysisRequest) (json.RawMessage, error)
}

func FromEnvironment(getenv func(string) string) (Analyzer, error) {
	switch mode := getenv("ML_MODE"); mode {
	case "mock":
		return MockClient{}, nil
	case "", "http":
		baseURL, token := getenv("ML_SERVICE_URL"), getenv("ML_SERVICE_TOKEN")
		u, err := url.Parse(baseURL)
		if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
			return nil, fmt.Errorf("ML_SERVICE_URL must be an HTTP(S) URL without credentials, query or fragment")
		}
		timeout := 8 * time.Minute
		if value := getenv("ML_HTTP_TIMEOUT"); value != "" {
			timeout, err = time.ParseDuration(value)
			if err != nil || timeout <= 0 {
				return nil, fmt.Errorf("ML_HTTP_TIMEOUT must be a positive duration")
			}
		}
		client := NewClient(baseURL, token)
		client.httpClient.Timeout = timeout
		return client, nil
	default:
		return nil, fmt.Errorf("ML_MODE must be mock or http")
	}
}
