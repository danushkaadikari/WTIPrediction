const DECIMALS = 8; // Chainlink default for WTI/USD
const INITIAL_PRICE = 10000000000; // $100, 8 decimal places
const INTERVAL_SECONDS = 300; // 5 minutes
const BUFFER_SECONDS = 30; // 30 seconds
const INITIAL_TREASURY_RATE = 0.029; // 2.9%
const MIN_BET_AMOUNT = 1000000000000000; // 0.001 BNB
const UPDATE_ALLOWANCE = 300; // 5 minutes

module.exports = {
  DECIMALS, INITIAL_PRICE, INTERVAL_SECONDS, BUFFER_SECONDS, INITIAL_TREASURY_RATE, MIN_BET_AMOUNT, UPDATE_ALLOWANCE
}