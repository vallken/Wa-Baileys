import binascii
from bip_utils import Bip39SeedGenerator, Bip44, Bip44Coins, Bip44Changes
from bip_utils import Bip39MnemonicGenerator, Bip39WordsNum
from web3 import Web3
import os
import logging

# Setup logging
log_file = os.path.join(os.path.dirname(__file__), "logging.log")
logging.basicConfig(level=logging.INFO, filename=log_file,
                    format='%(asctime)s - %(levelname)s - %(message)s')

# Setup connection to BSC and Ethereum Mainnet
bsc = "https://bsc-rpc.publicnode.com"
eth_mainnet = "https://ethereum-rpc.publicnode.com"
web3_bsc = Web3(Web3.HTTPProvider(bsc))
web3_eth = Web3(Web3.HTTPProvider(eth_mainnet))

# Check connection to both networks
if not web3_bsc.is_connected():
    raise Exception("Failed to connect to BSC")
if not web3_eth.is_connected():
    raise Exception("Failed to connect to Ethereum Mainnet")

# Token contract addresses on BSC
BUSD_BSC_ADDRESS = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'  # BUSD BSC
USDT_BSC_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'  # USDT BSC

# Token contract addresses on Ethereum
BUSD_ETH_ADDRESS = '0x4fabb145d64652a948d72533023f6e7a623c7c53'  # BUSD ERC-20
USDT_ETH_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'  # USDT ERC-20

# ABI for ERC20 tokens
ERC20_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    }
]

# Create contract instances for BSC tokens
busd_bsc_contract = web3_bsc.eth.contract(address=BUSD_BSC_ADDRESS, abi=ERC20_ABI)
usdt_bsc_contract = web3_bsc.eth.contract(address=USDT_BSC_ADDRESS, abi=ERC20_ABI)

# Convert Ethereum contract addresses to checksum format
BUSD_ETH_ADDRESS = Web3.to_checksum_address('0x4fabb145d64652a948d72533023f6e7a623c7c53')  # BUSD ERC-20
USDT_ETH_ADDRESS = Web3.to_checksum_address('0xdAC17F958D2ee523a2206206994597C13D831ec7')  # USDT ERC-20

# Create contract instances for Ethereum tokens
busd_eth_contract = web3_eth.eth.contract(address=BUSD_ETH_ADDRESS, abi=ERC20_ABI)
usdt_eth_contract = web3_eth.eth.contract(address=USDT_ETH_ADDRESS, abi=ERC20_ABI)


def generate_bep20_wallet():
    """Generate a wallet for Binance Smart Chain (BSC)"""
    mnemonic = Bip39MnemonicGenerator().FromWordsNumber(Bip39WordsNum.WORDS_NUM_24)
    seed_bytes = Bip39SeedGenerator(mnemonic).Generate()
    bip44_mst_ctx = Bip44.FromSeed(seed_bytes, Bip44Coins.BINANCE_SMART_CHAIN)
    bip44_acc_ctx = bip44_mst_ctx.Purpose().Coin().Account(0)
    bip44_chg_ctx = bip44_acc_ctx.Change(Bip44Changes.CHAIN_EXT)
    bip44_addr_ctx = bip44_chg_ctx.AddressIndex(0)
    address = bip44_addr_ctx.PublicKey().ToAddress()
    private_key = binascii.hexlify(bip44_addr_ctx.PrivateKey().Raw().ToBytes()).decode()

    return {
        "mnemonic": mnemonic,
        "private_key": private_key,
        "address": address
    }

def check_balance_bsc(address):
    """Check BNB, BUSD, and USDT balances on BSC"""
    try:
        checksum_address = Web3.to_checksum_address(address)
        bnb_balance = web3_bsc.eth.get_balance(checksum_address)
        busd_balance = busd_bsc_contract.functions.balanceOf(checksum_address).call()
        usdt_balance = usdt_bsc_contract.functions.balanceOf(checksum_address).call()

        bnb_balance_ether = web3_bsc.from_wei(bnb_balance, 'ether')
        busd_balance_ether = web3_bsc.from_wei(busd_balance, 'ether')
        usdt_balance_ether = web3_bsc.from_wei(usdt_balance, 'ether')
        return bnb_balance_ether, busd_balance_ether, usdt_balance_ether
    except Exception as e:
        print(f"An error occurred on BSC: {e}")
        return 0, 0, 0  # Return zero balances in case of an error

def check_balance_eth(address):
    """Check ETH, BUSD, and USDT balances on Ethereum"""
    try:
        checksum_address = Web3.to_checksum_address(address)
        eth_balance = web3_eth.eth.get_balance(checksum_address)
        busd_balance = busd_eth_contract.functions.balanceOf(checksum_address).call()
        usdt_balance = usdt_eth_contract.functions.balanceOf(checksum_address).call()

        eth_balance_ether = web3_eth.from_wei(eth_balance, 'ether')
        busd_balance_ether = web3_eth.from_wei(busd_balance, 'ether')
        usdt_balance_ether = web3_eth.from_wei(usdt_balance, 'ether')

        return eth_balance_ether, busd_balance_ether, usdt_balance_ether
    except Exception as e:
        print(f"An error occurred on Ethereum: {e}")
        return 0, 0, 0  # Return zero balances in case of an error

def main():
    output_file = os.path.join(os.path.dirname(__file__), "output.txt")

    print("Starting wallet generation and balance checking...")
    print("Press Ctrl+C to stop the process.")

    try:
        while True:
            wallet = generate_bep20_wallet()

            # Check balances on BSC
            bnb_balance, busd_bsc_balance, usdt_bsc_balance = check_balance_bsc(wallet['address'])

            # Check balances on Ethereum
            eth_balance, busd_eth_balance, usdt_eth_balance = check_balance_eth(wallet['address'])

            # If there's any balance on BSC or Ethereum, log the wallet details
            if (float(bnb_balance) > 0 or float(busd_bsc_balance) > 0 or float(usdt_bsc_balance) > 0 or
                float(eth_balance) > 0 or float(busd_eth_balance) > 0 or float(usdt_eth_balance) > 0):

                result = (f"[{wallet['mnemonic']}] [{wallet['private_key']}] [{wallet['address']}] => "
                          f"BNB (BSC): [{bnb_balance:.18f}], BUSD (BSC): [{busd_bsc_balance:.18f}], "
                          f"USDT (BSC): [{usdt_bsc_balance:.18f}], ETH (ETH): [{eth_balance:.18f}], "
                          f"BUSD (ETH): [{busd_eth_balance:.18f}], USDT (ETH): [{usdt_eth_balance:.18f}]\n")

                with open(output_file, 'a') as f:
                    f.write(result)

                print(f"[+] Found wallet with balance: {wallet['address']}")
                print(f"    BNB (BSC): {bnb_balance:.18f}, BUSD (BSC): {busd_bsc_balance:.18f}, "
                      f"USDT (BSC): {usdt_bsc_balance:.18f}, ETH (ETH): {eth_balance:.18f}, "
                      f"BUSD (ETH): {busd_eth_balance:.18f}, USDT (ETH): {usdt_eth_balance:.18f}")
            else:
                print(f"[-] Zero balance: {wallet['mnemonic']}")

    except KeyboardInterrupt:
        print("\nProcess stopped by user.")
    except Exception as e:
        logging.error(f"[-] Exception: {e}")
        print(f"An error occurred: {e}")
    finally:
        print(f"Results have been saved to {output_file}")

if __name__ == "__main__":
    main()