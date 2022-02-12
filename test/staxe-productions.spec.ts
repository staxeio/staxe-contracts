import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  ProductionEscrow,
  StaxeDAOToken,
  StaxeEscrowFactory,
  StaxeMembers,
  StaxeProductions,
  StaxeProductionToken,
} from '../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BigNumber } from 'ethers';

describe('StaxeProductions', function () {
  // contracts
  let token: StaxeProductionToken;
  let productions: StaxeProductions;

  // actors
  let owner: SignerWithAddress;
  let organizer: SignerWithAddress;
  let approver: SignerWithAddress;
  let investor1: SignerWithAddress;
  let investor2: SignerWithAddress;
  let treasury: SignerWithAddress;
  let addresses: SignerWithAddress[];

  const attachEscrow = async (id: number) => {
    const productionEscrowFactory = await ethers.getContractFactory('ProductionEscrow');
    const deposits = (await productions.getProductionData(id)).deposits;
    return productionEscrowFactory.attach(deposits) as ProductionEscrow;
  };

  beforeEach(async () => {
    [owner, organizer, approver, investor1, investor2, treasury, ...addresses] = await ethers.getSigners();

    // create contracts
    // --- production token
    const tokenFactory = await ethers.getContractFactory('StaxeProductionToken');
    token = (await tokenFactory.deploy()) as StaxeProductionToken;

    // --- DAO token
    const daoTokenFactory = await ethers.getContractFactory('StaxeDAOToken');
    const daoToken = (await daoTokenFactory.deploy(owner.getAddress(), 1000, 1000)) as StaxeDAOToken;

    const membersFactory = await ethers.getContractFactory('StaxeMembers');
    const members = (await membersFactory.deploy(daoToken.address)) as StaxeMembers;

    // --- escrow factory
    const escrowFactoryFactory = await ethers.getContractFactory('StaxeEscrowFactory');
    const escrowFactory = (await escrowFactoryFactory.deploy()) as StaxeEscrowFactory;

    // --- productions
    const productionsFactory = await ethers.getContractFactory('StaxeProductions');
    productions = (await productionsFactory.deploy(
      token.address,
      escrowFactory.address,
      members.address,
      treasury.address
    )) as StaxeProductions;
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
      const data = {
        id: 1000,
        tokenSupply: 100,
        tokenPrice: 5000,
      };

      // when
      await expect(productions.connect(organizer).createNewProduction(data.id, data.tokenSupply, 0, 0, data.tokenPrice))
        .to.emit(productions, 'ProductionCreated')
        .withArgs(data.id, organizer.address, data.tokenSupply, 0, 0);
      const created = await productions.getProductionData(data.id);

      // then
      expect(created.id).to.equal(data.id);
      expect(created.tokenSupply).to.equal(data.tokenSupply);
      expect(created.tokenPrice).to.equal(data.tokenPrice);
      expect(created.tokensSoldCounter).to.equal(0);
      expect(created.state).to.equal(1);
      expect(created.creator).to.equal(organizer.address);
      expect(await token.balanceOf(created.deposits, data.id)).to.equal(data.tokenSupply);
    });

    it('should create new production with treasury and organizer share', async () => {
      // given
      const data = {
        id: 1000,
        tokenInvestorSupply: 100,
        tokenOrganizerSupply: 10,
        tokenTreasurySupply: 10,
        tokenPrice: 5000,
      };

      // when
      await expect(
        productions
          .connect(organizer)
          .createNewProduction(
            data.id,
            data.tokenInvestorSupply,
            data.tokenOrganizerSupply,
            data.tokenTreasurySupply,
            data.tokenPrice
          )
      )
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
      await expect(productions.connect(investor1).createNewProduction(4000, 1, 0, 0, 1)).to.be.revertedWith(
        'NOT_ORGANIZER'
      );
    });

    it('should fail to create production with id 0', async () => {
      // then
      await expect(productions.connect(organizer).createNewProduction(0, 1, 0, 0, 1)).to.be.revertedWith(
        'ID_0_NOT_ALLOWED'
      );
    });

    it('should fail to create production with id that already exists', async () => {
      // given
      const id = 6000;
      await productions.connect(organizer).createNewProduction(id, 1, 0, 0, 1);
      // then
      await expect(productions.connect(organizer).createNewProduction(id, 1, 0, 0, 1)).to.be.revertedWith(
        'PRODUCTION_EXISTS'
      );
    });
  });

  // ---------------------------------- getProductionData

  describe('getProductionData', async () => {
    it('should get production data after create', async () => {
      // given
      const id = 600;
      await productions.connect(organizer).createNewProduction(id, 100, 0, 0, 1000);
      await productions.connect(organizer).createNewProduction(id + 1, 100, 0, 0, 2000);

      // when
      const data1 = await productions.getProductionData(id);
      const data2 = await productions.getProductionDataForProductions([id, id + 1]);

      // then
      expect(data1.id).to.be.equal(id);
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
      await productions.connect(organizer).createNewProduction(id, 100, 0, 0, 1000);

      // when
      await productions.connect(approver).approveProduction(id);

      // then
      expect((await productions.getProductionData(id)).state).to.equal(2);
    });

    it('should reject approval by non-approver', async () => {
      // given
      const id = 500;
      await productions.connect(organizer).createNewProduction(id, 100, 0, 0, 1000);

      // then
      await expect(productions.connect(organizer).approveProduction(id)).to.be.revertedWith('NOT_APPROVER');
    });
  });

  // ---------------------------------- declineProduction

  describe('declineProduction', async () => {
    it('should decline production by approver', async () => {
      // given
      const id = 500;
      await productions.connect(organizer).createNewProduction(id, 100, 0, 0, 1000);

      // when
      await productions.connect(approver).declineProduction(id);

      // then
      expect((await productions.getProductionData(id)).state).to.equal(4);
    });

    it('should reject decline by non-approver', async () => {
      // given
      const id = 500;
      await productions.connect(organizer).createNewProduction(id, 100, 0, 0, 1000);

      // then
      await expect(productions.connect(organizer).declineProduction(id)).to.be.revertedWith('NOT_APPROVER');
    });
  });

  // ---------------------------------- buyTokens

  describe('buyTokens', async () => {
    const data = {
      id: 600,
      tokenSupply: 100,
      tokenPrice: 100000000000,
    };

    beforeEach(async () => {
      await productions.connect(organizer).createNewProduction(data.id, data.tokenSupply, 0, 0, data.tokenPrice);
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
      await productions.connect(investor1).buyTokens(data.id, tokensToBuy, { value: cost });
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
      await productions.connect(organizer).buyTokens(data.id, tokensToBuy, { value: cost });

      // then
      expect(await token.balanceOf(organizer.address, data.id)).to.be.equal(tokensToBuy);
    });

    it('should reject buying tokens when buying 0 tokens', async () => {
      // then
      await expect(productions.connect(investor1).buyTokens(data.id, 0, { value: 1 })).to.be.revertedWith('ZERO_TOKEN');
    });

    it('should reject buying tokens for non-existing event', async () => {
      // then
      await expect(productions.connect(investor1).buyTokens(9999999, 10, { value: 1 })).to.be.revertedWith('NOT_EXIST');
    });

    it('should reject buying tokens for not yet open event', async () => {
      // given
      const nonApprovedEventId = 777;
      await productions
        .connect(organizer)
        .createNewProduction(nonApprovedEventId, data.tokenSupply, 0, 0, data.tokenPrice);

      // then
      await expect(productions.connect(investor1).buyTokens(nonApprovedEventId, 10, { value: 1 })).to.be.revertedWith(
        'NOT_OPEN'
      );
    });

    it('should reject buying tokens when sending not enough ether', async () => {
      // then
      await expect(productions.connect(investor1).buyTokens(data.id, 10, { value: 1 })).to.be.revertedWith(
        'NOT_ENOUGH_FUNDS_SENT'
      );
    });

    it('should reject buying tokens when not enough tokens available', async () => {
      // given
      const tokensToBuy = 110;
      const cost = await productions.getNextTokensPrice(data.id, tokensToBuy);

      // then
      await expect(productions.connect(investor1).buyTokens(data.id, tokensToBuy, { value: cost })).to.be.revertedWith(
        'NOT_ENOUGH_TOKENS'
      );
    });

    it('should send back exceeding ETH to buyer', async () => {
      // given
      const tokensToBuy = 10;
      const cost = await productions.getNextTokensPrice(data.id, tokensToBuy);
      const payment = cost.mul(10);

      // when
      await expect(
        await productions.connect(investor1).buyTokens(data.id, tokensToBuy, { value: payment })
      ).to.changeEtherBalance(investor1, -cost);
    });

    it('should allow to transfer token as long as there are no proceeds', async () => {
      // given
      const tokensToBuy = 10;
      const cost = await productions.getNextTokensPrice(data.id, tokensToBuy);
      const payment = cost.mul(10);
      await productions.connect(investor1).buyTokens(data.id, tokensToBuy, { value: payment });

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
      await productions.connect(investor1).buyTokens(data.id, tokensToBuy, { value: payment });
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
    const data = {
      id: 1000,
      tokenSupply: 100,
      tokenPrice: 100_000_000_000,
    };

    beforeEach(async () => {
      await productions.connect(organizer).createNewProduction(data.id, data.tokenSupply, 0, 0, data.tokenPrice);
      await productions.connect(owner).approveProduction(data.id);
    });

    it('should allow to withdraw funds after token buy', async () => {
      // given
      const tokensToBuy = 10;
      const cost = await productions.getNextTokensPrice(data.id, tokensToBuy);
      await productions.connect(investor1).buyTokens(data.id, tokensToBuy, { value: cost });
      const escrow = await attachEscrow(data.id);

      // when
      const funds = await escrow.connect(organizer).getWithdrawableFunds();
      await expect(await productions.connect(organizer).withdrawFunds(data.id, funds)).to.changeEtherBalance(
        organizer,
        funds
      );
      const updatedFunds = await escrow.connect(organizer).getWithdrawableFunds();

      // then
      expect(funds).to.be.equal(cost);
      expect(updatedFunds).to.be.equal(0);
    });

    it('should refuse to withdraw more funds than available', async () => {
      // given
      const tokensToBuy = 10;
      const cost = await productions.getNextTokensPrice(data.id, tokensToBuy);
      await productions.connect(investor1).buyTokens(data.id, tokensToBuy, { value: cost });
      const escrow = await attachEscrow(data.id);

      // when
      const funds = await escrow.connect(organizer).getWithdrawableFunds();
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
    const eventData = {
      id: 1000,
      tokenSupply: 100,
      tokenPrice: 100_000_000_000,
    };

    beforeEach(async () => {
      await productions
        .connect(organizer)
        .createNewProduction(eventData.id, eventData.tokenSupply, 0, 0, eventData.tokenPrice);
      await productions.connect(owner).approveProduction(eventData.id);
    });

    it('should send proceeds and calculate token proceeds', async () => {
      // given
      const shareToBuy = 2;
      const tokensToBuy = eventData.tokenSupply / shareToBuy;
      const cost = await productions.getNextTokensPrice(eventData.id, tokensToBuy);
      await productions.connect(investor1).buyTokens(eventData.id, tokensToBuy, { value: cost });
      const proceeds = 10000;

      // when
      await productions.connect(organizer).proceeds(eventData.id, { value: proceeds });

      // then
      const escrow = await attachEscrow(eventData.id);

      expect(await escrow.getWithdrawableProceeds(investor1.address)).to.be.equal(proceeds / shareToBuy);
    });

    it('should calculate proceeds for multiple proceed sendings and finalize with not all tokens sold', async () => {
      // given
      const shareToBuy = 2;
      const tokensToBuy = eventData.tokenSupply / shareToBuy;
      const cost = await productions.getNextTokensPrice(eventData.id, tokensToBuy);
      await productions.connect(investor1).buyTokens(eventData.id, tokensToBuy, { value: cost });
      const proceeds = eventData.tokenPrice;
      const escrow = await attachEscrow(eventData.id);

      // when
      // proceeds 1
      await productions.connect(organizer).proceeds(eventData.id, { value: proceeds });
      await productions.connect(investor1).withdrawProceeds(eventData.id, proceeds / shareToBuy);

      // proceeds 2
      await productions.connect(organizer).proceeds(eventData.id, { value: proceeds });
      await productions.connect(investor1).withdrawProceeds(eventData.id, proceeds / shareToBuy);

      // proceeds 3 and 4
      await productions.connect(organizer).proceeds(eventData.id, { value: proceeds });
      await productions.connect(organizer).proceeds(eventData.id, { value: proceeds });

      await productions.connect(investor1).withdrawProceeds(eventData.id, proceeds);
      expect(await escrow.getWithdrawableProceeds(investor1.address)).to.be.equal(0);
      await expect(
        // Can't withdraw more than eligible
        productions.connect(investor1).withdrawProceeds(eventData.id, proceeds)
      ).to.be.revertedWith('NOT_ENOUGH_PROCEEDS_AVAILABLE');

      // token price now based on positive proceeds
      const fantasticProceeds =
        (eventData.tokenSupply - 4) * eventData.tokenPrice + eventData.tokenSupply * eventData.tokenPrice;
      await productions.connect(organizer).proceeds(eventData.id, { value: fantasticProceeds });
      // proceed per token is now 2 times the token price - we sell the token now based on proceeds
      // investors get immediately out

      const newPricePerToken = await productions.getNextTokensPrice(eventData.id, 1);
      expect(newPricePerToken).to.eq(BigNumber.from(eventData.tokenPrice).mul(2));

      // Finish event, only 50% of tokens sold. Now proceeds calculation can be done based on tokens sold:
      await productions.connect(organizer).finish(eventData.id, { value: 0 });
      expect(await escrow.getWithdrawableProceeds(investor1.address)).to.be.equal(
        // new token price was new proceeds per token. Now we finish and have only 50% sold, so this doubles.
        // Multiply with tokens we own and subtract the proceeds we have already taken.
        newPricePerToken
          .mul(2)
          .mul(tokensToBuy)
          .sub(proceeds * 2)
      );

      // event finished, no more tokens to buy
      await expect(
        productions.connect(investor1).buyTokens(eventData.id, tokensToBuy, { value: cost })
      ).to.be.revertedWith('NOT_OPEN');
    });

    it('should reject proceeds if not organizer', async () => {
      // given

      // when
      await expect(
        productions.connect(investor1).proceeds(eventData.id, { value: eventData.tokenPrice })
      ).to.be.revertedWith('NOT_ORGANIZER');
    });

    it('should reject 0 proceeds', async () => {
      // given

      // when
      await expect(productions.connect(organizer).proceeds(eventData.id, { value: 0 })).to.be.revertedWith(
        'ZERO_VALUE'
      );
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
      await productions.connect(investor1).buyTokens(eventData.id, 1, { value: eventData.tokenPrice });
      await productions.connect(organizer).finish(eventData.id, { value: 100000 });

      // when
      await expect(productions.connect(organizer).proceeds(eventData.id, { value: 100000 })).to.be.revertedWith(
        'NOT_OPEN'
      );
    });
  });
});
