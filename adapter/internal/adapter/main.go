package adapter

import (
	"encoding/json"
	"fmt"
	"net/http"

	"adapter/internal/config"
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
		errStr := "failed to make request"
		a.logger.WithError(err).Error(errStr)
		return nil, errors.Wrap(err, errStr)
	}
	a.logger.Debug("got response")

	var response Response
	if err = json.Unmarshal(data, &response); err != nil {
		errStr := "failed to unmarshal response"
		a.logger.WithError(err).Error(errStr)
		return nil, errors.Wrap(err, errStr)
	}

	logWithResponse := a.logger.WithField("response", fmt.Sprintf("%#v", response))
	logWithResponse.Debug("bound response")

	if !response.Success {
		err := errors.New(response.Error)
		errStr := "unsuccessful response"
		a.logger.WithError(err).Error(errStr)
		return nil, errors.Wrap(err, errStr)
	}
	logWithResponse.Debug("response is successful")

	if err = response.KYCPayload.Validate(); err != nil {
		errStr := "failed to validate"
		a.logger.WithError(err).Error(errStr)
		return nil, errors.Wrap(err, errStr)
	}
	logWithResponse.Debug("validated response")

	return map[string]interface{}{
		"status": func() Status {
			if !response.KYCPayload.IsHumanAndUniqueUser {
				return NotFound
			}
			if !response.KYCPayload.IsKYCUser {
				return HumanUnique
			}
			return KYCUser
		}(),
		"kyc_timestamp": func() int64 {
			if response.KYCPayload.KYCDate == nil {
				return 0
			}
			return response.KYCPayload.KYCDate.Unix()
		}(),
	}, nil
}

func (a *unitExternalAdapter) Opts() *bridges.Opts {
	return &bridges.Opts{
		Name: adapterName,
	}
}
