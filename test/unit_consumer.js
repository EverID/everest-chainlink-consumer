const UnitConsumer = artifacts.require("UnitConsumer");
const Oracle = artifacts.require("Operator");
const LinkToken = artifacts.require("LinkToken");

const { constants, expectRevert, expectEvent } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
const { oracle } = require("@chainlink/test-helpers");

contract("UnitConsumer", function([owner, stranger, revealer, revealee, node, randomAddress]) {
    const jobId = "509e8dd8de054d3f918640ab0a2b77d8";
    const oraclePayment = "1000000000000000000"; // 10 ** 18

    beforeEach(async function () {
        this.link = await LinkToken.new({from: owner});
        this.oracle = await Oracle.new(this.link.address, owner, {from: owner});
        this.consumer = await UnitConsumer.new(
            this.link.address,
            this.oracle.address,
            jobId,
            oraclePayment,
            {from: owner}
        );
    });

    it("should set ctor properties properly", async function () {
        expect(this.oracle.address).to.not.be.equal(constants.ZERO_ADDRESS);
        expect(this.consumer.address).to.not.be.equal(constants.ZERO_ADDRESS);

        expect(await this.consumer.oracleAddress()).to.be.equal(this.oracle.address);
        expect(await this.consumer.jobId()).to.be.equal(web3.utils.asciiToHex(jobId));
        expect(await this.consumer.oraclePayment()).to.be.bignumber.equal(oraclePayment);
        expect(await this.consumer.linkAddress()).to.be.equal(this.link.address);
    });

    describe("#setOracle", async function () {
        it("should set properly with owner sender", async function () {
            await this.consumer.setOracle(randomAddress, {from: owner});
            expect(await this.consumer.oracleAddress()).to.be.equal(randomAddress);
        });

        it("should revert if sender is not an owner", async function () {
            await expectRevert(
                this.consumer.setOracle(randomAddress, {from: stranger}),
                "Ownable: caller is not the owner"
            );
        });
    });

    describe("#setOraclePayments", async function () {
        it("should set properly with owner sender", async function () {
            await this.consumer.setOraclePayment("1", {from: owner});
            expect(await this.consumer.oraclePayment()).to.be.bignumber.equal("1");
        });

        it("should revert if sender is not an owner", async function () {
            await expectRevert(
                this.consumer.setOraclePayment("1", {from: stranger}),
                "Ownable: caller is not the owner"
            );
        });
    });

    describe("#setLink", async function () {
        it("should set properly with owner sender", async function () {
            await this.consumer.setLink(randomAddress, {from: owner});
            expect(await this.consumer.linkAddress()).to.be.equal(randomAddress);
        });

        it("should revert if sender is not an owner", async function () {
            await expectRevert(
                this.consumer.setLink(randomAddress, {from: stranger}),
                "Ownable: caller is not the owner"
            );
        });
    });

    describe("#setJobId", async function () {
        const newJobId = "7223acbd01654282865b678924126013";
        const incorrectJobId = "7223acbd01654282865b6789241260131";

        it("should set properly with owner sender", async function () {
            await this.consumer.setJobId(newJobId, {from: owner});
            expect(await this.consumer.jobId()).to.be.equal(web3.utils.asciiToHex(newJobId));
        });

        it("should revert if sender is not an owner", async function () {
            await expectRevert(
                this.consumer.setJobId(newJobId, {from: stranger}),
                "Ownable: caller is not the owner"
            );
        });

        it("should revert if wrong invalid job id value passed", async function () {
            await expectRevert(
                this.consumer.setJobId(incorrectJobId, {from: owner}),
                "Incorrect length"
            );
        });
    });

    describe("#statusToString", async function () {
        it("should return correct names", async function () {
            expect(await this.consumer.statusToString(0)).to.be.equal("undefined");
            expect(await this.consumer.statusToString(1)).to.be.equal("kyc-user");
            expect(await this.consumer.statusToString(2)).to.be.equal("human-unique");
            expect(await this.consumer.statusToString(3)).to.be.equal("not-found");
        });
    });

    describe("#getLastRequestId", async function () {
        it("should revert if no requests yet", async function () {
            await expectRevert(this.consumer.getLastRequestId(), "No requests yet");
        })
    });

    describe("#getRequest #requestExists", async function () {
        const mockedRequestId = "0x6d6f636b65640000000000000000000000000000000000000000000000000000"; // formatBytes32String("mocked")

        it("should revert if request with passed request id does not exist", async function () {
            expect(await this.consumer.requestExists(mockedRequestId, {from: stranger})).to.be.false;

            await expectRevert(
                this.consumer.getRequest(mockedRequestId, {from: owner}),
                "Request does not exist"
            );
        });
    });

    describe("#requestStatus #fulfill", async function () {
        beforeEach(async function () {
            await this.link.transfer(revealer, oraclePayment, {from: owner});
        });

        it("should revert if not enough allowance", async function () {
            await expectRevert(
                this.consumer.requestStatus(revealee, {from: revealer}),
                "Failed to transferFrom link token."
            );
        });

        describe("if approved", async function () {
            const undefinedStatus = "0";
            const kycUserStatus = "1";
            const humanUniqueStatus = "2";
            const notFoundStatus = "3";

            const nonZeroKycTimestamp = "1658845449";
            const zeroKycTimestamp = "0";

            const responseTypes = ["uint8", "uint256"];

            beforeEach(async function () {
                await this.link.approve(this.consumer.address, oraclePayment, {from: revealer});
                const requestTx = await this.consumer.requestStatus(revealee, {from: revealer});
                this.request = oracle.decodeRunRequest(requestTx.receipt.rawLogs?.[4]);
                this.requestId = await this.consumer.getLastRequestId({from: revealer});

                expectEvent(requestTx, "Requested", {
                    _requestId: this.requestId,
                    _revealer: revealer,
                    _revealee: revealee,
                })
            });

            it("should not fulfill from unauthorized node", async function () {
                await expectRevert(
                    this.oracle.fulfillOracleRequest2(
                        ...oracle.convertFulfill2Params(
                            this.request,
                            responseTypes,
                            [kycUserStatus, nonZeroKycTimestamp],
                            {from: node}
                        ),
                    ),
                    "Not authorized sender"
                );
            });

            describe("if node authorized", async function () {
                beforeEach(async function () {
                    await this.oracle.setAuthorizedSenders([node], {from: owner});

                    this.doFulfill = async function (status, kycTimestamp) {
                        return await this.oracle.fulfillOracleRequest2(
                            ...oracle.convertFulfill2Params(
                                this.request,
                                responseTypes,
                                [status, kycTimestamp],
                                {from: node}
                            ),
                        );
                    }

                    this.expectFulfill = async function (status, kycTimestamp) {
                        const tx = await this.doFulfill(status, kycTimestamp);

                        await expectEvent.inTransaction(tx.receipt.transactionHash, this.consumer, "Fulfilled", {
                            _requestId: this.requestId,
                            _revealer: revealer,
                            _revealee: revealee,
                            _status: status,
                            _kycTimestamp: kycTimestamp,
                        });

                        const fulfilledRequest = await this.consumer.getRequest(this.requestId, {from: revealer});

                        expect(fulfilledRequest.status).to.be.equal(status);
                        expect(fulfilledRequest.kycTimestamp).to.be.bignumber.equal(kycTimestamp);
                    }

                    this.expectNotFulfill = async function (status, kycTimestamp) {
                        const tx = await this.doFulfill(status, kycTimestamp);

                        await expectEvent.notEmitted.inTransaction(tx.receipt.transactionHash, this.consumer, "Fulfilled");

                        const fulfilledRequest = await this.consumer.getRequest(this.requestId, {from: revealer});

                        expect(fulfilledRequest.status).to.be.equal(undefinedStatus);
                        expect(fulfilledRequest.kycTimestamp).to.be.bignumber.equal(zeroKycTimestamp);
                    }
                });

                it("should fulfill kyc status with non-zero kyc timestamp", async function () {
                    await this.expectFulfill(kycUserStatus, nonZeroKycTimestamp);
                });

                it("should not fulfill kyc status with zero kyc timestamp", async function () {
                    await this.expectNotFulfill(kycUserStatus, zeroKycTimestamp);
                });

                it("should fulfill human unique status with zero kyc timestamp", async function () {
                    await this.expectFulfill(humanUniqueStatus, zeroKycTimestamp);
                });

                it("should not fulfill human unique status with non-zero kyc timestamp", async function () {
                    await this.expectNotFulfill(humanUniqueStatus, nonZeroKycTimestamp);
                });

                it("should fulfill not found status with zero kyc timestamp", async function () {
                    await this.expectFulfill(notFoundStatus, zeroKycTimestamp);
                });

                it("should not fulfill not found status with non-zero kyc timestamp", async function () {
                    await this.expectNotFulfill(notFoundStatus, nonZeroKycTimestamp);
                });

                it("should not fulfill undefined status with non-zero kyc timestamp", async function () {
                    await this.expectNotFulfill(undefinedStatus, nonZeroKycTimestamp);
                });

                it("should not fulfill undefined status with zero kyc timestamp", async function () {
                    await this.expectNotFulfill(undefinedStatus, zeroKycTimestamp);
                });
            });
        });
    });
});
