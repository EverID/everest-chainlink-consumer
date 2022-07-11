# everest-chainlink-consumer

An external adapter and a chainlink node

# setup

## node/database.env

```POSTGRES_PASSWORD=admin```

```POSTGRES_USER=admin```

```POSTGRES_DB=chainlink```

## node/.env

```ETH_CHAIN_ID=42```
- Ethereum chain ID (42 for testing on kovan)

```DATABASE_URL=postgresql://admin:admin@db:5432/chainlink?sslmode=disable```
- Chainlink database url (look node/database.env)

```ETH_URL=wss://kovan.infura.io/ws/v3/{KEY}```
- Ethereum url

```ROOT=/chainlink```
- Left default value

```LOG_LEVEL=debug```
- Log level

```CHAINLINK_TLS_PORT=0```
- Chainlink TLS port

```SECURE_COOKIES=false```
- Secure cookies

```ALLOW_ORIGINS=*```
- Allow origins

## adapter/.env

### LOG

```LOG_DISABLE_SENTRY=true```
- Could be true or false

```LOG_LEVEL=debug```
- Could be panic/fatal/error/warn or warning/info/debug/trace

### ADAPTER

```ADAPTER_API_KEY=KEY```
- API_KEY for the external adapter (to communicate with everest-chainlink service)

```ADAPTER_CHAINLINK_SERVICE_ENDPOINT={EVEREST_CHAINLINK}/everest-chainlink/status/```
- Endpoint in everest-chainlink service from which adapter will take status by address

```ADAPTER_PORT=8085```
- Adapter port
