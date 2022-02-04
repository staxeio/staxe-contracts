/*import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { EventEscrowFactory, StaxeEvents, StaxeEventToken } from '../typechain';

describe('StaxeEvents', () => {
  // contracts
  let token: StaxeEventToken;
  let events: StaxeEvents;

  // actors
  let owner: SignerWithAddress;
  let organizer: SignerWithAddress;
  let approver: SignerWithAddress;
  let investor1: SignerWithAddress;
  let investor2: SignerWithAddress;
  let addresses;

  beforeEach(async () => {
    [owner, organizer, approver, investor1, investor2, ...addresses] = await ethers.getSigners();

    // create contracts
    const tokenFactory = await ethers.getContractFactory('StaxeEventToken');
    token = (await tokenFactory.deploy()) as StaxeEventToken;
    const escrowFactoryFactory = await ethers.getContractFactory('EventEscrowFactory');
    const escrowFactory = (await escrowFactoryFactory.deploy()) as EventEscrowFactory;
    const eventsFactory = await ethers.getContractFactory('StaxeEvents');
    events = (await eventsFactory.deploy(token.address, escrowFactory.address)) as StaxeEvents;
    await token.grantRole(await token.MINTER_ROLE(), events.address);

    // define roles
    await events.grantRole(await events.INVESTOR_ROLE(), investor1.address);
    await events.grantRole(await events.INVESTOR_ROLE(), investor2.address);
    await events.grantRole(await events.ORGANIZER_ROLE(), organizer.address);
    await events.grantRole(await events.APPROVER_ROLE(), approver.address);
  });

  // ---------------------------------- createNewEvent

  describe('createNewEvent', async () => {
    it('should create new event', async () => {
      // given
      const eventData = {
        eventId: 1000,
        tokenSupply: 100,
        tokenSellPrice: 5000,
      };

      // when
      await expect(
        events.connect(organizer).createNewEvent(eventData.eventId, eventData.tokenSupply, eventData.tokenSellPrice)
      )
        .to.emit(events, 'EventCreated')
        .withArgs(eventData.eventId, await organizer.getAddress(), eventData.tokenSupply);
      const created = await events.getEventData(eventData.eventId);

      // then
      expect(created.eventId).to.equal(eventData.eventId);
      expect(created.tokenSupply).to.equal(eventData.tokenSupply);
      expect(created.tokenSellPrice).to.equal(eventData.tokenSellPrice);
      expect(created.tokensSoldCounter).to.equal(0);
      expect(created.eventState).to.equal(1);
      expect(created.creator).to.equal(organizer.address);
      expect(await token.balanceOf(created.deposits, eventData.eventId)).to.equal(eventData.tokenSupply);
    });

    it('should fail to create event if not an organizer', async () => {
      // then
      await expect(events.connect(investor1).createNewEvent(4000, 1, 1)).to.be.revertedWith('NOT_ORGANIZER');
    });

    it('should fail to create event with id 0', async () => {
      // then
      await expect(events.connect(organizer).createNewEvent(0, 1, 1)).to.be.revertedWith('EVENT_ID_0');
    });

    it('should fail to create event with id that already exists', async () => {
      // given
      const eventId = 6000;
      await events.connect(organizer).createNewEvent(eventId, 1, 1);
      // then
      await expect(events.connect(organizer).createNewEvent(eventId, 1, 1)).to.be.revertedWith('EVENT_EXISTS');
    });
  });

  // ---------------------------------- getEventData

  describe('getEventData', async () => {
    it('should get event data after create', async () => {
      // given
      const eventId = 600;
      await events.connect(organizer).createNewEvent(eventId, 100, 1000);
      await events.connect(organizer).createNewEvent(eventId + 1, 100, 2000);

      // when
      const event1 = await events.getEventData(eventId);
      const event2 = await events.getEventDataForEvents([eventId, eventId + 1]);

      // then
      expect(event1.eventId).to.be.equal(eventId);
      expect(event2.length).to.be.equal(2);
      expect(event2[0].eventId).to.be.equal(eventId);
      expect(event2[1].eventId).to.be.equal(eventId + 1);
    });
  });

  // ---------------------------------- approveEvent

  describe('approveEvent', async () => {
    it('should approve event by approver', async () => {
      // given
      const eventId = 500;
      await events.connect(organizer).createNewEvent(eventId, 100, 1000);

      // when
      await events.connect(approver).approveEvent(eventId);

      // then
      expect((await events.getEventData(eventId)).eventState).to.equal(2);
    });

    it('should reject approval by non-approver', async () => {
      // given
      const eventId = 500;
      await events.connect(organizer).createNewEvent(eventId, 100, 1000);

      // then
      await expect(events.connect(organizer).approveEvent(eventId)).to.be.revertedWith('NOT_APPROVER');
    });
  });

  // ---------------------------------- declineEvent

  describe('declineEvent', async () => {
    it('should decline event by approver', async () => {
      // given
      const eventId = 500;
      await events.connect(organizer).createNewEvent(eventId, 100, 1000);

      // when
      await events.connect(approver).declineEvent(eventId);

      // then
      expect((await events.getEventData(eventId)).eventState).to.equal(4);
    });

    it('should reject decline by non-approver', async () => {
      // given
      const eventId = 500;
      await events.connect(organizer).createNewEvent(eventId, 100, 1000);

      // then
      await expect(events.connect(organizer).declineEvent(eventId)).to.be.revertedWith('NOT_APPROVER');
    });
  });

  // ---------------------------------- buyEventTokens

  describe('buyEventTokens', async () => {
    const eventData = {
      eventId: 600,
      tokenSupply: 100,
      tokenPrice: 100000000000,
    };

    beforeEach(async () => {
      await events.connect(organizer).createNewEvent(eventData.eventId, eventData.tokenSupply, eventData.tokenPrice);
      await events.connect(owner).approveEvent(eventData.eventId);
    });

    it('should calculate token price', async () => {
      // given
      const tokensToBuy = 10;

      // when
      const cost = await events.getTokenPrice(eventData.eventId, tokensToBuy);

      // then
      expect(cost).to.equal(eventData.tokenPrice * tokensToBuy);
    });

    it('should buying tokens', async () => {
      // given
      const tokensToBuy = 10;
      const cost = await events.getTokenPrice(eventData.eventId, tokensToBuy);

      // when
      await events.connect(investor1).buyEventTokens(eventData.eventId, tokensToBuy, { value: cost });
      const data = await events.getEventData(eventData.eventId);

      // then
      expect(await token.balanceOf(investor1.address, eventData.eventId)).to.be.equal(tokensToBuy);
      expect(await token.provider.getBalance(data.deposits)).to.be.equal(cost);
      expect(data.tokensSoldCounter).to.be.equal(tokensToBuy);
    });

    it('should reject buying tokens by non-investor', async () => {
      // then
      await expect(events.connect(organizer).buyEventTokens(eventData.eventId, 10)).to.be.revertedWith('NOT_INVESTOR');
    });

    it('should reject buying tokens when sending 0 value', async () => {
      // then
      await expect(events.connect(investor1).buyEventTokens(eventData.eventId, 10, { value: 0 })).to.be.revertedWith(
        'ZERO_VALUE'
      );
    });

    it('should reject buying tokens when buying 0 tokens', async () => {
      // then
      await expect(events.connect(investor1).buyEventTokens(eventData.eventId, 0, { value: 1 })).to.be.revertedWith(
        'ZERO_TOKEN'
      );
    });

    it('should reject buying tokens for non-existing event', async () => {
      // then
      await expect(events.connect(investor1).buyEventTokens(9999999, 10, { value: 1 })).to.be.revertedWith('NOT_EXIST');
    });

    it('should reject buying tokens for not yet open event', async () => {
      // given
      const nonApprovedEventId = 777;
      await events.connect(organizer).createNewEvent(nonApprovedEventId, eventData.tokenSupply, eventData.tokenPrice);

      // then
      await expect(events.connect(investor1).buyEventTokens(nonApprovedEventId, 10, { value: 1 })).to.be.revertedWith(
        'NOT_OPEN'
      );
    });

    it('should reject buying tokens when sending not enough ether', async () => {
      // then
      await expect(events.connect(investor1).buyEventTokens(eventData.eventId, 10, { value: 1 })).to.be.revertedWith(
        'NOT_ENOUGH_MONEY_SENT'
      );
    });

    it('should reject buying tokens when not enough tokens available', async () => {
      // given
      const tokensToBuy = 110;
      const cost = await events.getTokenPrice(eventData.eventId, tokensToBuy);

      // then
      await expect(
        events.connect(investor1).buyEventTokens(eventData.eventId, tokensToBuy, { value: cost })
      ).to.be.revertedWith('NOT_ENOUGH_TOKENS');
    });

    it('should send back exceeding ETH to buyer', async () => {
      // given
      const tokensToBuy = 10;
      const cost = await events.getTokenPrice(eventData.eventId, tokensToBuy);
      const payment = cost.mul(100);
      const balanceBefore = await investor1.getBalance();

      // when
      const tx = await events
        .connect(investor1)
        .buyEventTokens(eventData.eventId, tokensToBuy, { value: payment, gasPrice: 0 });

      // then
      const balanceAfter = await investor1.getBalance();
      expect(balanceAfter.add(cost)).to.be.equal(balanceBefore);
    });
  });

  // ---------------------------------- hasRoleAssigned

  describe('hasRoleAssigned', async () => {
    it('should resolve role by string', async () => {
      // given
      const eventId = 500;
      await events.connect(organizer).createNewEvent(eventId, 100, 1000);

      // when
      const hasRole1 = await events.connect(organizer).hasRoleAssigned('ORGANIZER_ROLE');
      const hasRole2 = await events.connect(organizer).hasRoleAssigned('INVESTOR_ROLE');

      // then
      expect(hasRole1).to.be.equal(true);
      expect(hasRole2).to.be.equal(false);
    });
  });

  // ---------------------------------- withdrawFunds

  describe('withdrawFunds', async () => {
    const eventData = {
      eventId: 900,
      tokenSupply: 100,
      tokenPrice: 100000000000,
    };

    beforeEach(async () => {
      await events.connect(organizer).createNewEvent(eventData.eventId, eventData.tokenSupply, eventData.tokenPrice);
      await events.connect(owner).approveEvent(eventData.eventId);
    });

    it('should withdraw funds and add to balance', async () => {
      // given
      const tokensToBuy = 50;
      const cost = await events.getTokenPrice(eventData.eventId, tokensToBuy);
      events.connect(investor1).buyEventTokens(eventData.eventId, tokensToBuy, { value: cost });
      const balanceBefore = await organizer.getBalance();

      // when
      await expect(
        await events.connect(organizer).withdrawFunds(eventData.eventId, cost, { gasPrice: 0 })
      ).to.changeEtherBalance(organizer, cost);

      // then
      const balanceAfter = await organizer.getBalance();
      expect(balanceAfter).to.be.equal(balanceBefore.add(cost));
    });

    it('should reject withdraw when not event owner', async () => {
      // given
      const tokensToBuy = 50;
      const cost = await events.getTokenPrice(eventData.eventId, tokensToBuy);
      events.connect(investor1).buyEventTokens(eventData.eventId, tokensToBuy, { value: cost });

      // then
      await expect(events.connect(owner).withdrawFunds(eventData.eventId, cost)).to.be.revertedWith('NOT_ELIGIBLE');
      await expect(events.connect(investor1).withdrawFunds(eventData.eventId, cost)).to.be.revertedWith(
        'NOT_ORGANIZER'
      );
    });

    it('should reject withdraw when not enough funds', async () => {
      // given
      const tokensToBuy = 50;
      const cost = await events.getTokenPrice(eventData.eventId, tokensToBuy);
      events.connect(investor1).buyEventTokens(eventData.eventId, tokensToBuy, { value: cost });

      // when
      await events.connect(organizer).withdrawFunds(eventData.eventId, cost, { gasPrice: 0 });

      // then
      await expect(events.connect(organizer).withdrawFunds(eventData.eventId, cost)).to.be.revertedWith(
        'NOT_ENOUGH_FUNDS'
      );
    });

    it('should reject withdraw with 0 value', async () => {
      // given
      const tokensToBuy = 50;
      const cost = await events.getTokenPrice(eventData.eventId, tokensToBuy);
      events.connect(investor1).buyEventTokens(eventData.eventId, tokensToBuy, { value: cost });

      // then
      await expect(events.connect(organizer).withdrawFunds(eventData.eventId, 0)).to.be.revertedWith('NOT_ZERO');
    });

    it('should reject withdraw when not open', async () => {
      // given
      await events
        .connect(organizer)
        .createNewEvent(eventData.eventId + 1, eventData.tokenSupply, eventData.tokenPrice);

      // then
      await expect(events.connect(organizer).withdrawFunds(eventData.eventId + 1, 10)).to.be.revertedWith('NOT_OPEN');
    });
  });

  // ---------------------------------- proceeds

  describe('proceeds', async () => {
    const eventData = {
      eventId: 1000,
      tokenSupply: 100,
      tokenPrice: 100000000000,
    };

    beforeEach(async () => {
      await events.connect(organizer).createNewEvent(eventData.eventId, eventData.tokenSupply, eventData.tokenPrice);
      await events.connect(owner).approveEvent(eventData.eventId);
    });

    it('should send proceeds and calculate token price: scenario 1 (proceeds on empty deposits)', async () => {
      // given
      const tokensToBuy = 50;
      const cost = await events.getTokenPrice(eventData.eventId, tokensToBuy);
      events.connect(investor1).buyEventTokens(eventData.eventId, tokensToBuy, { value: cost });
      events.connect(organizer).withdrawFunds(eventData.eventId, cost);
      const proceeds = cost.mul(2);

      // when
      await expect(events.connect(organizer).proceeds(eventData.eventId, { value: proceeds, gasPrice: 0 }))
        .to.emit(events, 'EventFinished')
        .withArgs(eventData.eventId, proceeds, eventData.tokenPrice * 2);

      // then
      const eventDataUpdated = await events.getEventData(eventData.eventId);
      expect(eventDataUpdated.tokenBuyPrice).to.be.equal(eventDataUpdated.tokenSellPrice.mul(2));
      expect(await events.provider.getBalance(eventDataUpdated.deposits)).to.be.equal(proceeds);
    });

    it('should send proceeds and calculate token price: scenario 2 (procees on non-empty deposits)', async () => {
      // given
      const tokensToBuy = 50;
      const cost = await events.getTokenPrice(eventData.eventId, tokensToBuy);
      events.connect(investor1).buyEventTokens(eventData.eventId, tokensToBuy, { value: cost });
      events.connect(investor2).buyEventTokens(eventData.eventId, tokensToBuy, { value: cost });
      events.connect(organizer).withdrawFunds(eventData.eventId, cost);
      const proceeds = cost;

      // when
      await expect(events.connect(organizer).proceeds(eventData.eventId, { value: proceeds, gasPrice: 0 }))
        .to.emit(events, 'EventFinished')
        .withArgs(eventData.eventId, proceeds, eventData.tokenPrice);

      // then
      const eventDataUpdated = await events.getEventData(eventData.eventId);
      expect(eventDataUpdated.tokenBuyPrice).to.be.equal(eventDataUpdated.tokenSellPrice);
      expect(await events.provider.getBalance(eventDataUpdated.deposits)).to.be.equal(proceeds.mul(2));
    });

    it('should send proceeds and calculate token price: scenario 3 (ignore non-dividable overflow)', async () => {
      // given
      const tokensToBuy = 50;
      const cost = await events.getTokenPrice(eventData.eventId, tokensToBuy);
      events.connect(investor1).buyEventTokens(eventData.eventId, tokensToBuy, { value: cost });
      events.connect(investor2).buyEventTokens(eventData.eventId, tokensToBuy, { value: cost });
      events.connect(organizer).withdrawFunds(eventData.eventId, cost);
      const proceeds = cost;
      const proceedsWithOverflow = proceeds.add(BigNumber.from(eventData.tokenSupply - 1));

      // when
      await expect(events.connect(organizer).proceeds(eventData.eventId, { value: proceedsWithOverflow, gasPrice: 0 }))
        .to.emit(events, 'EventFinished')
        .withArgs(eventData.eventId, proceeds, eventData.tokenPrice);

      // then
      const eventDataUpdated = await events.getEventData(eventData.eventId);
      expect(eventDataUpdated.tokenBuyPrice).to.be.equal(eventDataUpdated.tokenSellPrice);
      expect(await events.provider.getBalance(eventDataUpdated.deposits)).to.be.equal(proceeds.mul(2));
    });

    it('should reject proceeds if not organizer', async () => {
      // given

      // when
      await expect(
        events.connect(investor1).proceeds(eventData.eventId, { value: eventData.tokenPrice, gasPrice: 0 })
      ).to.be.revertedWith('NOT_ORGANIZER');
    });

    it('should reject 0 proceeds', async () => {
      // given

      // when
      await expect(events.connect(organizer).proceeds(eventData.eventId, { value: 0, gasPrice: 0 })).to.be.revertedWith(
        'ZERO_VALUE'
      );
    });

    it('should reject not existing event proceeds', async () => {
      // given

      // when
      await expect(events.connect(organizer).proceeds(451234434, { value: 100000, gasPrice: 0 })).to.be.revertedWith(
        'NOT_EXIST'
      );
    });

    it('should reject proceeds on closed event', async () => {
      // given
      events.connect(investor1).buyEventTokens(eventData.eventId, 1, { value: eventData.tokenPrice });
      await events.connect(organizer).proceeds(eventData.eventId, { value: 100000, gasPrice: 0 });

      // when
      await expect(
        events.connect(organizer).proceeds(eventData.eventId, { value: 100000, gasPrice: 0 })
      ).to.be.revertedWith('NOT_OPEN');
    });

    it('should reject proceeds when 0 tokens sold', async () => {
      // when
      await expect(
        events.connect(organizer).proceeds(eventData.eventId, { value: 100000, gasPrice: 0 })
      ).to.be.revertedWith('ZERO_TOKEN_SOLD');
    });
  });

  // ---------------------------------- safeTransferFrom: investor selling token

  describe('safeTransferFrom', async () => {
    const eventData = {
      eventId: 1000,
      tokenSupply: 100,
      tokenPrice: 100000000000,
    };

    beforeEach(async () => {
      await events.connect(organizer).createNewEvent(eventData.eventId, eventData.tokenSupply, eventData.tokenPrice);
      await events.connect(owner).approveEvent(eventData.eventId);
    });

    it('should sell token back to event contract', async () => {
      // given
      const tokensToBuy = 50;
      const cost = await events.getTokenPrice(eventData.eventId, tokensToBuy);
      events.connect(investor1).buyEventTokens(eventData.eventId, tokensToBuy, { value: cost });
      events.connect(organizer).withdrawFunds(eventData.eventId, cost);
      await events.connect(organizer).proceeds(eventData.eventId, { value: cost.mul(2), gasPrice: 0 });

      // when
      await expect(
        await token
          .connect(investor1)
          .safeTransferFrom(investor1.address, events.address, eventData.eventId, tokensToBuy, [])
      )
        .to.changeEtherBalance(investor1, cost.mul(2))
        .to.emit(events, 'EventTokenSold');

      // then
      expect(await token.balanceOf(investor1.address, eventData.eventId)).to.be.equal(0);
    });

    it('should reject selling more tokens than owned', async () => {
      // given
      const tokensToBuy = 50;
      const cost = await events.getTokenPrice(eventData.eventId, tokensToBuy);
      events.connect(investor1).buyEventTokens(eventData.eventId, tokensToBuy, { value: cost });
      events.connect(organizer).withdrawFunds(eventData.eventId, cost);
      await events.connect(organizer).proceeds(eventData.eventId, { value: cost.mul(2), gasPrice: 0 });

      // when
      await expect(
        token
          .connect(investor1)
          .safeTransferFrom(investor1.address, events.address, eventData.eventId, tokensToBuy + 1, [])
      ).to.be.revertedWith('ERC1155: insufficient balance for transfer');
    });

    it('should reject selling tokens when event not finished', async () => {
      // given
      const tokensToBuy = 50;
      const cost = await events.getTokenPrice(eventData.eventId, tokensToBuy);
      events.connect(investor1).buyEventTokens(eventData.eventId, tokensToBuy, { value: cost });

      // when
      await expect(
        token.connect(investor1).safeTransferFrom(investor1.address, events.address, eventData.eventId, tokensToBuy, [])
      ).to.be.revertedWith('NOT_FINISHED');
    });

    it('should reject selling tokens from unknown token contract', async () => {
      // given
      const tokenFactory = await ethers.getContractFactory('StaxeEventToken');
      const otherToken = (await tokenFactory.connect(investor1).deploy()) as StaxeEventToken;

      const tokensToBuy = 50;
      await otherToken.connect(investor1).mintEventToken(investor1.address, eventData.eventId, eventData.tokenSupply);

      // when
      await expect(
        otherToken
          .connect(investor1)
          .safeTransferFrom(investor1.address, events.address, eventData.eventId, tokensToBuy, [])
      ).to.be.revertedWith('NOT_SENT_BY_EVENT_TOKEN');
    });
  });

  // ---------------------------------- safeBatchTransferFrom: investor selling multiple token

  describe('safeBatchTransferFrom', async () => {
    const eventData = {
      eventId: 1000,
      tokenSupply: 100,
      tokenPrice: 100000000000,
    };

    beforeEach(async () => {
      await events.connect(organizer).createNewEvent(eventData.eventId, eventData.tokenSupply, eventData.tokenPrice);
      await events.connect(owner).approveEvent(eventData.eventId);
    });

    it('should sell tokens back to event contract', async () => {
      // given
      const tokensToBuy = 50;
      const cost = await events.getTokenPrice(eventData.eventId, tokensToBuy);
      events.connect(investor1).buyEventTokens(eventData.eventId, tokensToBuy, { value: cost });
      events.connect(organizer).withdrawFunds(eventData.eventId, cost);
      await events.connect(organizer).proceeds(eventData.eventId, { value: cost.mul(2), gasPrice: 0 });

      // when
      await expect(
        await token
          .connect(investor1)
          .safeBatchTransferFrom(investor1.address, events.address, [eventData.eventId], [tokensToBuy], [])
      )
        .to.changeEtherBalance(investor1, cost.mul(2))
        .to.emit(events, 'EventTokenSold');

      // then
      expect(await token.balanceOf(investor1.address, eventData.eventId)).to.be.equal(0);
    });

    it('should reject selling wrong token args counts', async () => {
      // given
      const tokensToBuy = 50;
      const cost = await events.getTokenPrice(eventData.eventId, tokensToBuy);
      events.connect(investor1).buyEventTokens(eventData.eventId, tokensToBuy, { value: cost });

      // when
      await expect(
        token.connect(investor1).safeBatchTransferFrom(investor1.address, events.address, [eventData.eventId], [], [])
      ).to.be.revertedWith('ERC1155: ids and amounts length mismatch');
    });
  });
});
*/
