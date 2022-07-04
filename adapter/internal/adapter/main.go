package adapter

import (
	"fmt"
	"net/http"

	"adapter/internal/config"
	"github.com/linkpoolio/bridges"
	"gitlab.com/distributed_lab/logan/v3"
)

const (
	adapterName   = "Unit External Adapter"
	apiKeyHeader  = "X-Api-Key"
	endpointParam = "address" // address
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

type Response struct {
	Status    uint
	Timestamp uint
}

func (a *unitExternalAdapter) Run(h *bridges.Helper) (interface{}, error) {
	data, err := h.HTTPCallRawWithOpts(
		http.MethodGet,
		fmt.Sprintf("%s/%s", a.cfg.ChainlinkServiceAddr, h.GetParam(endpointParam)),
		bridges.CallOpts{
			Auth: bridges.NewAuth(bridges.AuthHeader, apiKeyHeader, a.cfg.ApiKey),
		},
	)
	return data, err
}

func (a *unitExternalAdapter) Opts() *bridges.Opts {
	return &bridges.Opts{
		Name: adapterName,
	}
}
