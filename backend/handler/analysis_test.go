package handler

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAnalysisRejectsInvalidRequests(t *testing.T) {
	h := NewAnalysisHandler(nil)
	t.Run("invalid company", func(t *testing.T) {
		r := httptest.NewRequest("POST", "/", strings.NewReader(`{"role":"cfo"}`))
		r.SetPathValue("companyID", "bad")
		w := httptest.NewRecorder()
		h.StartAnalysis(w, r)
		if w.Code != 400 {
			t.Fatalf("got %d", w.Code)
		}
	})
	for _, body := range []string{`{"unknown":1}`, `{"role":"cfo"} {}`, `{`} {
		t.Run(body, func(t *testing.T) {
			r := httptest.NewRequest("POST", "/", strings.NewReader(body))
			r.SetPathValue("companyID", "70")
			w := httptest.NewRecorder()
			h.StartAnalysis(w, r)
			if w.Code != 400 {
				t.Fatalf("got %d", w.Code)
			}
		})
	}
	t.Run("invalid job", func(t *testing.T) {
		r := httptest.NewRequest("GET", "/", nil)
		r.SetPathValue("jobID", "bad")
		w := httptest.NewRecorder()
		h.GetAnalysisJob(w, r)
		if w.Code != 400 {
			t.Fatalf("got %d", w.Code)
		}
	})
	t.Run("callback disabled without token", func(t *testing.T) {
		t.Setenv("ML_CALLBACK_TOKEN", "")
		w := httptest.NewRecorder()
		h.ReceiveAnalysisEvent(w, httptest.NewRequest("POST", "/", nil))
		if w.Code != 503 {
			t.Fatalf("got %d", w.Code)
		}
	})
}
