// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IEverestConsumer.sol";

error EverestConsumer__RequestDoesNotExist();
error EverestConsumer__RevealeeShouldNotBeZeroAddress();
error EverestConsumer__KycTimestampShouldNotBeZeroForKycUser();
error EverestConsumer__KycTimestampShouldBeZeroForNonKycUser();
error EverestConsumer__RequestAlreadyHandled();
error EverestConsumer__NotOwnerOfRequest();
error EverestConsumer__NoRequestsYet();
error EverestConsumer__IncorrectLength();

contract EverestConsumer is IEverestConsumer, ChainlinkClient, Ownable {
    using Chainlink for Chainlink.Request;
    using SafeERC20 for IERC20;

    uint40 private constant OPERATOR_EXPIRATION_TIME = 5 minutes;

    // latest sent request id by revealer address
    mapping(address => bytes32) public override latestSentRequestId;

    // latest fulfilled request id by revealee address
    mapping(address => bytes32) public override latestFulfilledRequestId;

    mapping(bytes32 => Request) private _requests;

    string public override signUpURL;
    bytes32 public override jobId;
    uint256 public override oraclePayment;

    event Requested(bytes32 _requestId, address indexed _revealer, address indexed _revealee, uint40 _expiration);

    event Fulfilled(
        bytes32 _requestId, address indexed _revealer, address indexed _revealee, Status _status, uint40 _kycTimestamp
    );

    modifier ifRequestExists(bytes32 requestId) {
        if (!requestExists(requestId)) {
            revert EverestConsumer__RequestDoesNotExist();
        }
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

    function requestStatus(address _revealee) external override {
        if (_revealee == address(0)) {
            revert EverestConsumer__RevealeeShouldNotBeZeroAddress();
        }

        IERC20(chainlinkTokenAddress()).safeTransferFrom(msg.sender, address(this), oraclePayment);

        Chainlink.Request memory request = buildOperatorRequest(jobId, this.fulfill.selector);
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

    function fulfill(bytes32 _requestId, Status _status, uint40 _kycTimestamp)
        external
        override
        recordChainlinkFulfillment(_requestId)
    {
        if (_status == Status.KYCUser) {
            if (_kycTimestamp == 0) {
                revert EverestConsumer__KycTimestampShouldNotBeZeroForKycUser();
            }
        } else {
            if (_kycTimestamp != 0) {
                revert EverestConsumer__KycTimestampShouldBeZeroForNonKycUser();
            }
        }

        Request storage request = _requests[_requestId];
        request.kycTimestamp = _kycTimestamp;
        request.isFulfilled = true;
        request.isHumanAndUnique = _status != Status.NotFound;
        request.isKYCUser = _status == Status.KYCUser;
        latestFulfilledRequestId[request.revealee] = _requestId;

        emit Fulfilled(_requestId, request.revealer, request.revealee, _status, _kycTimestamp);
    }

    function cancelRequest(bytes32 _requestId) external override ifRequestExists(_requestId) {
        Request storage request = _requests[_requestId];
        if (request.isCanceled || request.isFulfilled) {
            revert EverestConsumer__RequestAlreadyHandled();
        }

        if (request.revealer != msg.sender) {
            revert EverestConsumer__NotOwnerOfRequest();
        }
        cancelChainlinkRequest(_requestId, oraclePayment, this.fulfill.selector, request.expiration);
        IERC20(chainlinkTokenAddress()).safeTransfer(msg.sender, oraclePayment);
        request.isCanceled = true;
    }

    function getRequest(bytes32 _requestId) public view override ifRequestExists(_requestId) returns (Request memory) {
        return _requests[_requestId];
    }

    function getLatestFulfilledRequest(address _revealee) external view override returns (Request memory) {
        return getRequest(latestFulfilledRequestId[_revealee]);
    }

    function setSignUpURL(string memory _signUpURL) external override onlyOwner {
        signUpURL = _signUpURL;
    }

    function getLatestSentRequestId() external view override returns (bytes32) {
        if (latestSentRequestId[msg.sender] == 0) {
            revert EverestConsumer__NoRequestsYet();
        }

        return latestSentRequestId[msg.sender];
    }

    function requestExists(bytes32 _requestId) public view override returns (bool) {
        return _requests[_requestId].revealer != address(0);
    }

    function statusToString(Status _status) external pure override returns (string memory) {
        if (_status == Status.KYCUser) {
            return "KYC_USER";
        }
        if (_status == Status.HumanAndUnique) {
            return "HUMAN_AND_UNIQUE";
        }
        return "NOT_FOUND";
    }

    function setOracle(address _oracle) external override onlyOwner {
        setChainlinkOracle(_oracle);
    }

    function setLink(address _link) external override onlyOwner {
        setChainlinkToken(_link);
    }

    function setOraclePayment(uint256 _oraclePayment) external override onlyOwner {
        oraclePayment = _oraclePayment;
    }

    function setJobId(string memory _jobId) external override onlyOwner {
        jobId = stringToBytes32(_jobId);
    }

    function oracleAddress() external view override returns (address) {
        return chainlinkOracleAddress();
    }

    function linkAddress() external view override returns (address) {
        return chainlinkTokenAddress();
    }

    function stringToBytes32(string memory _source) private pure returns (bytes32) {
        bytes memory source = bytes(_source);
        if (source.length != 32) {
            revert EverestConsumer__IncorrectLength();
        }

        return bytes32(source);
    }
}
