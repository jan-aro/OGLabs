const Web3 = require('web3');
const fs = require('fs');
const chalk = require('chalk');

// Initialize Web3 first
const web3 = new Web3(new Web3.providers.HttpProvider('https://evmrpc-testnet.0g.ai'));

// Token configuration
const TOKENS = [
    { 
        address: '0x9A87C2412d500343c073E5Ae5394E3bE3874F76b',
        symbol: 'USDT'
    },
    {
        address: '0xce830d0905e0f7a9b300401729761579c5fb6bd6',
        symbol: 'ETH'
    },
    {
        address: '0x1E0D871472973c562650E991ED8006549F8CBEfc',
        symbol: 'BTC'
    }
];

// Constants
const ROUTER_ADDRESS = '0xD86b764618c6E3C078845BE3c3fCe50CE9535Da7';
const POOL_FEE = 3000;
const DEADLINE = Math.floor(Date.now() / 1000) + 60 * 10;
const MAX_ALLOWANCE = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

// ABI definitions
const erc20ABI = [
    {
        "constant": true,
        "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "spender", "type": "address"}
        ],
        "name": "allowance",
        "outputs": [{"name": "", "type": "uint256"}],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [{"name": "owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "payable": false,
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"}
        ],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

const routerABI = [
    {
        "constant": false,
        "inputs": [
            { 
                "name": "params", 
                "type": "tuple", 
                "components": [
                    {"name": "tokenIn", "type": "address"},
                    {"name": "tokenOut", "type": "address"},
                    {"name": "fee", "type": "uint24"},
                    {"name": "recipient", "type": "address"},
                    {"name": "deadline", "type": "uint256"},
                    {"name": "amountIn", "type": "uint256"},
                    {"name": "amountOutMinimum", "type": "uint256"},
                    {"name": "sqrtPriceLimitX96", "type": "uint160"}
                ]
            }
        ],
        "name": "exactInputSingle",
        "outputs": [{"name": "amountOut", "type": "uint256"}],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

// Utility functions
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function approveUnlimited(privateKey, tokenAddress) {
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    const walletAddress = account.address;
    const tokenContract = new web3.eth.Contract(erc20ABI, tokenAddress);
    
    const token = TOKENS.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
    const symbol = token ? token.symbol : tokenAddress;

    console.log(chalk.blue(`🚀 Approving unlimited ${symbol}...`));
    
    const txData = tokenContract.methods.approve(ROUTER_ADDRESS, MAX_ALLOWANCE).encodeABI();
    
    const gasEstimate = await tokenContract.methods.approve(
        ROUTER_ADDRESS, 
        MAX_ALLOWANCE
    ).estimateGas({ from: walletAddress });

    const tx = {
        to: tokenAddress,
        data: txData,
        gas: gasEstimate,
        gasPrice: await web3.eth.getGasPrice(),
        nonce: await web3.eth.getTransactionCount(walletAddress, 'pending'),
        chainId: 16600
    };

    const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    console.log(chalk.green(`✅ Approval complete: ${receipt.transactionHash}`));
    return receipt;
}

async function executeTradeWithRetry(privateKey, retries = 5) {
    let attempt = 0;
    while (attempt < retries) {
        try {
            await executeTrade(privateKey);
            console.log(chalk.green(`🎉 Trade successful for wallet: ${privateKey}`));
            return;  // Exit after successful trade
        } catch (error) {
            attempt++;
            console.error(chalk.red(`❌ Trade failed on attempt ${attempt} for wallet: ${privateKey}`, error));
            if (attempt < retries) {
                console.log(chalk.yellow(`⏳ Retrying...`));
            } else {
                console.log(chalk.red(`🚨 5 attempts failed for wallet: ${privateKey}`));
            }
        }
    }
}

async function executeTrade(privateKey) {
    try {
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        const walletAddress = account.address;
        console.log(chalk.blue(`\n🔷 Starting trade for wallet: ${walletAddress}`));

        const shuffledTokens = shuffleArray([...TOKENS]);
        const [tokenInInfo, tokenOutInfo] = shuffledTokens.slice(0, 2);
        const tokenIn = tokenInInfo.address;
        const tokenOut = tokenOutInfo.address;

        console.log(chalk.blue(`🔄 Trading pair: ${tokenInInfo.symbol} -> ${tokenOutInfo.symbol}`));

        const tokenContract = new web3.eth.Contract(erc20ABI, tokenIn);
        const currentAllowance = await tokenContract.methods.allowance(
            walletAddress, 
            ROUTER_ADDRESS
        ).call();

        if (web3.utils.toBN(currentAllowance).lt(web3.utils.toBN(MAX_ALLOWANCE))) {
            console.log(chalk.yellow(`⚠️  Allowance insufficient for ${tokenInInfo.symbol}, setting unlimited...`));
            await approveUnlimited(privateKey, tokenIn);
        }

        const balance = await tokenContract.methods.balanceOf(walletAddress).call();
        const balanceBN = web3.utils.toBN(balance);
        const amountIn = balanceBN.div(web3.utils.toBN(20)); // 5% = 1/20

        if (amountIn.isZero()) {
            throw new Error(chalk.red(`❌ Insufficient ${tokenInInfo.symbol} balance for swap`));
        }

        console.log(chalk.green(`💸 Swapping ${web3.utils.fromWei(amountIn, 'ether')} ${tokenInInfo.symbol}`));

        const router = new web3.eth.Contract(routerABI, ROUTER_ADDRESS);
        const params = [
            tokenIn,
            tokenOut,
            POOL_FEE,
            walletAddress,
            DEADLINE,
            amountIn.toString(),
            0, // amountOutMinimum
            0  // sqrtPriceLimitX96
        ];

        const gasEstimate = await router.methods.exactInputSingle(params)
            .estimateGas({ from: walletAddress });

        const txData = router.methods.exactInputSingle(params).encodeABI();

        const tx = {
            to: ROUTER_ADDRESS,
            data: txData,
            gas: gasEstimate,
            gasPrice: await web3.eth.getGasPrice(),
            nonce: await web3.eth.getTransactionCount(walletAddress, 'pending'),
            chainId: 16600
        };

        const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        
        console.log(chalk.green(`\n🎉 Swap successful!`));
        console.log(chalk.green(`📜 TX hash: ${receipt.transactionHash}`));
        console.log(chalk.green(`💱 Swapped ${web3.utils.fromWei(amountIn, 'ether')} ${tokenInInfo.symbol} to ${tokenOutInfo.symbol}`));

    } catch (error) {
        console.error(chalk.red('\n❌ Trade failed:', error));
        throw error;
    }
}

async function processWallets() {
    const privateKeys = fs.readFileSync('private_keys.txt', 'utf-8').split('\n').map(line => line.trim()).filter(Boolean);

    console.log(chalk.blue(`Loaded ${privateKeys.length} wallets from the private_keys.txt file.`));

    for (let privateKey of privateKeys) {
        await executeTradeWithRetry(privateKey); // 5 attempts per wallet
    }

    console.log(chalk.green('✅ All wallets processed, waiting 24 hours...'));
    setTimeout(async () => {
        console.log(chalk.yellow('⏳ 24-hour delay complete, processing resumes.'));
        await processWallets();  // Recursively call processWallets after delay
    }, 24 * 60 * 60 * 1000);  // 24 hours delay
}

function printHeader() {
  const line = "=".repeat(50);
  const title = "Auto Daily Swap 0G Labs";
  const createdBy = "Bot created by: https://t.me/airdropwithmeh";

  const totalWidth = 50;
  const titlePadding = Math.floor((totalWidth - title.length) / 2);
  const createdByPadding = Math.floor((totalWidth - createdBy.length) / 2);

  const centeredTitle = title.padStart(titlePadding + title.length).padEnd(totalWidth);
  const centeredCreatedBy = createdBy.padStart(createdByPadding + createdBy.length).padEnd(totalWidth);

  console.log(line);
  console.log(centeredTitle);
  console.log(centeredCreatedBy);
  console.log(line);
}

printHeader();
// Start processing wallets
processWallets().catch(console.error);
