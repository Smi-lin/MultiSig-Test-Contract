import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("MultiSig Test", function () {
    async function deployMultiSigFixture() {
        const [owner, signerKey1, signerKey2, nonSigner] = await ethers.getSigners();
        
        const validSigners = [owner.address, signerKey1.address, signerKey2.address];
        const quorum = 2;
        const initialBalance = ethers.parseEther("10");
        
        const MultiSig = await ethers.getContractFactory("MultiSig");
        const multiSig = await MultiSig.deploy(validSigners, quorum, { value: initialBalance });
        
        return { multiSig, owner, signerKey1, signerKey2, nonSigner, quorum };
    }

    describe("Deployment", function () {
        it("Should deploy with correct initiate transaction", async function () {
            const { multiSig, owner, signerKey1, signerKey2 } = await loadFixture(deployMultiSigFixture);
            
            const balance = await ethers.provider.getBalance(multiSig.target);
            expect(balance).to.equal(ethers.parseEther("10"));

            expect(await multiSig.signers(0)).to.equal(owner.address);
            expect(await multiSig.signers(1)).to.equal(signerKey1.address);
            expect(await multiSig.signers(2)).to.equal(signerKey2.address);
        });
    });

    describe("Transaction Management", function () {
        it("Should allow valid signer to initiate transaction", async function () {
            const { multiSig, signerKey1, signerKey2 } = await loadFixture(deployMultiSigFixture);
            
            const amount = ethers.parseEther("1");
            await multiSig.connect(signerKey1).initiateTransaction(amount, signerKey2.address);
            
            const transactions = await multiSig.getAllTransactions();
            expect(transactions.length).to.equal(1);
            expect(transactions[0].amount).to.equal(amount);
            expect(transactions[0].receiver).to.equal(signerKey2.address);
            expect(transactions[0].signersCount).to.equal(1);
        });

        it("Should not allow non-signer to initiate transaction", async function () {
            const { multiSig, nonSigner, signerKey1 } = await loadFixture(deployMultiSigFixture);
            
            const amount = ethers.parseEther("1");
            await expect(
                multiSig.connect(nonSigner).initiateTransaction(amount, signerKey1.address)
            ).to.be.revertedWith("not valid signer");
        });

        it("Should execute transaction when quorum is reached", async function () {
            const { multiSig, owner, signerKey1, signerKey2 } = await loadFixture(deployMultiSigFixture);
            
            const amount = ethers.parseEther("1");
            const initialBalance = await ethers.provider.getBalance(signerKey2.address);
            
            await multiSig.connect(owner).initiateTransaction(amount, signerKey2.address);
            
            await multiSig.connect(signerKey1).approveTransaction(1);
            
            const finalBalance = await ethers.provider.getBalance(signerKey2.address);
            expect(finalBalance - initialBalance).to.equal(amount);
        });

        it("Should prevent double signing", async function () {
            const { multiSig, signerKey1, signerKey2 } = await loadFixture(deployMultiSigFixture);
            
            await multiSig.connect(signerKey1).initiateTransaction(ethers.parseEther("1"), signerKey2.address);
            
            await expect(
                multiSig.connect(signerKey1).approveTransaction(1)
            ).to.be.revertedWith("can't sign twice");
        });
    });

    describe("Ownership Management", function () {
        it("Should transfer ownership correctly", async function () {
            const { multiSig, owner, signerKey1 } = await loadFixture(deployMultiSigFixture);
            
            await multiSig.connect(owner).transferOwnership(signerKey1.address);
            
            await multiSig.connect(signerKey1).claimOwnership();
            
            const newSignerAddress = "0x6Db691950c09b2025855B3166D14EbAF1F6E8ba9";
            await multiSig.connect(signerKey1).addValidSigner(newSignerAddress);
            
            await expect(
                multiSig.connect(owner).addValidSigner(newSignerAddress)
            ).to.be.revertedWith("not owner");
        });

        it("Should not allow non-owner to transfer ownership", async function () {
            const { multiSig, signerKey1, signerKey2 } = await loadFixture(deployMultiSigFixture);
            
            await expect(
                multiSig.connect(signerKey1).transferOwnership(signerKey2.address)
            ).to.be.revertedWith("not owner");
        });
    });

    describe("Signer Management", function () {
        it("Should allow owner to add and remove signers", async function () {
            const { multiSig, owner, nonSigner } = await loadFixture(deployMultiSigFixture);
            
            await multiSig.connect(owner).addValidSigner(nonSigner.address);
            
            await multiSig.connect(nonSigner).initiateTransaction(ethers.parseEther("1"), owner.address);
            
            await multiSig.connect(owner).removeSigner(3); 
            
            await expect(
                multiSig.connect(nonSigner).initiateTransaction(ethers.parseEther("1"), owner.address)
            ).to.be.revertedWith("not valid signer");
        });

       
    });
});