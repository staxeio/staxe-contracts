import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  ProductionEscrowV2,
  StaxeEscrowFactoryV2,
  StaxeMembersV2,
  StaxeProductionsV2,
  StaxeProductionTokenV2,
} from '../../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BigNumber } from 'ethers';

function newProduction(
  id: number,
  tokenInvestorSupply: number,
  tokenPrice: number,
  tokenOrganizerSupply = 0,
  tokenTreasurySupply = 0,
  maxTokensUnknownBuyer = 0,
  dataHash = ''
) {
  return {
    id,
    tokenInvestorSupply,
    tokenOrganizerSupply,
    tokenTreasurySupply,
    tokenPrice,
    maxTokensUnknownBuyer,
    dataHash,
  };
}

describe('StaxeProductionsV2', function () {
  // contracts
  let token: StaxeProductionTokenV2;
  let productions: StaxeProductionsV2;

  // actors
  let owner: SignerWithAddress;
  let organizer: SignerWithAddress;
  let approver: SignerWithAddress;
  let investor1: SignerWithAddress;
  let investor2: SignerWithAddress;
  let treasury: SignerWithAddress;

  const attachEscrow = async (id: number) => {
    const productionEscrowFactory = await ethers.getContractFactory('ProductionEscrowV2');
    const deposits = (await productions.getProductionData(id)).deposits;
    return productionEscrowFactory.attach(deposits) as ProductionEscrowV2;
  };

  beforeEach(async () => {
    [owner, organizer, approver, investor1, investor2, treasury] = await ethers.getSigners();

    // create contracts
    // --- production token
    const tokenFactory = await ethers.getContractFactory('StaxeProductionTokenV2');
    token = (await tokenFactory.deploy()) as StaxeProductionTokenV2;

    const membersFactory = await ethers.getContractFactory('StaxeMembersV2');
    const members = (await membersFactory.deploy()) as StaxeMembersV2;

    // --- escrow factory
    const escrowFactoryFactory = await ethers.getContractFactory('StaxeEscrowFactoryV2');
    const escrowFactory = (await escrowFactoryFactory.deploy()) as StaxeEscrowFactoryV2;

    // --- productions
    const productionsFactory = await ethers.getContractFactory('StaxeProductionsV2');
    productions = (await productionsFactory.deploy(
      token.address,
      escrowFactory.address,
      members.address,
      treasury.address
    )) as StaxeProductionsV2;
    await token.grantRole(await token.MINTER_ROLE(), productions.address);

    // define roles
    await members.grantRole(await members.INVESTOR_ROLE(), investor1.address);
    await members.grantRole(await members.INVESTOR_ROLE(), investor2.address);
    await members.grantRole(await members.ORGANIZER_ROLE(), organizer.address);
    await members.grantRole(await members.APPROVER_ROLE(), approver.address);
  });

  it('inits contract correctly', async function () {
    // then
    expect(await productions.owner()).to.equal(owner.address);
  });

  // ------------------------------------ create event ------------------------------------

  describe('createNewProduction', async () => {
    it('should create new production', async () => {
      // given
      const data = newProduction(1000, 100, 5000);

      // when
      await expect(productions.connect(organizer).createNewProduction(data))
        .to.emit(productions, 'ProductionCreated')
        .withArgs(data.id, organizer.address, data.tokenInvestorSupply, 0, 0);
      const created = await productions.getProductionData(data.id);

      // then
      expect(created.id).to.equal(data.id);
      expect(created.tokenSupply).to.equal(data.tokenInvestorSupply);
      expect(created.tokenPrice).to.equal(data.tokenPrice);
      expect(created.tokensSoldCounter).to.equal(0);
      expect(created.state).to.equal(1);
      expect(created.creator).to.equal(organizer.address);
      expect(await token.balanceOf(created.deposits, data.id)).to.equal(data.tokenInvestorSupply);
    });

    it('should create new production with treasury and organizer share', async () => {
      // given
      const data = newProduction(1000, 100, 5000, 10, 10);

      // when
      await expect(productions.connect(organizer).createNewProduction(data))
        .to.emit(productions, 'ProductionCreated')
        .withArgs(
          data.id,
          organizer.address,
          data.tokenInvestorSupply,
          data.tokenOrganizerSupply,
          data.tokenTreasurySupply
        );
      const created = await productions.getProductionData(data.id);

      // then
      expect(created.id).to.equal(data.id);
      expect(created.tokenSupply).to.equal(
        data.tokenInvestorSupply + data.tokenOrganizerSupply + data.tokenTreasurySupply
      );
      expect(created.tokenPrice).to.equal(data.tokenPrice);
      expect(created.tokensSoldCounter).to.equal(data.tokenOrganizerSupply + data.tokenTreasurySupply);
      expect(created.state).to.equal(1);
      expect(created.creator).to.equal(organizer.address);
      expect(await token.balanceOf(created.deposits, data.id)).to.equal(data.tokenInvestorSupply);
      expect(await token.balanceOf(organizer.address, data.id)).to.equal(data.tokenOrganizerSupply);
      expect(await token.balanceOf(treasury.address, data.id)).to.equal(data.tokenTreasurySupply);
    });

    it('should fail to create event if not an organizer', async () => {
      // then
      await expect(
        productions.connect(investor1).createNewProduction(newProduction(1000, 100, 5000))
      ).to.be.revertedWith('NOT_ORGANIZER');
    });

    it('should fail to create production with id 0', async () => {
      // then
      await expect(productions.connect(organizer).createNewProduction(newProduction(0, 100, 5000))).to.be.revertedWith(
        'ID_0_NOT_ALLOWED'
      );
    });

    it('should fail to create production with id that already exists', async () => {
      // given
      const data = newProduction(1000, 100, 5000);
      await productions.connect(organizer).createNewProduction(data);

      // then
      await expect(productions.connect(organizer).createNewProduction(data)).to.be.revertedWith('PRODUCTION_EXISTS');
    });
  });

  // ---------------------------------- getProductionData

  describe('getProductionData', async () => {
    it('should get production data after create', async () => {
      // given
      const id = 600;

      await productions.connect(organizer).createNewProduction(newProduction(id, 100, 5000));
      await productions.connect(organizer).createNewProduction(newProduction(id + 1, 100, 5000));

      // when
      const data1 = await productions.getProductionData(id);
      const data2 = await productions.getProductionDataForProductions([id, id + 1]);

      // then
      expect(data1.id).to.be.equal(id);
      expect(data1.tokenSupply).to.be.equal(100);
      expect(data1.tokensSoldCounter).to.be.equal(0);
      expect(data1.tokenPrice).to.be.equal(5000);
      expect(data1.maxTokensUnknownBuyer).to.be.equal(0);
      expect(data1.state).to.be.equal(1);
      expect(data1.deposits).not.to.be.null;
      expect(data2.length).to.be.equal(2);
      expect(data2[0].id).to.be.equal(id);
      expect(data2[1].id).to.be.equal(id + 1);
    });
  });

  // ---------------------------------- approveProduction

  describe('approveProduction', async () => {
    it('should approve production by approver', async () => {
      // given
      const id = 500;
      await productions.connect(organizer).createNewProduction(newProduction(id, 100, 5000));

      // when
      await productions.connect(approver).approveProduction(id);

      // then
      expect((await productions.getProductionData(id)).state).to.equal(2);
    });

    it('should reject approval by non-approver', async () => {
      // given
      const id = 500;
      await productions.connect(organizer).createNewProduction(newProduction(id, 100, 5000));

      // then
      await expect(productions.connect(organizer).approveProduction(id)).to.be.revertedWith('NOT_APPROVER');
    });
  });

  // ---------------------------------- declineProduction

  describe('declineProduction', async () => {
    it('should decline production by approver', async () => {
      // given
      const id = 500;
      await productions.connect(organizer).createNewProduction(newProduction(id, 100, 5000));

      // when
      await productions.connect(approver).declineProduction(id);

      // then
      expect((await productions.getProductionData(id)).state).to.equal(4);
    });

    it('should reject decline by non-approver', async () => {
      // given
      const id = 500;
      await productions.connect(organizer).createNewProduction(newProduction(id, 100, 5000));

      // then
      await expect(productions.connect(organizer).declineProduction(id)).to.be.revertedWith('NOT_APPROVER');
    });
  });

  // ---------------------------------- buyTokens

  describe('buyTokens', async () => {
    const data = newProduction(600, 100, 100000000000, 0, 0, 10);

    beforeEach(async () => {
      await productions.connect(organizer).createNewProduction(data);
      await productions.connect(owner).approveProduction(data.id);
    });

    it('should calculate token price', async () => {
      // given
      const tokensToBuy = 10;

      // when
      const cost = await productions.getNextTokensPrice(data.id, tokensToBuy);

      // then
      expect(cost).to.equal(data.tokenPrice * tokensToBuy);
    });

    it('should buying tokens', async () => {
      // given
      const tokensToBuy = 10;
      const cost = await productions.getNextTokensPrice(data.id, tokensToBuy);

      // when
      await productions.connect(investor1).buyTokens(data.id, tokensToBuy, investor1.address, { value: cost });
      const dataUpdated = await productions.getProductionData(data.id);

      // then
      expect(await token.balanceOf(investor1.address, dataUpdated.id)).to.be.equal(tokensToBuy);
      expect(await token.provider.getBalance(dataUpdated.deposits)).to.be.equal(cost);
      expect(dataUpdated.tokensSoldCounter).to.be.equal(tokensToBuy);
    });

    it('should allow buying tokens by non-investor', async () => {
      // given
      const tokensToBuy = 10;
      const cost = await productions.getNextTokensPrice(data.id, tokensToBuy);

      // when
      await expect(productions.connect(organizer).buyTokens(data.id, tokensToBuy, organizer.address, { value: cost }))
        .to.emit(productions, 'ProductionTokenBought')
        .withArgs(data.id, organizer.address, tokensToBuy, cost);

      // then
      expect(await token.balanceOf(organizer.address, data.id)).to.be.equal(tokensToBuy);
    });

    it('should allow buying tokens for other address', async () => {
      // given
      const tokensToBuy = 10;
      const cost = await productions.getNextTokensPrice(data.id, tokensToBuy);

      // when
      await expect(productions.connect(investor1).buyTokens(data.id, tokensToBuy, organizer.address, { value: cost }))
        .to.emit(productions, 'ProductionTokenBought')
        .withArgs(data.id, organizer.address, tokensToBuy, cost);

      // then
      expect(await token.balanceOf(organizer.address, data.id)).to.be.equal(tokensToBuy);
    });

    it('should reject buying more tokens than allowed by non-investor', async () => {
      // given
      const tokensToBuy = 11;
      const cost = await productions.getNextTokensPrice(data.id, tokensToBuy);

      // when
      await expect(
        productions.connect(organizer).buyTokens(data.id, tokensToBuy, organizer.address, { value: cost })
      ).to.be.revertedWith('MAX_TOKENS_EXCEEDED_FOR_NON_INVESTOR');

      // then
      expect(await token.balanceOf(organizer.address, data.id)).to.be.equal(0);
    });

    it('should reject buying tokens when buying 0 tokens', async () => {
      // then
      await expect(
        productions.connect(investor1).buyTokens(data.id, 0, investor1.address, { value: 1 })
      ).to.be.revertedWith('ZERO_TOKEN');
    });

    it('should reject buying tokens for non-existing event', async () => {
      // then
      await expect(
        productions.connect(investor1).buyTokens(9999999, 10, investor1.address, { value: 1 })
      ).to.be.revertedWith('NOT_EXIST');
    });

    it('should reject buying tokens for not yet open event', async () => {
      // given
      const nonApprovedEventId = 777;
      const nonApproved = {
        ...data,
        id: nonApprovedEventId,
      };
      await productions.connect(organizer).createNewProduction(nonApproved);

      // then
      await expect(
        productions.connect(investor1).buyTokens(nonApprovedEventId, 10, investor1.address, { value: 1 })
      ).to.be.revertedWith('NOT_OPEN');
    });

    it('should reject buying tokens when sending not enough ether', async () => {
      // then
      await expect(
        productions.connect(investor1).buyTokens(data.id, 10, investor1.address, { value: 1 })
      ).to.be.revertedWith('NOT_ENOUGH_FUNDS_SENT');
    });

    it('should reject buying tokens when not enough tokens available', async () => {
      // given
      const tokensToBuy = 110;
      const cost = await productions.getNextTokensPrice(data.id, tokensToBuy);

      // then
      await expect(
        productions.connect(investor1).buyTokens(data.id, tokensToBuy, investor1.address, { value: cost })
      ).to.be.revertedWith('NOT_ENOUGH_TOKENS');
    });

    it('should send back exceeding ETH to buyer', async () => {
      // given
      const tokensToBuy = 10;
      const cost = await productions.getNextTokensPrice(data.id, tokensToBuy);
      const payment = cost.mul(10);

      // when
      await expect(
        await productions.connect(investor1).buyTokens(data.id, tokensToBuy, investor1.address, { value: payment })
      ).to.changeEtherBalance(investor1, -cost);
    });

    it('should allow to transfer token as long as there are no proceeds', async () => {
      // given
      const tokensToBuy = 10;
      const cost = await productions.getNextTokensPrice(data.id, tokensToBuy);
      const payment = cost.mul(10);
      await productions.connect(investor1).buyTokens(data.id, tokensToBuy, investor1.address, { value: payment });

      // when
      await token
        .connect(investor1)
        .safeTransferFrom(investor1.address, investor2.address, data.id, tokensToBuy / 2, []);

      // then
      expect(await token.balanceOf(investor2.address, data.id)).is.eq(tokensToBuy / 2);
      expect(await token.balanceOf(investor1.address, data.id)).is.eq(tokensToBuy / 2);
    });

    it('should not allow to transfer token when proceeds have been sent', async () => {
      // given
      const tokensToBuy = 10;
      const cost = await productions.getNextTokensPrice(data.id, tokensToBuy);
      const payment = cost.mul(10);
      await productions.connect(investor1).buyTokens(data.id, tokensToBuy, investor1.address, { value: payment });
      await productions.connect(organizer).proceeds(data.id, { value: cost });

      // when
      await expect(
        token.connect(investor1).safeTransferFrom(investor1.address, investor2.address, data.id, tokensToBuy / 2, [])
      ).to.be.revertedWith('CANNOT_TRANSFER_WHEN_PROCEEDS_EXIST');

      // then
      expect(await token.balanceOf(investor2.address, data.id)).is.eq(0);
    });
  });

  // ---------------------------------- withdrawFunds

  describe('withdrawFunds', async () => {
    const data = newProduction(1000, 100, 100_000_000_000);

    beforeEach(async () => {
      await productions.connect(organizer).createNewProduction(data);
      await productions.connect(owner).approveProduction(data.id);
    });

    it('should allow to withdraw funds after token buy', async () => {
      // given
      const tokensToBuy = 10;
      const cost = await productions.getNextTokensPrice(data.id, tokensToBuy);
      await productions.connect(investor1).buyTokens(data.id, tokensToBuy, investor1.address, { value: cost });

      // when
      const funds = await productions.connect(organizer).getWithdrawableFunds(data.id);
      await expect(await productions.connect(organizer).withdrawFunds(data.id, funds)).to.changeEtherBalance(
        organizer,
        funds
      );
      await productions.connect(investor1).buyTokens(data.id, tokensToBuy, investor1.address, { value: cost });
      await expect(productions.connect(organizer).withdrawFunds(data.id, funds))
        .to.emit(productions, 'FundsWithdrawn')
        .withArgs(data.id, organizer.address, funds);
      const updatedFunds = await productions.connect(organizer).getWithdrawableFunds(data.id);

      // then
      expect(funds).to.be.equal(cost);
      expect(updatedFunds).to.be.equal(0);
    });

    it('should refuse to withdraw more funds than available', async () => {
      // given
      const tokensToBuy = 10;
      const cost = await productions.getNextTokensPrice(data.id, tokensToBuy);
      await productions.connect(investor1).buyTokens(data.id, tokensToBuy, investor1.address, { value: cost });

      // when
      const funds = await productions.connect(organizer).getWithdrawableFunds(data.id);
      await expect(productions.connect(organizer).withdrawFunds(data.id, funds.mul(2))).to.be.revertedWith(
        'NOT_ENOUGH_FUNDS_AVAILABLE'
      );
    });

    it('should refuse to withdraw funds if not organizer', async () => {
      // when
      await expect(productions.connect(investor1).withdrawFunds(data.id, data.tokenPrice)).to.be.revertedWith(
        'NOT_ORGANIZER'
      );
    });

    it('should refuse to withdraw funds if not event owner', async () => {
      // when
      await expect(productions.connect(owner).withdrawFunds(data.id, data.tokenPrice)).to.be.revertedWith(
        'NOT_CREATOR'
      );
    });

    it('should refuse to withdraw from escrow directly', async () => {
      // given
      const escrow = await attachEscrow(data.id);

      // when
      await expect(escrow.connect(organizer).withdrawFunds(organizer.address, data.tokenPrice)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
      await expect(escrow.connect(owner).withdrawFunds(owner.address, data.tokenPrice)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });

  // ---------------------------------- proceeds

  describe('proceeds', async () => {
    const data = newProduction(1000, 100, 100_000_000_000);

    beforeEach(async () => {
      await productions.connect(organizer).createNewProduction(data);
      await productions.connect(owner).approveProduction(data.id);
    });

    it('should send proceeds and calculate token proceeds', async () => {
      // given
      const shareToBuy = 2;
      const tokensToBuy = data.tokenInvestorSupply / shareToBuy;
      const cost = await productions.getNextTokensPrice(data.id, tokensToBuy);
      await productions.connect(investor1).buyTokens(data.id, tokensToBuy, investor1.address, { value: cost });
      const proceeds = 10000;

      // when
      await expect(productions.connect(organizer).proceeds(data.id, { value: proceeds }))
        .to.emit(productions, 'ProceedsSent')
        .withArgs(data.id, organizer.address, proceeds);

      // then
      expect(await productions.connect(investor1).getWithdrawableProceeds(data.id)).to.be.equal(proceeds / shareToBuy);
    });

    it('should calculate proceeds for multiple proceed sendings and finalize with not all tokens sold', async () => {
      // given
      const shareToBuy = 2;
      const tokensToBuy = data.tokenInvestorSupply / shareToBuy;
      const cost = await productions.getNextTokensPrice(data.id, tokensToBuy);
      await productions.connect(investor1).buyTokens(data.id, tokensToBuy, investor1.address, { value: cost });
      const proceeds = data.tokenPrice;

      // when
      // proceeds 1
      await productions.connect(organizer).proceeds(data.id, { value: proceeds });
      await expect(await productions.connect(investor1).withdrawProceeds(data.id)).to.changeEtherBalance(
        investor1,
        proceeds / 2
      );

      // proceeds 2
      await productions.connect(organizer).proceeds(data.id, { value: proceeds });
      await expect(productions.connect(investor1).withdrawProceeds(data.id))
        .to.emit(productions, 'ProceedsWithdrawn')
        .withArgs(data.id, investor1.address, proceeds / 2);

      // proceeds 3 and 4
      await productions.connect(organizer).proceeds(data.id, { value: proceeds });
      await productions.connect(organizer).proceeds(data.id, { value: proceeds });

      await expect(await productions.connect(investor1).withdrawProceeds(data.id)).to.changeEtherBalance(
        investor1,
        proceeds
      );
      expect(await productions.connect(investor1).getWithdrawableProceeds(data.id)).to.be.equal(0);
      await expect(
        // Can't withdraw more than eligible
        await productions.connect(investor1).withdrawProceeds(data.id)
      ).to.changeEtherBalance(investor1, 0);

      // token price now based on positive proceeds
      const fantasticProceeds =
        (data.tokenInvestorSupply - 4) * data.tokenPrice + data.tokenInvestorSupply * data.tokenPrice;
      await productions.connect(organizer).proceeds(data.id, { value: fantasticProceeds });
      // proceed per token is now 2 times the token price - we sell the token now based on proceeds
      // investors get immediately out

      const newPricePerToken = await productions.getNextTokensPrice(data.id, 1);
      expect(newPricePerToken).to.eq(BigNumber.from(data.tokenPrice).mul(2));

      // Finish event, only 50% of tokens sold. Now proceeds calculation can be done based on tokens sold:
      await productions.connect(organizer).finish(data.id, { value: 0 });
      expect(await productions.connect(investor1).getWithdrawableProceeds(data.id)).to.be.equal(
        // new token price was new proceeds per token. Now we finish and have only 50% sold, so this doubles.
        // Multiply with tokens we own and subtract the proceeds we have already taken.
        newPricePerToken
          .mul(2)
          .mul(tokensToBuy)
          .sub(proceeds * 2)
      );

      // event finished, no more tokens to buy
      await expect(
        productions.connect(investor1).buyTokens(data.id, tokensToBuy, investor1.address, { value: cost })
      ).to.be.revertedWith('NOT_OPEN');
    });

    it('should still allow buying tokens after first proceed send', async () => {
      // given
      const shareToBuy = 4;
      const tokensToBuy = data.tokenInvestorSupply / shareToBuy;
      let cost = await productions.getNextTokensPrice(data.id, tokensToBuy);
      await productions.connect(investor1).buyTokens(data.id, tokensToBuy, investor1.address, { value: cost });
      const proceeds = data.tokenPrice;

      // when
      expect(await token.canTransfer(data.id, investor1.address, investor2.address, 1)).to.be.true;
      await token.connect(investor1).safeTransferFrom(investor1.address, investor2.address, data.id, 1, []);
      await productions.connect(organizer).proceeds(data.id, { value: proceeds });
      cost = await productions.getNextTokensPrice(data.id, tokensToBuy);
      await productions.connect(investor2).buyTokens(data.id, tokensToBuy, investor2.address, { value: cost });

      expect(await token.canTransfer(data.id, investor1.address, investor2.address, 1)).to.be.false;
      await expect(
        token.connect(investor1).safeTransferFrom(investor1.address, organizer.address, data.id, tokensToBuy, [])
      ).to.be.revertedWith('CANNOT_TRANSFER_WHEN_PROCEEDS_EXIST');
    });

    it('should reject proceeds if not organizer', async () => {
      // given

      // when
      await expect(productions.connect(investor1).proceeds(data.id, { value: data.tokenPrice })).to.be.revertedWith(
        'NOT_ORGANIZER'
      );
    });

    it('should reject 0 proceeds', async () => {
      // given

      // when
      await expect(productions.connect(organizer).proceeds(data.id, { value: 0 })).to.be.revertedWith('ZERO_VALUE');
    });

    it('should reject not existing event proceeds', async () => {
      // given

      // when
      await expect(productions.connect(organizer).proceeds(451234434, { value: 100000 })).to.be.revertedWith(
        'NOT_EXIST'
      );
    });

    it('should reject proceeds on closed event', async () => {
      // given
      await productions.connect(investor1).buyTokens(data.id, 1, investor1.address, { value: data.tokenPrice });
      await expect(productions.connect(organizer).finish(data.id, { value: 100000 }))
        .to.emit(productions, 'ProductionFinished')
        .withArgs(data.id)
        .and.to.emit(productions, 'ProceedsSent')
        .withArgs(data.id, organizer.address, 100000);

      // when
      await expect(productions.connect(organizer).proceeds(data.id, { value: 100000 })).to.be.revertedWith('NOT_OPEN');
    });
  });
});
