// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract UnitConsumer is ChainlinkClient, Ownable {
    using Chainlink for Chainlink.Request;
    using SafeERC20 for IERC20;

    enum Status {
        // KYSUser status
        KYCUser,
        // Human & Unique status
        HumanUnique,
        // Request is fulfilled and address is absent in the system
        NotFound
    }

    struct Request {
        bool isFulfilled;
        bool isCanceled;

        bool isHumanAndUnique;
        bool isKYCUser;

        address revealer;
        address revealee;

        // `kycTimestamp` is zero if the status is not `KYCUser`,
        // otherwise it is an epoch timestamp that represents the KYC date
        uint256 kycTimestamp;

        // expiration = block.timestamp while `requestStatus` + 5 minutes.
        // If `isFulfilled` and `isCanceled` are false by this time -
        // the the owner of the request can cancel its
        // request using `cancelRequest` and return paid link tokens
        uint256 expiration;
    }

    mapping(address => bytes32) private _lastRequestId;
    mapping(bytes32 => Request) private _requests;

    string public signUpURL;
    bytes32 public jobId;
    uint256 public oraclePayment;

    event Requested(
        bytes32 _requestId,
        address indexed _revealer,
        address indexed _revealee,
        uint256 _expiration
    );

    event Fulfilled(
        bytes32 _requestId,
        address indexed _revealer,
        address indexed _revealee,
        Status _status,
        uint256 _kycTimestamp
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
    )
    {
        setChainlinkToken(_link);
        setChainlinkOracle(_oracle);
        jobId = stringToBytes32(_jobId);
        oraclePayment = _oraclePayment;
        signUpURL = _signUpURL;
    }

    function requestStatus(address _revealee) external {
        require(_revealee != address(0), "Revelaee should not be zero address");

        IERC20(chainlinkTokenAddress()).safeTransferFrom(msg.sender, address(this), oraclePayment);

        Chainlink.Request memory request = buildChainlinkRequest(
            jobId,
            address(this),
            this.fulfill.selector
        );
        request.add("address", Strings.toHexString(_revealee));

        bytes32 requestId = sendChainlinkRequest(request, oraclePayment);

        uint256 expiration = block.timestamp + 5 minutes;
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
        _lastRequestId[msg.sender] = requestId;

        emit Requested(requestId, msg.sender, _revealee, expiration);
    }

    function fulfill(
        bytes32 _requestId,
        Status _status,
        uint256 _kycTimestamp
    )
        external
        recordChainlinkFulfillment(_requestId)
    {
        if (_status == Status.KYCUser) {
            require(_kycTimestamp != 0, "_kycTimestamp should not be zero for KYCUser");
        } else {
            require(_kycTimestamp == 0, "_kycTimestamp should be zero for non-KYCUser");
        }

        Request storage request = _requests[_requestId];
        request.kycTimestamp = _kycTimestamp;
        request.isFulfilled = true;
        request.isHumanAndUnique = _status != Status.NotFound;
        request.isKYCUser = _status == Status.KYCUser;

        emit Fulfilled(
            _requestId,
            request.revealer,
            request.revealee,
            _status,
            _kycTimestamp
        );
    }

    function cancelRequest(bytes32 _requestId) external ifRequestExists(_requestId) {
        Request storage request = _requests[_requestId];
        require(!request.isCanceled && !request.isFulfilled, "Request should not be canceled or fulfilled");
        require(request.revealer == msg.sender, "You are not an owner of the request");
        cancelChainlinkRequest(_requestId, oraclePayment, this.fulfill.selector, request.expiration);
        IERC20(chainlinkTokenAddress()).safeTransfer(msg.sender, oraclePayment);
        request.isCanceled = true;
    }

    function getRequest(
        bytes32 _requestId
    )
        external
        view
        ifRequestExists(_requestId)
        returns (Request memory)
    {
        return _requests[_requestId];
    }

    function setSignUpURL(string memory _signUpURL) external onlyOwner {
        signUpURL = _signUpURL;
    }

    function getLastRequestId() external view returns (bytes32) {
        require(_lastRequestId[msg.sender] != 0, "No requests yet");

        return _lastRequestId[msg.sender];
    }

    function requestExists(bytes32 _requestId) public view returns (bool) {
        return _requests[_requestId].revealer != address(0);
    }

    function statusToString(Status _status) external pure returns (string memory) {
        if (_status == Status.KYCUser) {
            return "KYC_USER";
        }
        if (_status == Status.HumanUnique) {
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