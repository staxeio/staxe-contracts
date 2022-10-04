import { expect } from 'chai';
import {
  MinimalForwarder,
  StaxeProductionsFactoryV3,
  StaxeProductionsV3,
  StaxeProductionTokenV3,
  TransakOnePurchaseProxy,
} from '../../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { attachToken, createAndApproveProduction, harness, newProduction } from '../utils/harness';
import { USDT } from '../../utils/swap';
import { buyToken, getQuote } from '../utils/uniswap';
import { getContract } from '../../utils/deployment';
import { network } from 'hardhat';
import { signMetaTxRequest } from '../../utils/signer';

describe('StaxeProductionsV3: buy tokens', () => {
  // contracts
  let token: StaxeProductionTokenV3;
  let productions: StaxeProductionsV3;
  let factory: StaxeProductionsFactoryV3;
  let transakProxy: TransakOnePurchaseProxy;

  // actors
  let owner: SignerWithAddress;
  let approver: SignerWithAddress;
  let organizer: SignerWithAddress;
  let investor1: SignerWithAddress;
  let investor2: SignerWithAddress;

  const usdt = USDT(1337) as string;

  beforeEach(async () => {
    ({ token, productions, factory, transakProxy, owner, approver, organizer, investor1, investor2 } = await harness());
  });

  // --------------------------- BUY WITH TOKENS ---------------------------

  describe('Buy tokens with gasles purchase and Transak proxy', () => {
    it('buys tokens with placing a purchase', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );
      const transakOne = investor1;
      const tokensToBuy = 7;
      const price = await productions.connect(investor2).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
      await buyToken(price[0], 2n * price[1].toBigInt(), 3n * swapPrice, transakOne);

      const forwarder = ((await getContract('MinimalForwarder')) as MinimalForwarder).connect(owner);
      const { request, signature } = await signMetaTxRequest(owner.provider, forwarder, {
        from: investor2.address,
        to: transakProxy.address,
        data: transakProxy.interface.encodeFunctionData('placePurchase', [id, tokensToBuy, 0]),
      });
      await network.provider.request({
        method: 'hardhat_setBalance',
        params: [forwarder.address, `0x${200000000000000000n.toString(16)}`],
      });

      // when
      await forwarder.execute(request, signature);

      // when
      await (await attachToken(price[0])).connect(transakOne).transfer(transakProxy.address, price[1].toBigInt());
      await transakProxy.connect(transakOne).depositTo(investor2.address, price[1].toBigInt(), price[0]);

      // then
      const balance = await token.balanceOf(investor2.address, id);
      expect(balance).to.be.equal(tokensToBuy);
      const escrow = (await productions.getProduction(id)).escrow;
      const balanceEscrow = await (await attachToken(usdt)).balanceOf(escrow);
      expect(balanceEscrow).to.be.equal(price[1]);
    });
  });
});
