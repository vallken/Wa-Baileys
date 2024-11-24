import os
from solders.keypair import Keypair
from solana.rpc.api import Client
from solders.pubkey import Pubkey
from nacl.signing import SigningKey
import base58

# RPC URL untuk Solana Mainnet dan Devnet
MAINNET_RPC = "https://api.mainnet-beta.solana.com"
DEVNET_RPC = "https://api.devnet.solana.com"

# Pilih jaringan (ubah ke MAINNET_RPC jika ingin menggunakan mainnet)
rpc_url = DEVNET_RPC

# Buat koneksi ke Solana RPC
solana_client = Client(rpc_url)

# Fungsi untuk menghasilkan keypair
def generate_solana_keypair():
    """Generate Solana Keypair."""
    keypair = Keypair()  # Menghasilkan Keypair baru
    public_key = keypair.pubkey()  # Public Key
    private_key = keypair.secret()  # Private Key
    return public_key, private_key

# Fungsi untuk memeriksa saldo
def check_balance(public_key):
    """Check SOL balance for the given public key."""
    try:
        balance = solana_client.get_balance(public_key).value
        sol_balance = balance / 1_000_000_000  # Konversi lamports ke SOL
        return sol_balance
    except Exception as e:
        print(f"Error checking balance: {e}")
        return 0
    
def convert_to_phantom_format(private_key_bytes):
    """Convert private key bytes to Phantom wallet format."""
    try:
        # Create signing key from private key bytes
        signing_key = SigningKey(private_key_bytes)
        
        # Get verify key (public key)
        verify_key = signing_key.verify_key
        
        # Combine private key and public key bytes (Phantom format requirement)
        combined_bytes = private_key_bytes + bytes(verify_key)
        
        # Convert to base58
        phantom_format = base58.b58encode(combined_bytes).decode('utf-8')
        
        return phantom_format
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

# Fungsi utama
def main():
    output_file = os.path.join(os.path.dirname(__file__), "solana_gacha_output.txt")
    print("Starting Solana Gacha Keypair Generator...")
    print("Press Ctrl+C to stop the process.")

    try:
        while True:
            # Generate keypair
            public_key, private_keyByte = generate_solana_keypair()
            private_key = convert_to_phantom_format(private_keyByte)

            # Check balance
            sol_balance = check_balance(public_key)

            # Jika ada saldo, simpan ke file
            if sol_balance > 0:
                result = (f"Public Key: {public_key}\n"
                          f"Private Key: {private_key}\n"
                          f"Balance: {sol_balance:.9f} SOL\n\n")

                with open(output_file, 'a') as f:
                    f.write(result)

                print(f"[+] Wallet with balance found: {public_key}")
                print(f"    Balance: {sol_balance:.9f} SOL")
            else:
                print(f"[-] Zero balance: {public_key} {private_key}")
    except KeyboardInterrupt:
        print("\nProcess stopped by user.")
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        print(f"Results have been saved to {output_file}")

if __name__ == "__main__":
    main()
