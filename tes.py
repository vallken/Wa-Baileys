from nacl.signing import SigningKey
import base58

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
        
        return {
            'success': True,
            'phantom_key': phantom_format,
            'public_key': base58.b58encode(bytes(verify_key)).decode('utf-8')
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

# Your original bytes
original_bytes = b'\xb9\x14:\\Z"S\x9f\xb0\xe0\x96\xf9k8\x8d\x15cj\xed\x1f\x1b\x8dX\x10\x05P\x02MA\x88{J'
# Convert
result = convert_to_phantom_format(original_bytes)

if result['success']:
    print("\n✅ Konversi berhasil!")
    print("\n🔑 Private Key (Phantom Format):")
    print(result['phantom_key'])
    print("\n📤 Public Key:")
    print(result['public_key'])
    print("\n📝 Instruksi Import ke Phantom:")
    print("1. Buka Phantom Wallet")
    print("2. Klik menu titik tiga (...)")
    print("3. Pilih 'Import Private Key'")
    print("4. Paste private key format Phantom di atas")
    print("5. Klik Import")
else:
    print(f"\n❌ Error: {result['error']}")