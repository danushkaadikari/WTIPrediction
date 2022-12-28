/*
  pool expires every 300 seconds
  2.9% fee, all goes into the treasury wallet
  Treasury wallet: 0xAd28ff122a99F7cc11866fa485077B5DF26024c9 (ADMIN)
  genesis wallet: 0x2Bf4c6C5751BA728c4C58f9740A90c216eF4ef73 (OPERATOR)
*/

const ADMIN = "0x0202d07DDfc39dA9A186aF9E71C6bef08e0F0A0A"; // admin(treasury wallet)
const OPERATOR = "0xEC2e9a1F960DAb18819f73ea6ba69c935023081e"; // operator(for creating new round)
const DECIMALS = 8; // Chainlink default for WTI/USD
const INITIAL_PRICE = 10000000000; // $100, 8 decimal places
const INTERVAL_SECONDS = 300; // 5 minutes
const BUFFER_SECONDS = 30; // 30 seconds
const INITIAL_TREASURY_RATE = 0.029; // 2.9%
const MIN_BET_AMOUNT = 1000000000000000; // 0.001 BNB
const UPDATE_ALLOWANCE = 300; // 5 minutes

module.exports = {
  ADMIN, OPERATOR, DECIMALS, INITIAL_PRICE, INTERVAL_SECONDS, BUFFER_SECONDS, INITIAL_TREASURY_RATE, MIN_BET_AMOUNT, UPDATE_ALLOWANCE
}