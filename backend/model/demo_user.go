package model

type DemoUser struct {
	ID         int64  `json:"id"`
	SyntheticF string `json:"synthetic_f"`
	FirstName  string `json:"first_name"`
	LastName   string `json:"last_name"`
}
