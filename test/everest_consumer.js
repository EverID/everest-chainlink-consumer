const EverestConsumer = artifacts.require("EverestConsumer");
const Oracle = artifacts.require("Operator");
const LinkToken = artifacts.require("LinkToken");

const { constants, expectRevert, expectEvent, time } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
const { oracle, helpers } = require("@chainlink/test-helpers");

contract("EverestConsumer", function([owner, stranger, revealer, revealee, node, randomAddress]) {
    const jobId = "509e8dd8de054d3f918640ab0a2b77d8";
    const oraclePayment = "1000000000000000000"; // 10 ** 18
    const defaultSignUpURL = "https://everest.org"
    beforeEach(async function () {
        this.link = await LinkToken.new({from: owner});
        this.oracle = await Oracle.new(this.link.address, owner, {from: owner});
        this.consumer = await EverestConsumer.new(
            this.link.address,
            this.oracle.address,
            jobId,
            oraclePayment,
            defaultSignUpURL,
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
        expect(await this.consumer.signUpURL()).to.be.equal(defaultSignUpURL);
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

    describe("#setSignUpURL", async function () {
        const url = "https://everest.sign.up.mocked.org/";
        it("should set properly with owner sender", async function () {
            await this.consumer.setSignUpURL(url, {from: owner});
            expect(await this.consumer.signUpURL()).to.be.equal(url);
        });

        it("should revert if sender is not an owner", async function () {
            await expectRevert(
                this.consumer.setSignUpURL(url, {from: stranger}),
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
            expect(await this.consumer.statusToString(0)).to.be.equal("NOT_FOUND");
            expect(await this.consumer.statusToString(1)).to.be.equal("KYC_USER");
            expect(await this.consumer.statusToString(2)).to.be.equal("HUMAN_AND_UNIQUE");
        });
    });

    describe("#getLatestSentRequestId", async function () {
        it("should revert if no requests yet", async function () {
            await expectRevert(this.consumer.getLatestSentRequestId(), "No requests yet");
        })
    });

    describe("#getRequest #requestExists", async function () {
        const mockedRequestId = helpers.toBytes32String("mocked");

        it("should revert if request with passed request id does not exist", async function () {
            expect(await this.consumer.requestExists(mockedRequestId, {from: stranger})).to.be.false;

            await expectRevert(
                this.consumer.getRequest(mockedRequestId, {from: owner}),
                "Request does not exist"
            );
        });
    });

    describe("#requestStatus #fulfill #cancelRequest", async function () {
        beforeEach(async function () {
            await this.link.transfer(revealer, oraclePayment, {from: owner});
        });

        it("should revert if not enough allowance", async function () {
            await expectRevert(
                this.consumer.requestStatus(revealee, {from: revealer}),
                "SafeERC20: low-level call failed."
            );
        });

        describe("if approved", async function () {
            const requestExpirationMinutes = 5;

            const notFoundStatus = "0";
            const kycUserStatus = "1";
            const humanUniqueStatus = "2";

            const nonZeroKycTimestamp = "1658845449";
            const zeroKycTimestamp = "0";

            const responseTypes = ["uint8", "uint256"];

            beforeEach(async function () {
                await this.link.approve(this.consumer.address, oraclePayment, {from: revealer});
                const requestTx = await this.consumer.requestStatus(revealee, {from: revealer});
                this.request = oracle.decodeRunRequest(requestTx.receipt.rawLogs?.[4]);
                this.requestId = await this.consumer.getLatestSentRequestId({from: revealer});
                this.requestTime = await time.latest();
                this.expiration = this.requestTime.add(time.duration.minutes(requestExpirationMinutes));

                expectEvent(requestTx, "Requested", {
                    _requestId: this.requestId,
                    _revealer: revealer,
                    _revealee: revealee,
                    _expiration: this.expiration,
                });
            });

            it("expiration time should be 5 minutes after request", async function () {
                const expirationTime = (await this.consumer.getRequest(this.requestId)).expiration;
                expect(expirationTime).to.be.bignumber.equal(this.expiration);
            });

            it("should not cancel if caller is not a revealer", async function () {
                await expectRevert(
                    this.consumer.cancelRequest(this.requestId, {from: stranger}),
                    "You are not an owner of the request"
                );
            });

            it("should not cancel if request is not expired", async function () {
                await expectRevert(
                    this.consumer.cancelRequest(this.requestId, {from: revealer}),
                    "Request is not expired"
                );
            });

            it("should cancel after 5 minutes", async function () {
                await time.increaseTo(this.expiration);
                expect(await this.link.balanceOf(revealer)).to.be.bignumber.equal("0");
                expect(await (await this.consumer.getRequest(this.requestId)).isCanceled).to.be.false;
                await this.consumer.cancelRequest(this.requestId, {from: revealer});
                expect(await this.link.balanceOf(revealer)).to.be.bignumber.equal(oraclePayment);
                expect(await (await this.consumer.getRequest(this.requestId)).isCanceled).to.be.true;
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

                        expect(fulfilledRequest.isCanceled).to.be.false;
                        expect(fulfilledRequest.isFulfilled).to.be.true;

                        switch (status) {
                            case kycUserStatus:
                                expect(fulfilledRequest.isHumanAndUnique).to.be.true;
                                expect(fulfilledRequest.isKYCUser).to.be.true;
                                expect(fulfilledRequest.kycTimestamp).to.be.bignumber.equal(kycTimestamp);
                                break;
                            case humanUniqueStatus:
                                expect(fulfilledRequest.isHumanAndUnique).to.be.true;
                                expect(fulfilledRequest.isKYCUser).to.be.false;
                                expect(fulfilledRequest.kycTimestamp).to.be.bignumber.equal(kycTimestamp);
                                break;
                            case notFoundStatus:
                                expect(fulfilledRequest.isHumanAndUnique).to.be.false;
                                expect(fulfilledRequest.isKYCUser).to.be.false;
                                expect(fulfilledRequest.kycTimestamp).to.be.bignumber.equal(kycTimestamp);
                                break;
                            default:
                                break;
                        }
                    }

                    this.expectNotFulfill = async function (status, kycTimestamp) {
                        const tx = await this.doFulfill(status, kycTimestamp);

                        await expectEvent.notEmitted.inTransaction(tx.receipt.transactionHash, this.consumer, "Fulfilled");

                        const fulfilledRequest = await this.consumer.getRequest(this.requestId, {from: revealer});

                        expect(fulfilledRequest.isCanceled).to.be.false;
                        expect(fulfilledRequest.isFulfilled).to.be.false;
                        expect(fulfilledRequest.isHumanAndUnique).to.be.false;
                        expect(fulfilledRequest.isKYCUser).to.be.false;
                        expect(fulfilledRequest.kycTimestamp).to.be.bignumber.equal("0");
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
            });
        });
    });
});
