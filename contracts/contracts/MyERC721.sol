// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MyERC721 is ERC721 {
    uint256 public ticketIdCounter;
    constructor(string memory name, string memory symbol) ERC721(name, symbol) {
        ticketIdCounter = 0;
    }

    function createTicket(address player) public returns (uint256) {
        uint256 ticketId = ticketIdCounter;
        _mint(player, ticketId);
        ticketIdCounter++;
        return ticketId;
    }
}