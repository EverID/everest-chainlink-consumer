package getter

import (
	"os"

	"github.com/spf13/viper"
	"gitlab.com/distributed_lab/kit/kv"
)

func NewGetter() kv.Getter {
	gttr := &getter{}
	gttr.init()
	return gttr
}

type getter struct {
	vpr *viper.Viper
}

func (g *getter) GetStringMap(key string) (map[string]interface{}, error) {
	return g.vpr.GetStringMap(key), nil
}

func (g *getter) init() {
	g.vpr = viper.New()
	g.vpr.AutomaticEnv()

	g.bind("log.disable_sentry", "LOG_DISABLE_SENTRY")
	g.bind("log.level", "LOG_LEVEL")

	g.bind("adapter.api_key", "ADAPTER_API_KEY")
	g.bind("adapter.chainlink_service_url", "ADAPTER_CHAINLINK_SERVICE_URL")
	g.bind("adapter.port", "ADAPTER_PORT")

	for _, key := range g.vpr.AllKeys() {
		g.vpr.Set(key, g.vpr.Get(key))
	}
}

func (g *getter) bind(alias, env string) {
	if val, ok := os.LookupEnv(env); ok && len(val) != 0 {
		_ = g.vpr.BindEnv(alias, env)
	}
}
