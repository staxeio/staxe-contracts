//SPDX-License-Identifier: MIT
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
    uint256 maxTokensUnknownBuyer;
    ProductionState state;
    string dataHash;
    IProductionEscrow deposits;
  }

  struct CreateProduction {
    uint256 id;
    uint256 tokenInvestorSupply;
    uint256 tokenOrganizerSupply;
    uint256 tokenTreasurySupply;
    uint256 tokenPrice;
    uint256 maxTokensUnknownBuyer;
    string dataHash;
  }

  // ------- Events

  event ProductionCreated(
    uint256 indexed id,
    address indexed creator,
    uint256 tokenInvestorSupply,
    uint256 tokenOrganizerSupply,
    uint256 tokenTreasurySupply
  );
  event ProductionFinished(uint256 indexed id);
  event ProductionTokenBought(uint256 indexed id, address indexed buyer, uint256 tokens);

  // ------- Functions

  function getProductionData(uint256 id) external view returns (ProductionData memory);

  function getProductionDataForProductions(uint256[] memory ids) external view returns (ProductionData[] memory);

  function createNewProduction(CreateProduction calldata newProduction) external;

  function approveProduction(uint256 id) external;

  function declineProduction(uint256 id) external;

  function buyTokens(uint256 id, uint256 numTokens) external payable;

  function withdrawFunds(uint256 id, uint256 amount) external;

  function withdrawProceeds(uint256 id) external;

  function proceeds(uint256 id) external payable;

  function finish(uint256 id) external payable;
}
