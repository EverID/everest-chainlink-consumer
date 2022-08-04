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
	path          = "/everest-chainlink/status/%s"
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
	address := h.GetParam(endpointParam)

	a.logger.WithField("address", address).Info("got request")

	data, err := h.HTTPCallRawWithOpts(
		http.MethodGet,
		a.cfg.ChainlinkServiceURL+fmt.Sprintf(path, address),
		bridges.CallOpts{
			Auth: bridges.NewAuth(bridges.AuthHeader, apiKeyHeader, a.cfg.ApiKey),
		},
	)
	if err != nil {
		a.logger.WithError(err).Error("failed to make request")
		return nil, errors.Wrap(err, "failed to make request")
	}

	unit, err := a.safeUnpack(data, address)
	if err != nil {
		a.logger.WithError(err).Error("failed to safely unpack data")
		return nil, errors.Wrap(err, "failed to safely unpack data")
	}

	a.logger.WithField("unit", fmt.Sprintf("%+v", unit)).Info("got unit")

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

func (a *unitExternalAdapter) safeUnpack(data []byte, _ string) (model.Unit, error) {
	var response model.Response
	if err := json.Unmarshal(data, &response); err != nil {
		return model.Unit{}, err
	}

	a.logger.WithField("response", fmt.Sprintf("%+v", response)).Debug("got response")

	if !response.Success {
		return model.Unit{}, errors.New(response.Error)
	}

	switch response.Unit.Status {
	case model.KYCUser:
		if response.Unit.KYCDate.IsZero() {
			return model.Unit{}, errors.New("kyc date for kyc user status should not be zero")
		}
		if response.Unit.CreationDate.IsZero() {
			return model.Unit{}, errors.New("creation date for kyc user status should not be zero")
		}
	case model.NotFound:
		if !response.Unit.KYCDate.IsZero() {
			return model.Unit{}, errors.New("kyc date for not found status should be zero")
		}
		if !response.Unit.CreationDate.IsZero() {
			return model.Unit{}, errors.New("creation date for not found status should be zero")
		}
	case model.HumanUnique:
		if !response.Unit.KYCDate.IsZero() {
			return model.Unit{}, errors.New("kyc date for human unique status should be zero")
		}
		if response.Unit.CreationDate.IsZero() {
			return model.Unit{}, errors.New("creation date for human unique status should not be zero")
		}
	default:
		return model.Unit{}, errors.New("unexpected status")
	}

	return response.Unit, nil
}
