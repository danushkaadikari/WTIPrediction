const { inputToConfig } = require("@ethereum-waffle/compiler");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber, constants: { MaxUint256, AddressZero } } = require("ethers");

const timeLatest = async () => {
    const block = await hre.ethers.provider.getBlock('latest');
    return BigNumber.from(block.timestamp);
};

const setBlocktime = async (time) => {
    await hre.ethers.provider.send('evm_setNextBlockTimestamp', [time]);
    await hre.ethers.provider.send("evm_mine")
  };

let btcSupplyAPR = 0, usdcBorrowAPR = 107100, prxyRateForBTCpx = 8400;
let usdcSupplyAPR = 0, btcBorrrowAPR = 128500, prxyRateForUSDC = 15300;
let BTCpxDecimals = 8, UsdcDecimals = 6;
const treasury = "0xb0bF3E0B1a6304197bf976be1768989424a6158E";
const tradingWallet = "0x5103a9eF2fC1EE30943E9250f1313080908b04EC";


describe("USDC REDUX TEST", function() {
    let poolAddressesProvider, aaveOracle, aclManager, aaveProtocolDataProvider;
    let btcpxToken, usdcToken;
    let btcpxAggregator, usdcAggregator, prxyAggregator;
    let configuratorLogic, reserveLogic, particularLogic, validationLogic, 
        liquidationLogic, poolLogic, supplyLogic, borrowLogic, generalLogic;
    let poolConfiguratorAddress, poolConfigurator;
    let poolAddress, pool, reservesSetupHelper;
    let prxyToken, prxyTreasury;
    let pTokenImpl;
    let OWNER, USER, USER1, ACL_ADMIN, POOL_ADMIN;
    let aYear = 365 * 24 * 3600; 
    let aDay = 24 * 3600;

    const amountToWorth = async (oracle, token, amount) => {
        let price = await oracle.getAssetPrice(token);
        let tokenContract = await ethers.getContractAt("IERC20Detailed", token);
        let decimals = await tokenContract.decimals();
        return amount * price / (10 ** (decimals + 8));
    }

    const worthToAmount = async (oracle, token, worth) => {
        let price = await oracle.getAssetPrice(token);
        let tokenContract = await ethers.getContractAt("IERC20Detailed", token);
        let decimals = await tokenContract.decimals();
        return worth / price * (10 ** (decimals + 8));
    }

   it("initialize", async() => {
        [ OWNER, USER, USER1, ACL_ADMIN ] = await ethers.getSigners();
        POOL_ADMIN = ACL_ADMIN;
        
        const PoolAddressesProvider = await ethers.getContractFactory("PoolAddressesProvider");
        poolAddressesProvider = await PoolAddressesProvider.deploy("USDC REDUX DEFI", OWNER.address);

        const AaveProtocolDataProvider = await ethers.getContractFactory("AaveProtocolDataProvider");
        aaveProtocolDataProvider = await AaveProtocolDataProvider.deploy(poolAddressesProvider.address);
        await poolAddressesProvider.setPoolDataProvider(aaveProtocolDataProvider.address);

        await poolAddressesProvider.setACLAdmin(ACL_ADMIN.address);
        const ACLManager = await ethers.getContractFactory("ACLManager");
        aclManager = await ACLManager.deploy(poolAddressesProvider.address);
        await poolAddressesProvider.setACLManager(aclManager.address);
        await aclManager.connect(ACL_ADMIN).addPoolAdmin(POOL_ADMIN.address);

        const MintableERC20 = await ethers.getContractFactory("MintableERC20");
        btcpxToken = await MintableERC20.deploy("BTC Proxy", "BTCpx", 8);
        usdcToken = await MintableERC20.deploy("USDC", "USDC", 6);
        prxyToken = await MintableERC20.deploy("Proxy", "PRXY", 18);

        const MockAggregator = await ethers.getContractFactory("MockAggregator");
        btcpxAggregator = await MockAggregator.deploy(2060975000000);
        usdcAggregator = await MockAggregator.deploy(100000000);
        prxyAggregator = await MockAggregator.deploy(49000000);

        const AaveOracle = await ethers.getContractFactory("AaveOracle");
        aaveOracle = await AaveOracle.deploy(
            poolAddressesProvider.address,
            [ btcpxToken.address, usdcToken.address, prxyToken.address ],
            [ btcpxAggregator.address, usdcAggregator.address, prxyAggregator.address ],
            "0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000",
            0
        );
        await poolAddressesProvider.setPriceOracle(aaveOracle.address);

        const ConfiguratorLogic = await ethers.getContractFactory("ConfiguratorLogic");
        configuratorLogic = await ConfiguratorLogic.deploy();
        const ReserveLogic = await ethers.getContractFactory("ReserveLogic");
        reserveLogic = await ReserveLogic.deploy();
        const GeneralLogic = await ethers.getContractFactory("GeneralLogic");
        generalLogic = await GeneralLogic.deploy();
        const LiquidationLogic = await ethers.getContractFactory("LiquidationLogic", {
            libraries: {
                GeneralLogic: generalLogic.address,
            }
        });
        liquidationLogic = await LiquidationLogic.deploy();
        const BorrowLogic = await ethers.getContractFactory("BorrowLogic", {
            libraries: {
                GeneralLogic: generalLogic.address,
            }
        });
        borrowLogic = await BorrowLogic.deploy();
        const SupplyLogic = await ethers.getContractFactory("SupplyLogic", {
            libraries: {
                GeneralLogic: generalLogic.address,
            }
        });
        supplyLogic = await SupplyLogic.deploy();
        const PoolLogic = await ethers.getContractFactory("PoolLogic", {
            libraries: {
                GeneralLogic: generalLogic.address,
            }
        });
        poolLogic = await PoolLogic.deploy();
        const ParticularLogic = await ethers.getContractFactory("ParticularLogic", {
            libraries: {
                GeneralLogic: generalLogic.address,
            }
        });
        particularLogic = await ParticularLogic.deploy();
        const ValidationLogic = await ethers.getContractFactory("ValidationLogic");
        validationLogic = await ValidationLogic.deploy();
        
        const Pool = await ethers.getContractFactory("Pool", {
            libraries: {
                BorrowLogic: borrowLogic.address,
                SupplyLogic: supplyLogic.address,
                LiquidationLogic: liquidationLogic.address,
                PoolLogic: poolLogic.address,
                ParticularLogic: particularLogic.address,
            }
        });

        let poolImpl = await Pool.deploy(poolAddressesProvider.address);

        await poolAddressesProvider.setPoolImpl(poolImpl.address);
        poolAddress = await poolAddressesProvider.getPool();
        pool = await ethers.getContractAt("IPool", poolAddress);

        const PoolConfigurator = await ethers.getContractFactory("PoolConfigurator", {
            libraries: {
                ConfiguratorLogic: configuratorLogic.address,
            }
        });
        let poolConfiguratorImpl = await PoolConfigurator.deploy();

        await poolAddressesProvider.setPoolConfiguratorImpl(poolConfiguratorImpl.address);
        poolConfiguratorAddress = await poolAddressesProvider.getPoolConfigurator();
        poolConfigurator = await ethers.getContractAt("IPoolConfigurator", poolConfiguratorAddress);
        
        const PrxyTreasury = await ethers.getContractFactory("PrxyTreasury");
        prxyTreasury = await PrxyTreasury.connect(POOL_ADMIN).deploy(pool.address);
        await prxyTreasury.setPrxyToken(prxyToken.address);
        await poolAddressesProvider.setPrxyTreasury(prxyTreasury.address);
        await poolAddressesProvider.setTradingWallet(tradingWallet);

        const PToken = await ethers.getContractFactory("PToken");
        pTokenImpl = await PToken.deploy(pool.address);

        const initReserveInputs =[
            {
                pTokenImpl: pTokenImpl.address,
                supplyingAsset: btcpxToken.address,
                supplyingAssetDecimals: 8,
                supplyRate: btcSupplyAPR,  // 0%
                borrowingAsset: usdcToken.address,
                borrowRate: usdcBorrowAPR,  // 10%
                prxyRate: prxyRateForBTCpx, // 20%
                splitRate: 1000000,            // 100%
                treasury: treasury,
                pTokenName: "Redux Polygon BTCpx-USDC",
                pTokenSymbol: "pPolBTCpx-USDC",
                params: 0,
            },
            {
                pTokenImpl: pTokenImpl.address,
                supplyingAsset: usdcToken.address,
                supplyingAssetDecimals: 6,
                supplyRate: usdcSupplyAPR, // APR 0%
                borrowingAsset: btcpxToken.address,
                borrowRate: btcBorrrowAPR,  // 8% 
                prxyRate: prxyRateForUSDC, // 20%
                splitRate: 1000000,            // 100%
                treasury: treasury,
                pTokenName: "Redux Polygon USDC-BTCpx",
                pTokenSymbol: "pPolUSDC-BTCpx",
                params: 0,
            },
        ];
        await poolConfigurator.connect(POOL_ADMIN).initReserves(initReserveInputs);

        const ReservesSetupHelper = await ethers.getContractFactory("ReservesSetupHelper");
        reservesSetupHelper = await ReservesSetupHelper.deploy();

        await aclManager.connect(ACL_ADMIN).addRiskAdmin(reservesSetupHelper.address);

        const reserveConfigures = [
            {
                asset: btcpxToken.address,
                baseLTV: 7500,
                liquidationThreshold: 8000,
                borrowCap: 50000000000,
                supplyCap: 50000000000,
                borrowingEnabled: true,
            },
            {
                asset: usdcToken.address,
                baseLTV: 7500,
                liquidationThreshold: 8000,
                borrowCap: 50000000000,
                supplyCap: 50000000000,
                borrowingEnabled: true,
            },
        ];
        await reservesSetupHelper.configureReserves(
            poolConfigurator.address,
            reserveConfigures
        );

        const amount = "100000000000";
        await btcpxToken['mint(address,uint256)'](USER.address, amount);
        await btcpxToken['mint(address,uint256)'](USER1.address, amount);
        await btcpxToken['mint(address,uint256)'](POOL_ADMIN.address, amount);

        await usdcToken['mint(address,uint256)'](USER.address, amount);
        await usdcToken['mint(address,uint256)'](USER1.address, amount);
        await usdcToken['mint(address,uint256)'](POOL_ADMIN.address, amount);

        await prxyToken['mint(address,uint256)'](POOL_ADMIN.address, "300000000000000000000");
        await prxyToken.connect(POOL_ADMIN).approve(prxyTreasury.address, "300000000000000000000");
        await prxyTreasury.connect(POOL_ADMIN).depositPrxy("300000000000000000000");

        await aclManager.connect(ACL_ADMIN).setRoleAdmin(aclManager.POOL_RESUPPLY_ROLE(), aclManager.POOL_ADMIN_ROLE())
        await aclManager.connect(POOL_ADMIN).addPoolSupplier(USER.address)
        // await btcpxToken.connect(POOL_ADMIN).approve(pool.address, amount);
        // await usdcToken.connect(POOL_ADMIN).approve(pool.address, amount);
        // await pool.connect(POOL_ADMIN).supply(btcpxToken.address, amount, 1);
        // await pool.connect(POOL_ADMIN).supply(usdcToken.address, amount, 1);
    })

    it("add fund", async () => {
        const supplyAmount = 4852072; // 0.04852072 BTCpx = $1000
        await btcpxToken.connect(USER).approve(pool.address, supplyAmount);

        await pool.connect(USER).addFund(
            btcpxToken.address,
            supplyAmount,
        );

        
    })

/*
    it("supply BTCpx with native supply mode", async() => {
        const time1 = await timeLatest();
        await setBlocktime(time1.add(aYear).toNumber());
        const supplyAmount = 4852072; // 0.04852072 BTCpx = $1000
        let supplyWorth = await amountToWorth(aaveOracle, btcpxToken.address, supplyAmount)
        const prevBTCpxAmount = await btcpxToken.balanceOf(USER.address);
        await btcpxToken.connect(USER).approve(pool.address, supplyAmount);

        const ax = await pool.getUserAccountData(USER.address, btcpxToken.address);
        const collateralWorth = ax.totalCollateralBase / (10 ** 8);

        let HF, updatedHF, availableSupplyAmount;
        availableSupplyAmount = await btcpxToken.balanceOf(USER.address);

        
        if(ax.healthFactor.eq(ethers.constants.MaxUint256)) {
            HF = updatedHF = "infinite";
        } else {
            HF = ax.healthFactor / 10000;
            updatedHF = HF * (collateralWorth  + supplyWorth) / collateralWorth;
        }

        const reserveCaps = await aaveProtocolDataProvider.getReserveCaps(btcpxToken.address);
        const supplyCap = reserveCaps.supplyCap * (10 ** BTCpxDecimals);

        if(availableSupplyAmount > supplyCap) availableSupplyAmount = supplyCap;
        
        console.log("health factor before supplying: ", HF);
        console.log("health factor after supplying: ", updatedHF);
        console.log("Available Supply Amount: ", availableSupplyAmount / (10 ** BTCpxDecimals), "BTCpx");

        await pool.connect(USER).supply(
            btcpxToken.address,
            supplyAmount,
            0   // native supply mode
        );
        expect(await btcpxToken.balanceOf(USER.address)).to.eq(prevBTCpxAmount - supplyAmount);
        const time = await timeLatest();
        await setBlocktime(time.add(aYear).toNumber());
        
        const totalSupply  = await aaveProtocolDataProvider.getTotalSupply(btcpxToken.address);
        const userData  = await aaveProtocolDataProvider.getUserReserveData(btcpxToken.address, USER.address);

        const btcPrice = await aaveOracle.getAssetPrice(btcpxToken.address);
        console.log("Supply Balance");
        console.log("expected: ", supplyAmount * (1 + btcSupplyAPR / 10000));
        console.log("real: ", userData.currentPTokenBalance);
        let worth1 = await amountToWorth(aaveOracle, btcpxToken.address, supplyAmount)
        let worth2 = await amountToWorth(aaveOracle, btcpxToken.address, userData.currentPTokenBalance)
        console.log("worth1: $", worth1);
        console.log("worth2: $", worth2);
    })
/*
    it("supply BTCpx with prxy supply mode - fail", async() => {
        const supplyAmount = 17837432; // 0.17837432 BTCpx
        await btcpxToken.connect(USER).approve(pool.address, supplyAmount);
        const INCORRECT_REFERRAL_CODE = '100'
        await expect(
            pool.connect(USER).supply(
                btcpxToken.address,
                supplyAmount,
                1   // prxy supply mode
            )
        ).to.be.revertedWith(INCORRECT_REFERRAL_CODE);
    })

    it("borrow USDC", async() => {
        const borrowAmount = 200 * (10 ** 6); // 200 USDC
        let borrowWorth = await amountToWorth(aaveOracle, usdcToken.address, borrowAmount)
        const prevUSDCAmount = await usdcToken.balanceOf(USER.address);

        let HF, updatedHF, availableBorrowAmount;
        const ax = await pool.getUserAccountData(USER.address, btcpxToken.address);
        const collateralWorth = ax.totalCollateralBase / (10 ** 8);
        const debtWorth = ax.totalDebtBase / (10 ** 8);
        
        if(ax.healthFactor.eq(ethers.constants.MaxUint256)) {
            HF = "infinite";
            updatedHF = (collateralWorth * ax.currentLiquidationThreshold / 10000) / borrowWorth;
        } else {
            HF = ax.healthFactor / 10000;
            updatedHF = HF * debtWorth / (debtWorth + borrowWorth);
        }

        const ltv = (await aaveProtocolDataProvider.getReserveConfigurationData(btcpxToken.address)).ltv / 10000;
        availableBorrowAmount = await worthToAmount(aaveOracle, usdcToken.address, collateralWorth * ltv - debtWorth);
        
        const reserveCaps = await aaveProtocolDataProvider.getReserveCaps(btcpxToken.address);
        const borrowCap = reserveCaps.borrowCap * (10 ** UsdcDecimals);
        if(availableBorrowAmount > borrowCap) availableBorrowAmount = borrowCap;
        

        console.log("health factor before supplying: ", HF);
        console.log("health factor after supplying: ", updatedHF);
        console.log("Available Borrow Amount: ", availableBorrowAmount / (10 ** UsdcDecimals), "USDC");

        await pool.connect(USER).borrow(
            btcpxToken.address,
            borrowAmount,
            0
        );
        const prevUserData  = await aaveProtocolDataProvider.getUserReserveData(btcpxToken.address, USER.address);
        
        console.log("The worths before borrowing")
        let worth1 = await amountToWorth(aaveOracle, btcpxToken.address, prevUserData.currentPTokenBalance)
        let worth2 = await amountToWorth(aaveOracle, usdcToken.address, prevUserData.currentBorrowBalance)
        console.log("worth btcpx: $", worth1);
        console.log("worth usdc: $", worth2);
        const usdcBalance = await usdcToken.balanceOf(USER.address);
        console.log("USDC balance: ", usdcBalance / (10 ** UsdcDecimals), " USDC")

        const time = await timeLatest();
        await setBlocktime(time.add(aYear).toNumber());
        expect(await usdcToken.balanceOf(USER.address)).to.eq(prevUSDCAmount.add(borrowAmount));
        
        const userData  = await aaveProtocolDataProvider.getUserReserveData(btcpxToken.address, USER.address);
        console.log("The worths after borrowing")
        worth1 = await amountToWorth(aaveOracle, btcpxToken.address, userData.currentPTokenBalance)
        worth2 = await amountToWorth(aaveOracle, usdcToken.address, userData.currentBorrowBalance)
        console.log("worth btcpx: $", worth1);
        console.log("worth usdc: $", worth2);
    })

    it("split the redux interest", async () => {
        const time = await timeLatest();
        await setBlocktime(time.add(aDay).toNumber());
        await pool.splitReduxInterest(
            btcpxToken.address,
        );

        // const reserveData  = await aaveProtocolDataProvider.getUserReserveData(btcpxToken.address, USER.address); 
        const reserveData  = await aaveProtocolDataProvider.getReserveData(btcpxToken.address); 
        console.log(reserveData)
    })

    it("split the redux interest2", async () => {
        const time = await timeLatest();
        await setBlocktime(time.add(aDay).toNumber());
        await pool.splitReduxInterest(
            btcpxToken.address,
        );

        // const reserveData  = await aaveProtocolDataProvider.getUserReserveData(btcpxToken.address, USER.address); 
        const reserveData  = await aaveProtocolDataProvider.getReserveData(btcpxToken.address); 
        console.log(reserveData)
    })

    it("split the redux interest3", async () => {
        const time = await timeLatest();
        await setBlocktime(time.add(aDay).toNumber());
        await pool.splitReduxInterest(
            btcpxToken.address,
        );

        // const reserveData  = await aaveProtocolDataProvider.getUserReserveData(btcpxToken.address, USER.address); 
        const reserveData  = await aaveProtocolDataProvider.getReserveData(btcpxToken.address); 
        console.log(reserveData)
    })

    it("supply USDC", async() => {
        const supplyAmount = 1000 * (10 ** 6); // 1000 USDC;
        const prevUSDCAmount = await usdcToken.balanceOf(USER.address);
        const prevUserData  = await aaveProtocolDataProvider.getUserReserveData(usdcToken.address, USER.address); 

        console.log("The worths before supplying")
        let worth1 = await amountToWorth(aaveOracle, btcpxToken.address, prevUserData.currentBorrowBalance)
        let worth2 = await amountToWorth(aaveOracle, usdcToken.address, prevUserData.currentPTokenBalance)
        console.log("worth btcpx(borrow asset): $", worth1);
        console.log("worth usdc(supply asset): $", worth2);

        await usdcToken.connect(USER).approve(pool.address, supplyAmount);
        await pool.connect(USER).supply(
            usdcToken.address,
            supplyAmount,
            0
        );

        let worth = await amountToWorth(aaveOracle, usdcToken.address, supplyAmount)
        console.log("Supplied USDC Worth: $", worth)

        expect(await usdcToken.balanceOf(USER.address)).to.eq(prevUSDCAmount - supplyAmount);
        const time = await timeLatest();
        await setBlocktime(time.add(aYear).toNumber());
        
        const totalSupply  = await aaveProtocolDataProvider.getTotalSupply(usdcToken.address);
        const userData  = await aaveProtocolDataProvider.getUserReserveData(usdcToken.address, USER.address); 

        console.log("The worths after supplying")
        worth1 = await amountToWorth(aaveOracle, btcpxToken.address, userData.currentBorrowBalance)
        worth2 = await amountToWorth(aaveOracle, usdcToken.address, userData.currentPTokenBalance)
        console.log("worth btcpx(borrow asset): $", worth1);
        console.log("worth usdc(supply asset): $", worth2);
    })

    it("borrow BTCpx", async() => {
        const borrowAmount = 1000000; //0.01 BTC
        const prevBTCpxAmount = await btcpxToken.balanceOf(USER.address);

        const prevUserData  = await aaveProtocolDataProvider.getUserReserveData(usdcToken.address, USER.address);
        console.log("The worths before borrowing")
        let worth1 = await amountToWorth(aaveOracle, btcpxToken.address, prevUserData.currentBorrowBalance)
        let worth2 = await amountToWorth(aaveOracle, usdcToken.address, prevUserData.currentPTokenBalance)
        console.log("worth btcpx(borrow asset): $", worth1);
        console.log("worth usdc(supply asset): $", worth2);

        await pool.connect(USER).borrow(
            usdcToken.address,
            borrowAmount,
            0
        );
        
        let worth = await amountToWorth(aaveOracle, btcpxToken.address, borrowAmount)
        console.log("Borrowed BTCpx Worth: $", worth)

        const time = await timeLatest();
        await setBlocktime(time.add(aYear).toNumber());
        expect(await btcpxToken.balanceOf(USER.address)).to.eq(prevBTCpxAmount.add(borrowAmount));
        
        const userData  = await aaveProtocolDataProvider.getUserReserveData(usdcToken.address, USER.address);
        console.log("The worths after borrowing")
        worth1 = await amountToWorth(aaveOracle, btcpxToken.address, userData.currentBorrowBalance)
        worth2 = await amountToWorth(aaveOracle, usdcToken.address, userData.currentPTokenBalance)
        console.log("worth btcpx(borrow asset): $", worth1);
        console.log("worth usdc(supply asset): $", worth2);
    })

    it("withdraw BTCpx - fail", async() => {
        const withdrawAmount = 18000000; // 0.18 BTCpx
        let withdrawWorth = await amountToWorth(aaveOracle, btcpxToken.address, withdrawAmount)
        const prevBTCpxAmount = await btcpxToken.balanceOf(USER.address);
        const HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD = '35';

        const prevUserData  = await aaveProtocolDataProvider.getUserReserveData(btcpxToken.address, USER.address);
        console.log("The worths before withdrawing")
        let worth1 = await amountToWorth(aaveOracle, btcpxToken.address, prevUserData.currentPTokenBalance)
        let worth2 = await amountToWorth(aaveOracle, usdcToken.address, prevUserData.currentBorrowBalance)
        console.log("worth btcpx: $", worth1);
        console.log("worth usdc: $", worth2);
        
        const ax = await pool.getUserAccountData(USER.address, btcpxToken.address);
        const supplyWorth = ax.totalCollateralBase / (10 ** 8);
        let HF, updatedHF, availableWithdrawAmount;
        if(ax.healthFactor.eq(ethers.constants.MaxUint256)) {
            HF = updatedHF = "infinite";
            availableWithdrawAmount = prevUserData.currentPTokenBalance;
        } else {
            HF = ax.healthFactor / 10000;
            updatedHF = HF * (supplyWorth  - withdrawWorth) / supplyWorth;
            availableWithdrawAmount = prevUserData.currentPTokenBalance * (HF - 1) / HF;
        }

        console.log("health factor before withdrawing: ", HF);
        console.log("health factor after withdrawing: ", updatedHF);
        console.log("Available withdraw amount: ", availableWithdrawAmount / (10 ** BTCpxDecimals), "BTCpx")

        await expect(
            pool.connect(USER).withdraw(
                btcpxToken.address,
                withdrawAmount
            )
        ).to.be.revertedWith(HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD);
        
        const curBTCpxAmount = await btcpxToken.balanceOf(USER.address);
        expect(prevBTCpxAmount).to.eq(curBTCpxAmount);
    })

    it("withdraw BTCpx - success", async() => {
        const withdrawAmount = 6236717; // 0.06236717 BTCpx
        let withdrawWorth = await amountToWorth(aaveOracle, btcpxToken.address, withdrawAmount)
        const prevBTCpxAmount = await btcpxToken.balanceOf(USER.address);
        
        const ax = await pool.getUserAccountData(USER.address, btcpxToken.address);
        const supplyWorth = ax.totalCollateralBase / (10 ** 8);
        const HF = ax.healthFactor / 10000;
        const updatedHF = HF * (supplyWorth  - withdrawWorth) / supplyWorth;
        console.log("health factor before withdrawing: ", HF);
        console.log("health factor after withdrawing: ", updatedHF);
        
        await pool.connect(USER).withdraw(
            btcpxToken.address,
            withdrawAmount
        )
        
        const curBTCpxAmount = await btcpxToken.balanceOf(USER.address);
        expect(curBTCpxAmount).to.eq(prevBTCpxAmount.add(withdrawAmount));
    })

    it("checkAndLiquidate", async () => {
        // const ax = await pool.getUserAccountData(USER.address, btcpxToken.address);
        const time = await timeLatest();
        await setBlocktime(time.add(24 * 3600).toNumber());
        // const ax2 = await pool.getUserAccountData(USER.address, btcpxToken.address);
        const prevUserData  = await aaveProtocolDataProvider.getUserReserveData(btcpxToken.address, USER.address); 
        console.log(prevUserData.currentPTokenBalance);
        await pool.checkAndLiquidate(
            btcpxToken.address
        );
        await pool.checkAndLiquidate(
            btcpxToken.address
        );
        const curUserData  = await aaveProtocolDataProvider.getUserReserveData(btcpxToken.address, USER.address); 
        console.log(curUserData.currentPTokenBalance);
        const tradingBTCpxAmount = await btcpxToken.balanceOf(tradingWallet);
        console.log(tradingBTCpxAmount);
    })

    // it("liquidate BTCpx", async() => {
    //     const ax = await pool.getUserAccountData(USER.address, btcpxToken.address);
    //     const time = await timeLatest();
    //     await setBlocktime(time.add(24 * 3600).toNumber());
    //     const ax2 = await pool.getUserAccountData(USER.address, btcpxToken.address);
    //     const prevUserData  = await aaveProtocolDataProvider.getUserReserveData(btcpxToken.address, USER.address); 
    //     console.log(prevUserData.currentPTokenBalance);
    //     await pool.liquidationCall(
    //         USER.address,
    //         btcpxToken.address
    //     );
    //     const curUserData  = await aaveProtocolDataProvider.getUserReserveData(btcpxToken.address, USER.address); 
    //     console.log(curUserData.currentPTokenBalance);
    //     const tradingBTCpxAmount = await btcpxToken.balanceOf(tradingWallet);
    //     console.log(tradingBTCpxAmount);
    // })

    it("repay USDC", async() => {
        const repayAmount = 200 * (10 ** 6); // 200 USDC
        let repayWorth = await amountToWorth(aaveOracle, usdcToken.address, repayAmount)
        const prevUserData  = await aaveProtocolDataProvider.getUserReserveData(btcpxToken.address, USER.address);

        console.log("The worths before reapying");
        let worth1 = await amountToWorth(aaveOracle, btcpxToken.address, prevUserData.currentPTokenBalance)
        let worth2 = await amountToWorth(aaveOracle, usdcToken.address, prevUserData.currentBorrowBalance)
        console.log(prevUserData.currentBorrowBalance);
        console.log("worth btcpx: $", worth1);
        console.log("worth usdc: $", worth2);

        const ax = await pool.getUserAccountData(USER.address, btcpxToken.address);
        const debtWorth = ax.totalDebtBase / (10 ** 8);

        let HF, updatedHF, availableRepayAmount;
        availableRepayAmount = await usdcToken.balanceOf(USER.address);

        HF = ax.healthFactor / 10000;
        if(repayAmount == prevUserData.currentBorrowBalance) {
            updatedHF = "infinite";
        } else {
            updatedHF = HF * debtWorth / (debtWorth - repayWorth);
        }

        console.log(prevUserData.currentBorrowBalance, availableRepayAmount);
        if(availableRepayAmount.gt(prevUserData.currentBorrowBalance)) availableRepayAmount = prevUserData.currentBorrowBalance;

        console.log("health factor before withdrawing: ", HF);
        console.log("health factor after withdrawing: ", updatedHF);
        console.log("Available repay amount: ", availableRepayAmount / (10 ** UsdcDecimals), "USDC")

        await usdcToken.connect(USER).approve(pool.address, repayAmount);
        await pool.connect(USER).repay(
            btcpxToken.address,
            repayAmount
        )

        const userData  = await aaveProtocolDataProvider.getUserReserveData(btcpxToken.address, USER.address);
        expect(userData.currentBorrowBalance).to.eq(prevUserData.currentBorrowBalance.sub(repayAmount));
    })

    it("withdraw BTCpx", async() => {
        const withdrawAmount = ethers.constants.MaxUint256; 
        const prevBTCpxAmount = await btcpxToken.balanceOf(USER.address);

        await pool.connect(USER).withdraw(
            btcpxToken.address,
            withdrawAmount
        )
        
        const curBTCpxAmount = await btcpxToken.balanceOf(USER.address);
        expect(curBTCpxAmount).to.gt(prevBTCpxAmount);
        const userData = await aaveProtocolDataProvider.getUserReserveData(btcpxToken.address, USER.address);
        expect(userData.currentPTokenBalance).to.eq(0);
    })

    it("liquidate BTCpx - fail", async() => {
        const COLLATERAL_CANNOT_BE_LIQUIDATED = '46'
        await expect(
            pool.liquidationCall(
                USER.address,
                btcpxToken.address
            )
        ).to.be.revertedWith(COLLATERAL_CANNOT_BE_LIQUIDATED);
    })

    it("supply BTCpx with prxy supply mode", async() => {
        const supplyAmount = 17837432; // 0.17837432 BTCpx
        const prevUserData  = await aaveProtocolDataProvider.getUserReserveData(btcpxToken.address, USER.address); 

        console.log("BTCpx amount: ", prevUserData.currentPTokenBalance);
        console.log("USDC amount: ", prevUserData.currentBorrowBalance);
        console.log("Prxy amount: ", prevUserData.currentPrxyBalance);

        await btcpxToken.connect(USER).approve(pool.address, supplyAmount);
        await pool.connect(USER).supply(
            btcpxToken.address,
            supplyAmount,
            1   // prxy supply mode
        )

        const time = await timeLatest();
        await setBlocktime(time.add(aYear).toNumber());

        const userData  = await aaveProtocolDataProvider.getUserReserveData(btcpxToken.address, USER.address); 

        let worth1 = await amountToWorth(aaveOracle, btcpxToken.address, supplyAmount)
        let worth2 = await amountToWorth(aaveOracle, prxyToken.address, userData.currentPrxyBalance)
        console.log("worth of BTCpx: $", worth1);
        console.log("worth of prxy: $", worth2);
        console.log("BTCpx amount: ", userData.currentPTokenBalance / (10 ** BTCpxDecimals) + " BTCpx");
        console.log("USDC amount: ", userData.currentBorrowBalance / (10 ** UsdcDecimals)  + " USDC");
        console.log("Prxy amount: ", userData.currentPrxyBalance / (10 ** 18)  + " PRXY");
    })

    it("Claim Prxy interest", async () => {
        const claimAmount = "63021430999199999849"; // 63.021430999199999849 PRXY
        await pool.connect(USER).claimPrxy(
            btcpxToken.address,
            claimAmount
        )

        const prxyBalance = await prxyToken.balanceOf(USER.address);
        console.log("PRXY balance: ", prxyBalance / (10 ** 18) + " PRXY");

        const userData  = await aaveProtocolDataProvider.getUserReserveData(btcpxToken.address, USER.address); 

        let worth1 = await amountToWorth(aaveOracle, btcpxToken.address, userData.currentPTokenBalance)
        let worth2 = await amountToWorth(aaveOracle, prxyToken.address, userData.currentPrxyBalance)
        console.log("worth of BTCpx: $", worth1);
        console.log("worth of prxy: $", worth2);
        console.log("BTCpx amount: ", userData.currentPTokenBalance / (10 ** BTCpxDecimals) + " BTCpx");
        console.log("USDC amount: ", userData.currentBorrowBalance / (10 ** UsdcDecimals)  + " USDC");
        console.log("Prxy amount: ", userData.currentPrxyBalance / (10 ** 18)  + " PRXY");
    })
    */
});
