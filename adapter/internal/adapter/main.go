package adapter

import (
	"encoding/json"
	"fmt"
	"net/http"

	"adapter/internal/config"
	"adapter/internal/model"
	"github.com/ethereum/go-ethereum/common"
	"github.com/linkpoolio/bridges"
	"github.com/pkg/errors"
	"gitlab.com/distributed_lab/logan/v3"
)

const (
	adapterName   = "Unit External Adapter"
	apiKeyHeader  = "X-Api-Key"
	endpointParam = "address"
)

func NewAdapter(cfg config.AdapterConfig, logger *logan.Entry) bridges.Bridge {
	return &unitExternalAdapter{
		cfg:    cfg,
		logger: logger,
	}
}

type unitExternalAdapter struct {
	cfg    config.AdapterConfig
	logger *logan.Entry
}

func (a *unitExternalAdapter) Run(h *bridges.Helper) (interface{}, error) {
	data, err := h.HTTPCallRawWithOpts(
		http.MethodGet,
		fmt.Sprintf("%s%s", a.cfg.ChainlinkServiceAddr, h.GetParam(endpointParam)),
		bridges.CallOpts{
			Auth: bridges.NewAuth(bridges.AuthHeader, apiKeyHeader, a.cfg.ApiKey),
		},
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to make request")
	}

	unit, err := safeUnpack(data)
	if err != nil {
		return nil, errors.Wrap(err, "failed to safely unpack data")
	}

	return map[string]interface{}{
		"status": unit.Status,
		"kyc_timestamp": func() int64 {
			if unit.KYCDate.IsZero() {
				return 0
			}
			return unit.KYCDate.Unix()
		}(),
	}, nil
}

func (a *unitExternalAdapter) Opts() *bridges.Opts {
	return &bridges.Opts{
		Name: adapterName,
	}
}

func safeUnpack(data []byte) (model.Unit, error) {
	var response model.Response
	if err := json.Unmarshal(data, &response); err != nil {
		return model.Unit{}, err
	}

	zeroAddress := common.Address{}
	if response.Unit.Address.String() != zeroAddress.String() {
		return model.Unit{}, errors.New("zero address")
	}

	if response.Unit.CreationDate.Unix() == 0 {
		return model.Unit{}, errors.New("wrong creation date")
	}

	switch response.Unit.Status {
	case model.KYCUser:
		if response.Unit.KYCDate.Unix() == 0 {
			return model.Unit{}, errors.New("kyc date for kyc users should not be zero")
		}
	default:
		if response.Unit.KYCDate.Unix() != 0 {
			return model.Unit{}, errors.New("kyc date for non-kyc users should be zero")
		}
	}

	return response.Unit, nil
}
