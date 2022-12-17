// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "./interfaces/IExampleContract.sol";
import "./interfaces/IEverestConsumer.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";

contract ExampleContract is IExampleContract {
    using SafeERC20 for IERC20;

    mapping(address => bytes32) private _latestSentRequestId;

    IEverestConsumer public everestConsumer;

    constructor(address _everestConsumer) {
        everestConsumer = IEverestConsumer(_everestConsumer);
    }

    function requestVerification(address _whose) external override {
        address linkToken = everestConsumer.linkAddress();

        uint256 oraclePayment = everestConsumer.oraclePayment();

        IERC20(linkToken).safeTransferFrom(msg.sender, address(this), oraclePayment);
        LinkTokenInterface(linkToken).approve(address(everestConsumer), oraclePayment);

        everestConsumer.requestStatus(_whose);

        _latestSentRequestId[_whose] = everestConsumer.getLatestSentRequestId();
    }

    function getLatestVerification(
        address _whose
    ) external view override returns (KYCResponse memory kycResponse) {
        IEverestConsumer.Request memory request = everestConsumer.getRequest(
            _latestSentRequestId[_whose]
        );

        kycResponse.isHumanAndUnique = request.isHumanAndUnique;
        kycResponse.isKYCUser = request.isKYCUser;
        kycResponse.kycTimestamp = request.kycTimestamp;
    }
}
