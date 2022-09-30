// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract EverestConsumer is ChainlinkClient, Ownable {
    using Chainlink for Chainlink.Request;
    using SafeERC20 for IERC20;

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

    uint40 private constant OPERATOR_EXPIRATION_TIME = 5 minutes;

    // latest sent request id by revealer address
    mapping(address => bytes32) public latestSentRequestId;

    // latest fulfilled request id by revealee address
    mapping(address => bytes32) public latestFulfilledRequestId;

    mapping(bytes32 => Request) private _requests;

    string public signUpURL;
    bytes32 public jobId;
    uint256 public oraclePayment;

    event Requested(
        bytes32 _requestId,
        address indexed _revealer,
        address indexed _revealee,
        uint40 _expiration
    );

    event Fulfilled(
        bytes32 _requestId,
        address indexed _revealer,
        address indexed _revealee,
        Status _status,
        uint40 _kycTimestamp
    );

    modifier ifRequestExists(bytes32 requestId) {
        require(requestExists(requestId), "Request does not exist");
        _;
    }

    constructor(
        address _link,
        address _oracle,
        string memory _jobId,
        uint256 _oraclePayment,
        string memory _signUpURL
    ) {
        setChainlinkToken(_link);
        setChainlinkOracle(_oracle);
        jobId = stringToBytes32(_jobId);
        oraclePayment = _oraclePayment;
        signUpURL = _signUpURL;
    }

    function requestStatus(address _revealee) external {
        require(_revealee != address(0), "Revelaee should not be zero address");

        IERC20(chainlinkTokenAddress()).safeTransferFrom(
            msg.sender,
            address(this),
            oraclePayment
        );

        Chainlink.Request memory request = buildOperatorRequest(
            jobId,
            this.fulfill.selector
        );
        request.addBytes("address", abi.encode(_revealee));

        bytes32 requestId = sendOperatorRequest(request, oraclePayment);

        uint40 expiration = uint40(block.timestamp) + OPERATOR_EXPIRATION_TIME;
        _requests[requestId] = Request({
            isFulfilled: false,
            isCanceled: false,
            isHumanAndUnique: false,
            isKYCUser: false,
            revealer: msg.sender,
            revealee: _revealee,
            kycTimestamp: 0,
            expiration: expiration
        });
        latestSentRequestId[msg.sender] = requestId;

        emit Requested(requestId, msg.sender, _revealee, expiration);
    }

    function fulfill(
        bytes32 _requestId,
        Status _status,
        uint40 _kycTimestamp
    ) external recordChainlinkFulfillment(_requestId) {
        if (_status == Status.KYCUser) {
            require(
                _kycTimestamp != 0,
                "_kycTimestamp should not be zero for KYCUser"
            );
        } else {
            require(
                _kycTimestamp == 0,
                "_kycTimestamp should be zero for non-KYCUser"
            );
        }

        Request storage request = _requests[_requestId];
        request.kycTimestamp = _kycTimestamp;
        request.isFulfilled = true;
        request.isHumanAndUnique = _status != Status.NotFound;
        request.isKYCUser = _status == Status.KYCUser;
        latestFulfilledRequestId[request.revealee] = _requestId;

        emit Fulfilled(
            _requestId,
            request.revealer,
            request.revealee,
            _status,
            _kycTimestamp
        );
    }

    function cancelRequest(bytes32 _requestId)
        external
        ifRequestExists(_requestId)
    {
        Request storage request = _requests[_requestId];
        require(
            !request.isCanceled && !request.isFulfilled,
            "Request should not be canceled or fulfilled"
        );
        require(
            request.revealer == msg.sender,
            "You are not an owner of the request"
        );
        cancelChainlinkRequest(
            _requestId,
            oraclePayment,
            this.fulfill.selector,
            request.expiration
        );
        IERC20(chainlinkTokenAddress()).safeTransfer(msg.sender, oraclePayment);
        request.isCanceled = true;
    }

    function getRequest(bytes32 _requestId)
        public
        view
        ifRequestExists(_requestId)
        returns (Request memory)
    {
        return _requests[_requestId];
    }

    function getLatestFulfilledRequest(address _revealee)
        external
        view
        returns
        (Request memory)
    {
        return getRequest(latestFulfilledRequestId[_revealee]);
    }

    function setSignUpURL(string memory _signUpURL) external onlyOwner {
        signUpURL = _signUpURL;
    }

    function getLatestSentRequestId() external view returns (bytes32) {
        require(latestSentRequestId[msg.sender] != 0, "No requests yet");

        return latestSentRequestId[msg.sender];
    }

    function requestExists(bytes32 _requestId) public view returns (bool) {
        return _requests[_requestId].revealer != address(0);
    }

    function statusToString(Status _status)
        external
        pure
        returns (string memory)
    {
        if (_status == Status.KYCUser) {
            return "KYC_USER";
        }
        if (_status == Status.HumanAndUnique) {
            return "HUMAN_AND_UNIQUE";
        }
        return "NOT_FOUND";
    }

    function setOracle(address _oracle) external onlyOwner {
        setChainlinkOracle(_oracle);
    }

    function setLink(address _link) external onlyOwner {
        setChainlinkToken(_link);
    }

    function setOraclePayment(uint256 _oraclePayment) external onlyOwner {
        oraclePayment = _oraclePayment;
    }

    function setJobId(string memory _jobId) external onlyOwner {
        jobId = stringToBytes32(_jobId);
    }

    function oracleAddress() external view returns (address) {
        return chainlinkOracleAddress();
    }

    function linkAddress() external view returns (address) {
        return chainlinkTokenAddress();
    }

    function stringToBytes32(string memory _source)
        private
        pure
        returns (bytes32)
    {
        bytes memory source = bytes(_source);
        require(source.length == 32, "Incorrect length");
        return bytes32(source);
    }
}