const UnitConsumer = artifacts.require("UnitConsumer");
const Oracle = artifacts.require("Operator");
const LinkToken = artifacts.require("LinkToken");

const { constants, expectRevert, expectEvent, BN } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
const { oracle } = require("@chainlink/test-helpers");

contract("UnitConsumer", function([owner, stranger, revealer, revealee, node, ...accounts]) {
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
        expect(await this.consumer.linkAddress()).to.be.equal(link);
    });

    describe("#setOracle", async function () {
        it("should set properly with owner sender", async function () {
            await this.consumer.setOracle(addr, {from: owner});
            expect(await this.consumer.oracleAddress()).to.be.equal(addr);
        });

        it("should revert if sender is not an owner", async function () {
            await expectRevert(
                this.consumer.setOracle(addr, {from: stranger}),
                'Ownable: caller is not the owner'
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
                'Ownable: caller is not the owner'
            );
        });
    });

    describe("#setLink", async function () {
        const mockedNewLinkAddress = "0xa36085F69e2889c224210F603D836748e7dC0088";
        it("should set properly with owner sender", async function () {
            await this.consumer.setLink(mockedNewLinkAddress, {from: owner});
            expect(await this.consumer.linkAddress()).to.be.equal(mockedNewLinkAddress);
        });

        it("should revert if sender is not an owner", async function () {
            await expectRevert(
                this.consumer.setLink(mockedNewLinkAddress, {from: stranger}),
                'Ownable: caller is not the owner'
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
                'Ownable: caller is not the owner'
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

    // TODO: expand the number of test cases
    describe.only("#requestStatus #fullfil #lastRequestId", async function () {
        it("should set status correctly", async function () {
            await this.oracle.setAuthorizedSenders([node], {from: owner});

            await this.link.transfer(revealer, oraclePayment, {from: owner});
            await this.link.approve(this.consumer.address, oraclePayment, {from: revealer});

            const requestTx = await this.consumer.requestStatus(revealee, {from: revealer});
            const request = oracle.decodeRunRequest(requestTx.receipt.rawLogs?.[4]);

            const status = "1";
            const kycTimestamp = "1658845449";

            const responseTypes = ["uint8", "uint256"];
            const responseValues = [status, kycTimestamp];

            await this.oracle.fulfillOracleRequest2(
                ...oracle.convertFulfill2Params(request, responseTypes, responseValues, {from: node}),
            );

            const requestId = await this.consumer.getLastRequestId({from: revealer});
            const fulfilledRequest = await this.consumer.getRequest(requestId, {from: revealer})

            console.log(fulfilledRequest)
            // [
            //     '1658845449',
            //     '0xC5fdf4076b8F3A5357c5E395ab970B5B54098Fef',
            //     '0x821aEa9a577a9b44299B9c15c88cf3087F3b5544',
            //     '1',
            //     kycTimestamp: '1658845449',
            //     revealer: '0xC5fdf4076b8F3A5357c5E395ab970B5B54098Fef',
            //     revealee: '0x821aEa9a577a9b44299B9c15c88cf3087F3b5544',
            //     status: '1'
            // ]
        });
    });
});
