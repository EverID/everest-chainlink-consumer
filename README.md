# everest-chainlink-consumer

Consumer contract & chainlink job & external adapter for KYC data.

### 0. Required fields

```yaml
externalJobId: "14f84981-6fac-426a-bda2-992cbf47d2cd", // gen by the chainlink node
oracleAddr: "0xB9756312523826A566e222a34793E414A81c88E1", // Operator.sol
payment: "100000000000000000", // job/job.toml/minContractPaymentLinkJuels
linktoken: "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39" // LinkTokenInterface.sol
```

### 1. Contracts deployments

In this example we will use metamask & remix.

- Open everest-chainlink-consumer/contracts, copy LinkTokenInterface.sol, Operator.sol, EverestConsumer.sol files to remix, choose polygon network.
- Compile LinkTokenInterface.sol and add it using "linktoken" address.
- Compile Operator.sol and add it using "oracleAddr".
- Compile EverestConsumer.sol and deploy it using the next params:  
```solidity
constructor(
    address _link, // "linktoken"
    address _oracle, // "oracleAddr"
    string memory _jobId, // "externalJobId"
    uint256 _oraclePayment, // "payment"
    string memory _signUpURL // desired signUp URL
)
````

### 2. How to make a request

- Allow EverestConsumer contract spend your link tokens:  
```solidity
LinkTokenInterface.approve(
    address spender, // everest consumer contract
    uint256 value // more than "payment"
)
```
- Request the status (this method also makes transferFrom):
```solidity
EverestConsumer.requestStatus(
    address _revealee // desired address
)
```
- Retrieve your latest requestId calling this method:
```solidity
EverestConsumer.getLatestSentRequestId()
```
- Wait about 2-3 minutes before the request will be fulfilled.
- You can get any request by ID or the latest fulfilled request by the address using the following methods:
```solidity
EverestConsumer.getRequest(bytes32 _requestId)
EverestConsumer.getLatestFulfilledRequest(address _revealee)
```
- If getRequest method returns isFulfilled=false for 5 minutes, you can cancel your request and return funds using:
```solidity
EverestConsumer.cancelRequest(bytes32 _requestId)
```

### 3. Withdraw paid link tokens

- To withdraw tokens we need an ownership of the operator (oracle) contract.
- Call withdraw function:
```solidity
Operator.withdraw(address recipient, uint256 amount)
```
