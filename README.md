
# Auto Daily Swap 0G Labs

This project automates token swapping on the Ethereum testnet using Web3.js. It interacts with a decentralized exchange (DEX) router to perform swaps for multiple tokens, including USDT, ETH, and BTC. The bot works with Ethereum-based ERC-20 tokens and allows for token swaps with retry logic to handle potential transaction failures.

## Overview
The Auto Daily Swap bot performs the following tasks:
- Loads private keys from a file.
- Approves token allowances to a DEX router.
- Executes token swaps with retry logic.
- Handles up to 5 retry attempts for each wallet.
- Logs transaction details for monitoring purposes.
- Automatically pauses and resumes processing every 24 hours.

The supported tokens for swapping are USDT, ETH, and BTC, and the bot will select a random token pair for each swap.
Make sure to have all those 3 tokens balance first

## Installation

1. Clone the repository to your local machine:

    ```bash
    git clone https://github.com/ganjsmoke/0g-swap.git
    cd 0g-swap
    ```

2. Install the required dependencies:

    ```bash
    npm install web3@1.8.0 chalk@2
    ```

3. Create a `private_keys.txt` file with the private keys of your Ethereum wallets. Each key should be on a new line.

    Example of `private_keys.txt`:
    ```txt
    0xYOUR_PRIVATE_KEY_1
    0xYOUR_PRIVATE_KEY_2
    0xYOUR_PRIVATE_KEY_3
    ```

4. Edit the script if you want to add more tokens or modify the configuration. The default tokens are USDT, ETH, and BTC.

5. Ensure you have access to the Ethereum testnet via `https://evmrpc-testnet.0g.ai` or update the RPC URL in the script.

## Usage

Run the bot using the following command:

```bash
node index.js
```

- The bot will load wallets from `private_keys.txt`.
- It will approve the maximum allowance for each token and execute a token swap.
- Swaps will happen randomly between two selected tokens (USDT, ETH, and BTC).
- Each wallet will attempt to swap tokens with up to 5 retries on failure.
- After processing all wallets, the bot will wait 24 hours before processing resumes.

### Logging and Monitoring

The bot logs the following events:
- Wallet address being processed.
- Token swaps executed (amount in/out).
- Transaction hash for monitoring on the blockchain.

Logs are shown in the terminal with different colors for success (green), failure (red), and warnings (yellow).

## Files

- `index.js`: Main script for performing token swaps.
- `private_keys.txt`: File containing Ethereum private keys (one key per line).
- `README.md`: Documentation for this project.

## Contributing

Feel free to fork this repository, make improvements, or report any issues. If you want to contribute, create a pull request, and it will be reviewed.

## License

This project is licensed under the MIT License
