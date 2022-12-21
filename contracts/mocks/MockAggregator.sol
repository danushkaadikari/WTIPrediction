// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../chainlink/AggregatorV3Interface.sol';

contract MockAggregator is AggregatorV3Interface {
  struct RoundData {
      int256 answer;
      uint256 startedAt;
      uint256 updatedAt;
      uint80 answeredInRound;
  }

  uint8 private _decimals;
  string private _description;
  mapping(uint80 => RoundData) private _roundsData;
  uint80 private _lastRoundId;

  constructor() {
    _description = "Mock Aggregator";
    _decimals = 8;
    _lastRoundId = 0;
  }

  function decimals() public view returns (uint8) {
    return _decimals;
  }

  function description() public view returns (string memory) {
    return _description;
  }

  function version()
    public
    view
    returns (
      uint256
    ) {
      return 1;
    }

  // getRoundData and latestRoundData should both raise "No data present"
  // if they do not have data to report, instead of returning unset values
  // which could be misinterpreted as actual reported values.
  function getRoundData(
    uint80 _roundId
  )
    public
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    ) {
      require(roundId < _lastRoundId, "Invalid Round Id");
      RoundData storage roundData = _roundsData[roundId];
      roundId = _roundId;
      answer = roundData.answer;
      startedAt = roundData.startedAt;
      updatedAt = roundData.updatedAt;
      answeredInRound = roundData.answeredInRound;
    }

  function latestRoundData()
    public
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    ) {
      RoundData storage roundData = _roundsData[_lastRoundId];
      roundId = _lastRoundId;
      answer = roundData.answer;
      startedAt = roundData.startedAt;
      updatedAt = roundData.updatedAt;
      answeredInRound = roundData.answeredInRound;
    }
  
  function appendRoundData(
    int256 answer,
    uint256 startedAt,
    uint256 updatedAt,
    uint80 answeredInRound
  ) public {
    _roundsData[_lastRoundId] = RoundData(
      answer,
      startedAt,
      updatedAt,
      answeredInRound
    );
    
    _lastRoundId ++;
  }
}