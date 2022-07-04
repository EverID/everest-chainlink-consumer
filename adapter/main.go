package main

import (
	"adapter/internal/adapter"
	"adapter/internal/config"
	"adapter/internal/getter"
	"github.com/linkpoolio/bridges"
	"gitlab.com/distributed_lab/logan/v3"
)

func main() {
	defer func() {
		if rvr := recover(); rvr != nil {
			logan.New().WithRecover(rvr).Error("app panicked")
		}
	}()

	cfg := config.New(getter.NewGetter())

	ea := adapter.NewAdapter(cfg.AdapterConfig(), cfg.Log())

	bridges.NewServer(ea).Start(cfg.AdapterConfig().Port)
}
