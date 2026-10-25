package model

type Company struct {
	ID                        int64    `json:"id"`
	SyntheticU                string   `json:"synthetic_u"`
	City                      *string  `json:"city"`
	Region                    *string  `json:"region"`
	RevenueCompany            *float64 `json:"revenue_company"`
	MainOKVEDName             *string  `json:"mainokved_name"`
	MainOKVEDCode             *string  `json:"mainokved_code"`
	OrgType                   *string  `json:"org_type"`
	OKFSName                  *string  `json:"okfs_name"`
	CompanyAgeYearsGradation  *string  `json:"company_age_years_gradation"`
	EcoMarkLabel              *string  `json:"eco_mark_label"`
	AmountWorkersFNSGradation *string  `json:"amount_workers_fns_gradation"`
	CLType                    *string  `json:"cl_type"`
}
