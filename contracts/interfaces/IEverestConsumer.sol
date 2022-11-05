// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface IEverestConsumer {
    enum Status {
        // Address does not exist
        NotFound,
        // KYC User status
        KYCUser,
        // Human & Unique status
        HumanAndUnique
    }

    struct Request {
        bool isFulfilled; // 1 byte - slot 0
        bool isCanceled; // 1 byte - slot 0
        bool isHumanAndUnique; // 1 byte - slot 0
        bool isKYCUser; // 1 byte - slot 0
        address revealer; // 20 bytes - slot 0
        address revealee; // 20 bytes - slot 1
        // `kycTimestamp` is zero if the status is not `KYCUser`,
        // otherwise it is an epoch timestamp that represents the KYC date
        uint40 kycTimestamp; // 5 bytes - slot 1
        // expiration = block.timestamp while `requestStatus` + 5 minutes.
        // If `isFulfilled` and `isCanceled` are false by this time -
        // the the owner of the request can cancel its
        // request using `cancelRequest` and return paid link tokens
        uint40 expiration; // 5 bytes - slot 1
    }

    function latestSentRequestId(
        address _revealer
    ) external view returns (bytes32);

    function latestFulfilledRequestId(
        address _revealee
    ) external view returns (bytes32);

    function signUpURL() external view returns (string memory);

    function jobId() external view returns (bytes32);

    /// @notice Oracle payment. Call this method to get a current request price. Please,
    /// make sure that the EverestConsumer contract has enough allowance before requesting
    /// @return price A current request price
    function oraclePayment() external view returns (uint256 price);

    /// @notice Request status. You should approve link token spending
    /// for the EverestConsumer contract first. You can also check a current
    /// request price in link tokens calling an `oraclePayment()` method.
    /// @param _revealee An address of the person which KYC status you want to get.
    function requestStatus(address _revealee) external;

    /// @notice Fulfill. Only an operator contract should call this method
    /// @param _requestId id An id of the request to be fulfilled
    /// @param _status A KYC status from the everest API response:
    /// 0 - `NotFound`: `isHumanAndUnique`=false and `isKYCUser`=false
    /// 1 - `HumanAndUnique`: `isHumanAndUnique`=true and `isKYCUser`=false
    /// 2 - `NotFound`: `isHumanAndUnique`=true and `isKYCUser`=true
    /// @param _kycTimestamp A KYC timestamp from the everest API response
    function fulfill(
        bytes32 _requestId,
        Status _status,
        uint40 _kycTimestamp
    ) external;

    /// @notice Cancel request. If you don't get response for 5 minutes, you can
    /// call this function to return funds
    /// @param _requestId An id of the request to be cancelled
    function cancelRequest(bytes32 _requestId) external;

    /// @notice Get request. Call this method to get a current status of the request
    /// @param _requestId An id of the request you want to get
    /// @return request Request & response data
    function getRequest(
        bytes32 _requestId
    ) external view returns (Request memory request);

    function getLatestFulfilledRequest(
        address _revealee
    ) external view returns (Request memory);

    function setSignUpURL(string memory _signUpURL) external;

    function getLatestSentRequestId() external view returns (bytes32);

    function requestExists(bytes32 _requestId) external view returns (bool);

    function statusToString(
        Status _status
    ) external view returns (string memory);

    function setOracle(address _oracle) external;

    function setLink(address _link) external;

    function setOraclePayment(uint256 _oraclePayment) external;

    function setJobId(string memory _jobId) external;

    function oracleAddress() external view returns (address);

    function linkAddress() external view returns (address);
}
