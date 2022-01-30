//SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./IProductionEscrow.sol";

interface IStaxeProductions {
  // ------- Data structures

  enum ProductionState {
    EMPTY,
    CREATED,
    OPEN,
    FINISHED,
    DECLINED
  }

  struct ProductionData {
    uint256 id;
    address creator;
    uint256 tokenSupply;
    uint256 tokensSoldCounter;
    uint256 tokenPrice;
    ProductionState state;
    IProductionEscrow deposits;
    // TODO: Price calculation function? With continuous proceeds, token should become more expensive
    // Alternatively: Delegate price calculations to escrow?
  }

  // ------- Events

  event ProductionCreated(uint256 indexed id, address indexed creator, uint256 tokenSupply);
  event ProductionFinished(uint256 indexed id);
  event ProductionTokenBought(uint256 indexed id, address indexed buyer, uint256 tokens);

  // ------- Functions

  function getProductionData(uint256 id) external view returns (ProductionData memory);
}
