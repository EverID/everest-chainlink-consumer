// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "./interfaces/IExampleContract.sol";
import "./interfaces/IEverestConsumer.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";

contract ExampleContract is IExampleContract, Ownable {
    using SafeERC20 for IERC20;

    mapping(address => bytes32) public latestVerificationRequestId; // revealee => request id

    IEverestConsumer public everestConsumer;

    constructor(address _everestConsumer) {
        everestConsumer = IEverestConsumer(_everestConsumer);

        LinkTokenInterface(everestConsumer.linkAddress()).approve(
            _everestConsumer,
            type(uint256).max
        );
    }

    function requestVerification(address _whose) external override onlyOwner {
        IERC20(everestConsumer.linkAddress()).safeTransferFrom(
            msg.sender,
            address(this),
            everestConsumer.oraclePayment()
        );

        everestConsumer.requestStatus(_whose);

        latestVerificationRequestId[_whose] = everestConsumer
            .getLatestSentRequestId();
    }

    function getLatestVerification(
        address _whose
    ) external view override returns (KYCResponse memory kycResponse) {
        IEverestConsumer.Request memory request = everestConsumer.getRequest(
            latestVerificationRequestId[_whose]
        );

        kycResponse.isHumanAndUnique = request.isHumanAndUnique;
        kycResponse.isKYCUser = request.isKYCUser;
        kycResponse.kycTimestamp = request.kycTimestamp;
    }
}
