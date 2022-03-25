import { ethers } from 'ethers';
import MerkleGenerator from '../../utils/merkle-generator';
import { ethersParse } from './ethers-utils';

export function generateLeaf(address: string, value: string): Buffer {
  return Buffer.from(
    // Hash in appropriate Merkle format
    ethers.utils.solidityKeccak256(['address', 'uint256'], [address, value]).slice(2),
    'hex'
  );
}

export async function generateProof(airdrop: Record<string, number>, decimals: number, address: string) {
  const generator = new MerkleGenerator(decimals, airdrop);
  const { merkleRoot, merkleTree } = await generator.process();
  const amount = ethersParse(airdrop[address], decimals);
  const leaf: Buffer = generateLeaf(address, amount.toString());
  const merkleProof: string[] = merkleTree.getHexProof(leaf);
  return { merkleRoot, merkleTree, merkleProof, amount };
}
