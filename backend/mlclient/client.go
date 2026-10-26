package mlclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	baseURL    string
	token      string
	httpClient *http.Client
}

func NewClient(baseURL, token string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		token:   token,
		httpClient: &http.Client{
			Timeout: 8 * time.Minute,
		},
	}
}

type AnalysisRequest struct {
	JobID     string  `json:"job_id"`
	CompanyID int64   `json:"company_id"`
	Role      string  `json:"role"`
	Goal      *string `json:"goal,omitempty"`
}

func (c *Client) Analyze(ctx context.Context, req AnalysisRequest) (json.RawMessage, error) {
	return c.post(ctx, "/internal/analyze-company", req)
}

func (c *Client) post(ctx context.Context, path string, req any) (json.RawMessage, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.baseURL+path,
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, err
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		httpReq.Header.Set("Authorization", "Bearer "+c.token)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("ML request failed: %w", err)
	}
	defer resp.Body.Close()

	result, err := io.ReadAll(io.LimitReader(resp.Body, (8<<20)+1))
	if err != nil {
		return nil, err
	}

	if len(result) > 8<<20 {
		return nil, fmt.Errorf("ML response exceeds 8 MiB")
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ML returned status %d", resp.StatusCode)
	}

	if !json.Valid(result) {
		return nil, fmt.Errorf("ML returned invalid JSON")
	}

	return json.RawMessage(result), nil
}
