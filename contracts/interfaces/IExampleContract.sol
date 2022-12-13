// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface IExampleContract {
    struct KYCResponse {
        bool isHumanAndUnique;
        bool isKYCUser;
        uint40 kycTimestamp;
    }

    function requestAddressVerification(address _consumer, address _whose) external;

    function getLatestVerification(address _whose) external view returns (KYCResponse memory);
}
