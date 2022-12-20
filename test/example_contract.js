const EverestConsumer = artifacts.require("EverestConsumer");
const ExampleContract = artifacts.require("ExampleContract");
const Oracle = artifacts.require("Operator");
const LinkToken = artifacts.require("LinkToken");

const { constants, expectRevert, BN } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
const { oracle } = require("@chainlink/test-helpers");

contract("ExampleContract", function ([owner, revealee, random, node]) {
    const jobId = "509e8dd8de054d3f918640ab0a2b77d8";
    const oraclePayment = "1000000000000000000"; // 10 ** 18
    const defaultSignUpURL = "https://everest.org";

    beforeEach(async function () {
        this.link = await LinkToken.new({ from: owner });
        this.oracle = await Oracle.new(this.link.address, owner, { from: owner });
        this.consumer = await EverestConsumer.new(
            this.link.address,
            this.oracle.address,
            jobId,
            oraclePayment,
            defaultSignUpURL,
            { from: owner }
        );
        this.example = await ExampleContract.new(this.consumer.address);
    });

    describe("constructor()", function () {
        it("should revert if consumer is zero", async function () {
            await expectRevert(ExampleContract.new(constants.ZERO_ADDRESS, { from: owner }), "Consumer is zero");
        });
    });

    describe("everestConsumer()", function () {
        it("should return the proper everest consumer address", async function () {
            expect(await this.example.everestConsumer()).to.not.be.equal(constants.ZERO_ADDRESS);
            expect(await this.example.everestConsumer()).to.be.equal(this.consumer.address);
        });
    });

    describe("latestVerificationRequestId()", function () {
        it("should change request id after request", async function () {
            await this.link.approve(this.example.address, oraclePayment);

            expect(await this.example.latestVerificationRequestId(revealee)).to.be.equal(constants.ZERO_BYTES32);

            await this.example.requestVerification(revealee, { from: owner });

            expect(await this.example.latestVerificationRequestId(revealee)).to.not.be.equal(constants.ZERO_BYTES32);
        });
    });

    describe("requestVerification()", function () {
        it("should revert if caller is not the owner", async function () {
            await expectRevert(
                this.example.requestVerification(revealee, { from: random }),
                "Ownable: caller is not the owner"
            );
        });

        it("should revert if insufficient allowance", async function () {
            await expectRevert(
                this.example.requestVerification(revealee, { from: owner }),
                "SafeERC20: low-level call failed"
            );
        });

        describe("after approving", function () {
            beforeEach(async function () {
                await this.link.approve(this.example.address, oraclePayment);
            });

            it("should request if all conditions are met", async function () {
                const balanceBefore = await this.link.balanceOf(owner);

                await this.example.requestVerification(revealee, { from: owner });

                expect(await this.link.balanceOf(owner)).to.be.bignumber.equal(
                    balanceBefore.sub(new BN(oraclePayment))
                );
                expect(await this.link.balanceOf(this.oracle.address)).to.be.bignumber.equal(oraclePayment);
            });
        });
    });

    describe("getLatestVerification()", function () {
        it("should return zero KYC response if not fulfilled", async function () {
            const kycResponse = await this.example.getLatestVerification(revealee);

            expect(kycResponse.isHumanAndUnique).to.be.false;
            expect(kycResponse.isKYCUser).to.be.false;
            expect(kycResponse.kycTimestamp).to.be.bignumber.equal("0");
        });

        describe("after fulfillment", function () {
            const notFoundStatus = "0";
            const kycUserStatus = "1";
            const humanUniqueStatus = "2";

            const nonZeroKycTimestamp = "1658845449";
            const zeroKycTimestamp = "0";

            const responseTypes = ["uint8", "uint256"];

            beforeEach(async function () {
                await this.link.approve(this.example.address, oraclePayment);

                const requestTx = await this.example.requestVerification(revealee, { from: owner });

                await this.oracle.setAuthorizedSenders([node], { from: owner });

                this.request = oracle.decodeRunRequest(requestTx.receipt.rawLogs?.[5]);

                this.doFulfill = async function (status, kycTimestamp) {
                    await this.oracle.fulfillOracleRequest2(
                        ...oracle.convertFulfill2Params(this.request, responseTypes, [status, kycTimestamp], {
                            from: node,
                        })
                    );
                };
            });

            it("should return proper KYC response if fulfilled with `NotFound` status", async function () {
                await this.doFulfill(notFoundStatus, zeroKycTimestamp);

                const kycResponse = await this.example.getLatestVerification(revealee);

                expect(kycResponse.isHumanAndUnique).to.be.false;
                expect(kycResponse.isKYCUser).to.be.false;
                expect(kycResponse.kycTimestamp).to.be.bignumber.equal("0");
            });

            it("should return proper KYC response if fulfilled with `Human&Unique` status", async function () {
                await this.doFulfill(humanUniqueStatus, zeroKycTimestamp);

                const kycResponse = await this.example.getLatestVerification(revealee);

                expect(kycResponse.isHumanAndUnique).to.be.true;
                expect(kycResponse.isKYCUser).to.be.false;
                expect(kycResponse.kycTimestamp).to.be.bignumber.equal("0");
            });

            it("should return proper KYC response if fulfilled with `KYCUser` status", async function () {
                await this.doFulfill(kycUserStatus, nonZeroKycTimestamp);

                const kycResponse = await this.example.getLatestVerification(revealee);

                expect(kycResponse.isHumanAndUnique).to.be.true;
                expect(kycResponse.isKYCUser).to.be.true;
                expect(kycResponse.kycTimestamp).to.be.bignumber.equal(nonZeroKycTimestamp);
            });
        });
    });
});
