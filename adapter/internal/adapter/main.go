package adapter

import (
	"encoding/json"
	"fmt"
	"net/http"

	"adapter/internal/config"
	"adapter/internal/model"
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
		fmt.Sprintf("%s/everest-chainlink/status/%s", a.cfg.ChainlinkServiceAddr, h.GetParam(endpointParam)),
		bridges.CallOpts{
			Auth: bridges.NewAuth(bridges.AuthHeader, apiKeyHeader, a.cfg.ApiKey),
		},
	)
	if err != nil {
		return nil, err
	}

	var response model.Response
	if err = json.Unmarshal(data, &response); err != nil {
		return nil, err
	}

	if response.Unit.Address.String() != h.GetParam(endpointParam) {
		return nil, errors.New("wrong address")
	}

	if response.Unit.CreationDate.Unix() == 0 {
		return nil, errors.New("wrong creation date")
	}

	switch response.Unit.Status {
	case model.KYCUser:
		if response.Unit.KYCDate.Unix() == 0 {
			return nil, errors.New("kyc date for kyc users should not be zero")
		}
	default:
		if response.Unit.KYCDate.Unix() != 0 {
			return nil, errors.New("kyc date for non-kyc users should be zero")
		}
	}

	return map[string]interface{}{
		"status":        response.Unit.Status,
		"kyc_timestamp": response.Unit.KYCDate.Unix(),
	}, nil
}

func (a *unitExternalAdapter) Opts() *bridges.Opts {
	return &bridges.Opts{
		Name: adapterName,
	}
}
