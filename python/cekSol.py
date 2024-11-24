from solana.rpc.api import Client
from solders.pubkey import Pubkey

# RPC URL untuk Solana Mainnet dan Devnet
MAINNET_RPC = "https://api.mainnet-beta.solana.com"
DEVNET_RPC = "https://api.devnet.solana.com"

# Pilih jaringan (ubah ke MAINNET_RPC jika ingin menggunakan mainnet)
rpc_url = DEVNET_RPC

# Buat koneksi ke Solana RPC
solana_client = Client(rpc_url)


def check_balance(public_key):
    """Check SOL balance for the given public key."""
    try:
        # Pastikan public key dalam format yang valid
        pubkey = Pubkey.from_string(public_key)
        balance = solana_client.get_balance(pubkey).value  # Dapatkan saldo dalam lamports
        sol_balance = balance / 1_000_000_000  # Konversi lamports ke SOL
        return sol_balance
    except Exception as e:
        print(f"Error checking balance: {e}")
        return None


def main():
    print("=== Solana Wallet Balance Checker ===")
    print("Masukkan public key wallet Solana untuk memeriksa saldo SOL.")
    print("Tekan Ctrl+C untuk keluar.\n")

    try:
        while True:
            # Minta input dari pengguna
            wallet_address = input("Masukkan public key: ").strip()

            # Cek saldo wallet
            balance = check_balance(wallet_address)

            if balance is not None:
                print(f"Saldo untuk wallet {wallet_address}: {balance:.9f} SOL\n")
            else:
                print(f"Wallet {wallet_address} tidak valid atau terjadi kesalahan.\n")
    except KeyboardInterrupt:
        print("\nProgram dihentikan oleh pengguna.")
    except Exception as e:
        print(f"Terjadi kesalahan: {e}")


if __name__ == "__main__":
    main()
