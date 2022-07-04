package config

import (
	"gitlab.com/distributed_lab/kit/comfig"
	"gitlab.com/distributed_lab/kit/kv"
)

type Config interface {
	comfig.Logger
	Adapter
}

type config struct {
	comfig.Logger
	Adapter
}

func New(getter kv.Getter) Config {
	return &config{
		Logger:  comfig.NewLogger(getter, comfig.LoggerOpts{}),
		Adapter: NewAdapter(getter),
	}
}
