package config

import (
	"github.com/pkg/errors"
	"gitlab.com/distributed_lab/figure"
	"gitlab.com/distributed_lab/kit/comfig"
	"gitlab.com/distributed_lab/kit/kv"
	"gitlab.com/tokend/keypair/figurekeypair"
)

const adapterMapId = "adapter"

type Adapter interface {
	AdapterConfig() AdapterConfig
}

type AdapterConfig struct {
	ApiKey                   string `fig:"api_key,required"`
	ChainlinkServiceEndpoint string `fig:"chainlink_service_url,required"`
	Port                     int    `fig:"port,required"`
}

type adapter struct {
	once   comfig.Once
	getter kv.Getter
}

func (u *adapter) AdapterConfig() AdapterConfig {
	return u.once.Do(func() interface{} {
		var cfg AdapterConfig
		err := figure.
			Out(&cfg).
			With(figure.BaseHooks, figurekeypair.Hooks).
			From(kv.MustGetStringMap(u.getter, adapterMapId)).
			Please()

		if err != nil {
			panic(errors.Wrap(err, "failed to figure out adapter"))
		}

		return cfg
	}).(AdapterConfig)
}

func NewAdapter(getter kv.Getter) Adapter {
	return &adapter{
		getter: getter,
	}
}
