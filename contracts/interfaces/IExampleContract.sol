// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface IExampleContract {
    struct KYCResponse {
        bool isHumanAndUnique;
        bool isKYCUser;
        uint40 kycTimestamp;
    }

    /// @dev Request verification. Requests the status from the `EverestConsumer` smartcontract
    /// and stores the metadata of the made request to the storage
    /// @param _whose A verification address
    function requestVerification(address _whose) external;

    /// @dev Get latest verification. Queries the verification result by the metadata saved
    /// during the latest `requestVerification` method call
    /// @param _whose A verification address
    /// @return kycResponse KYC response. There are 3 types of the response:
    /// `isHumanAndUnique`=false and `isKYCUser`=false and `kycTimestamp`=0:
    /// address not found | request failed | request not fulfilled
    /// `isHumanAndUnique`=true and `isKYCUser`=false and `kycTimestamp`=0: Human & Unique status
    /// `isHumanAndUnique`=true and `isKYCUser`=true and `kycTimestamp`!=0: KYC User status
    function getLatestVerification(
        address _whose
    ) external view returns (KYCResponse memory kycResponse);
}
