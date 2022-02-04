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
  let addresses: SignerWithAddress[];

  beforeEach(async () => {
    [owner, organizer, approver, investor1, investor2, ...addresses] = await ethers.getSigners();

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
      members.address
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
      await expect(productions.connect(organizer).createNewProduction(data.id, data.tokenSupply, data.tokenPrice))
        .to.emit(productions, 'ProductionCreated')
        .withArgs(data.id, organizer.address, data.tokenSupply);
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

    it('should fail to create event if not an organizer', async () => {
      // then
      await expect(productions.connect(investor1).createNewProduction(4000, 1, 1)).to.be.revertedWith('NOT_ORGANIZER');
    });

    it('should fail to create production with id 0', async () => {
      // then
      await expect(productions.connect(organizer).createNewProduction(0, 1, 1)).to.be.revertedWith('ID_0_NOT_ALLOWED');
    });

    it('should fail to create production with id that already exists', async () => {
      // given
      const id = 6000;
      await productions.connect(organizer).createNewProduction(id, 1, 1);
      // then
      await expect(productions.connect(organizer).createNewProduction(id, 1, 1)).to.be.revertedWith(
        'PRODUCTION_EXISTS'
      );
    });
  });

  // ---------------------------------- getProductionData

  describe('getProductionData', async () => {
    it('should get production data after create', async () => {
      // given
      const id = 600;
      await productions.connect(organizer).createNewProduction(id, 100, 1000);
      await productions.connect(organizer).createNewProduction(id + 1, 100, 2000);

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
      await productions.connect(organizer).createNewProduction(id, 100, 1000);

      // when
      await productions.connect(approver).approveProduction(id);

      // then
      expect((await productions.getProductionData(id)).state).to.equal(2);
    });

    it('should reject approval by non-approver', async () => {
      // given
      const id = 500;
      await productions.connect(organizer).createNewProduction(id, 100, 1000);

      // then
      await expect(productions.connect(organizer).approveProduction(id)).to.be.revertedWith('NOT_APPROVER');
    });
  });

  // ---------------------------------- declineProduction

  describe('declineProduction', async () => {
    it('should decline production by approver', async () => {
      // given
      const id = 500;
      await productions.connect(organizer).createNewProduction(id, 100, 1000);

      // when
      await productions.connect(approver).declineProduction(id);

      // then
      expect((await productions.getProductionData(id)).state).to.equal(4);
    });

    it('should reject decline by non-approver', async () => {
      // given
      const id = 500;
      await productions.connect(organizer).createNewProduction(id, 100, 1000);

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
      await productions.connect(organizer).createNewProduction(data.id, data.tokenSupply, data.tokenPrice);
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
      await productions.connect(organizer).createNewProduction(nonApprovedEventId, data.tokenSupply, data.tokenPrice);

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
  });

  // ---------------------------------- proceeds

  describe('proceeds', async () => {
    const eventData = {
      id: 1000,
      tokenSupply: 100,
      tokenPrice: 100000000000,
    };

    beforeEach(async () => {
      await productions
        .connect(organizer)
        .createNewProduction(eventData.id, eventData.tokenSupply, eventData.tokenPrice);
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
      const productionEscrowFactory = await ethers.getContractFactory('ProductionEscrow');
      const deposits = (await productions.getProductionData(eventData.id)).deposits;
      const escrow = productionEscrowFactory.attach(deposits) as ProductionEscrow;

      expect(await escrow.getWithdrawableProceeds(investor1.address)).to.be.equal(proceeds / shareToBuy);
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