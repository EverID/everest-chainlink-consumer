package adapter

import (
	"time"

	validation "github.com/go-ozzo/ozzo-validation/v4"
)

type Status int64

const (
	KYCUser Status = iota + 1
	HumanUnique
	NotFound
)

func (s Status) String() string {
	switch s {
	case KYCUser:
		return "KYC_USER"
	case HumanUnique:
		return "HUMAN_AND_UNIQUE"
	default:
		return "UNDEFINED"
	}
}

type KYCPayload struct {
	IsHumanAndUniqueUser bool       `json:"isHumanAndUniqueUser"`
	IsKYCUser            bool       `json:"isKYCUser"`
	KYCDate              *time.Time `json:"KYCDate"`
}

func (p KYCPayload) Validate() error {
	return validation.ValidateStruct(&p,
		validation.Field(&p.KYCDate, validation.When(p.IsKYCUser, validation.Required).Else(validation.Nil)),
		validation.Field(&p.IsHumanAndUniqueUser, validation.When(p.IsKYCUser, validation.Required)),
	)
}

type Response struct {
	KYCPayload KYCPayload `json:"data"`
	Error      string     `json:"error"`
	Success    bool       `json:"success"`
}
