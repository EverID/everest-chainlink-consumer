package model

import (
	"time"

	"github.com/ethereum/go-ethereum/common"
)

type Status int64

const (
	Undefined Status = iota
	KYCUser
	HumanUnique
	NotFound
)

func (s Status) String() string {
	switch s {
	case KYCUser:
		return "kyc-user"
	case HumanUnique:
		return "human-unique"
	default:
		return "undefined"
	}
}

type Unit struct {
	Address      common.Address `json:"address" structs:"-"`
	Status       Status         `json:"status" structs:"status"`
	CreationDate time.Time      `json:"creation_date" structs:"-"`
	KYCDate      time.Time      `json:"kyc_date" structs:"kyc_date"`
}

type Response struct {
	Unit    Unit   `json:"data"`
	Error   string `json:"error"`
	Success bool   `json:"success"`
}
