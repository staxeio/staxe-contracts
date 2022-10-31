import { expect } from 'chai';
import { StaxeMembersV3 } from '../../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { harness } from '../utils/harness';

describe('StaxeMembersV3: roles', () => {
  // contracts
  let members: StaxeMembersV3;

  // actors
  let owner: SignerWithAddress;
  let organizer: SignerWithAddress;
  let organizer2: SignerWithAddress;
  let investor1: SignerWithAddress;
  let delegate: SignerWithAddress;

  beforeEach(async () => {
    ({ members, owner, organizer, investor1, organizer2, delegate } = await harness());
  });

  describe('Organizer Delegates', () => {
    it('adds and removes organizer delegate', async function () {
      // when
      const isDelegateInit = await members.isOrganizerDelegate(delegate.address, organizer.address);
      await members.connect(organizer).addDelegate(delegate.address);
      const afterAdding = await members.isOrganizerDelegate(delegate.address, organizer.address);
      await members.connect(organizer).removeDelegate(delegate.address);
      const afterRemoving = await members.isOrganizerDelegate(delegate.address, organizer.address);

      // then
      expect(isDelegateInit).to.be.false;
      expect(afterAdding).to.be.true;
      expect(afterRemoving).to.be.false;
    });

    it('cannot add/remove delegate when not organizer, or when already a delegate for other', async function () {
      // when
      // can't add when not organizer
      await expect(members.connect(investor1).addDelegate(delegate.address)).to.be.reverted;
      await members.connect(organizer).addDelegate(delegate.address);

      // can't add for multiple organizers
      await expect(members.connect(organizer2).addDelegate(delegate.address)).to.be.revertedWith(
        'Delegate already added'
      );

      // can't remove when not organizer
      await expect(members.connect(investor1).removeDelegate(delegate.address)).to.be.reverted;

      // can't remove delegate from other organizer
      await expect(members.connect(organizer2).removeDelegate(delegate.address)).to.be.revertedWith(
        'Cannot remove delegate from someone else'
      );
    });
  });

  describe('Register Investor', () => {
    it('adds investor role when trusted relayer', async () => {
      // given
      const isInvestorBefore = await members.isInvestor(delegate.address);

      // when
      await members.connect(owner).registerInvestor(delegate.address);

      const isInvestorAfter = await members.isInvestor(delegate.address);

      // then
      expect(isInvestorBefore).to.be.false;
      expect(isInvestorAfter).to.be.true;
    });

    it('rejects adding investor role when not trusted relayer', async () => {
      // when
      await expect(members.connect(investor1).registerInvestor(delegate.address)).to.be.revertedWith(
        'Can only be called from trusted relayer'
      );
    });
  });
});
