// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract UnitConsumer is ChainlinkClient, Ownable {
    using Chainlink for Chainlink.Request;

    enum Status {
        Undefined,
        KYCUser,
        HumanUnique
    }

    struct Request {
        // `kycTimestamp` is zero if the status is not `KYCUser`,
        // otherwise it is an epoch timestamp that represents the KYC date
        uint kycTimestamp;
        address revealer;
        address revealee;
        Status status;
    }

    mapping(bytes32 => Request) private _requests;
    bytes32 public jobId;
    uint public oraclePayment;

    event Requested(
        bytes32 _requestId,
        address indexed _revealer,
        address indexed _revealee
    );

    event Fulfilled(
        bytes32 _requestId,
        address indexed _revealer,
        address indexed _revealee,
        Status _status,
        uint _kycTimestamp
    );

    constructor(
        address _link,
        address _oracle,
        string memory _jobId,
        uint _oraclePayment
    )
    {
        setChainlinkToken(_link);
        setChainlinkOracle(_oracle);
        jobId = stringToBytes32(_jobId);
        oraclePayment = _oraclePayment;
    }

    function requestStatus(
        address _revealee
    )
        external
        returns (bytes32 requestId)
    {
        require(_revealee != address(0), "Revelaee should not be zero address.");
        require(
            IERC20(chainlinkTokenAddress()).transferFrom(msg.sender, address(this), oraclePayment),
            "Failed to transfer link token."
        );

        Chainlink.Request memory request = buildChainlinkRequest(
            jobId,
            address(this),
            this.fulfill.selector
        );
        request.add("address", Strings.toHexString(_revealee));
        requestId = sendChainlinkRequest(request, oraclePayment);

        _requests[requestId] = Request({
            kycTimestamp: 0,
            revealer: msg.sender,
            revealee: _revealee,
            status: Status.Undefined
        });

        emit Requested(requestId, msg.sender, _revealee);
    }

    function fulfill(
        bytes32 _requestId,
        Status _status,
        uint _kycTimestamp
    )
        external
        recordChainlinkFulfillment(_requestId)
    {
        if (_status == Status.KYCUser) {
            require(_kycTimestamp != 0, "_kycTimestamp should not be zero for KYCUser.");
        } else {
            require(_kycTimestamp == 0, "_kycTimestamp should be zero for non-KYCUser.");
        }
        _requests[_requestId].status = _status;
        _requests[_requestId].kycTimestamp = _kycTimestamp;

        emit Fulfilled(
            _requestId,
            _requests[_requestId].revealer,
            _requests[_requestId].revealee,
            _status,
            _kycTimestamp
        );
    }

    function getRequest(
        bytes32 _requestId
    )
        external
        view
        returns (Request memory)
    {
        require(requestExists(_requestId), "Request does not exist.");

        return _requests[_requestId];
    }

    function requestExists(
        bytes32 _requestId
    )
        public
        view
        returns (bool)
    {
        return _requests[_requestId].revealer != address(0);
    }

    function statusToString(
        Status _status
    )
        external
        pure
        returns (string memory)
    {
        if (_status == Status.Undefined) {
            return "undefined";
        }
        if (_status == Status.KYCUser) {
            return "kyc-user";
        }
        return "human-unique";
    }

    function withdrawLink() external onlyOwner {
        LinkTokenInterface link = LinkTokenInterface(chainlinkTokenAddress());
        require(link.transfer(msg.sender, link.balanceOf(address(this))), "Unable to transfer.");
    }

    function setOracle(address _oracle) external onlyOwner {
        setChainlinkOracle(_oracle);
    }

    function setLink(address _link) external onlyOwner {
        setChainlinkToken(_link);
    }

    function setOraclePayment(uint _oraclePayment) external onlyOwner {
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
        require(source.length == 32, "Incorrect length.");
        return bytes32(source);
    }
}
