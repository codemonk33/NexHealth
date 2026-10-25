#!/usr/bin/env python3
"""
BioNex Secret Generation Utility

Generates cryptographically secure secrets for the BioNex application.
Use this script to generate new secrets for SECRET_KEY and FIELD_ENCRYPTION_KEY.

Usage:
    python scripts/generate_secrets.py

Output:
    Prints secure random values suitable for .env file configuration.
    NEVER commit generated secrets to version control.
    Store production secrets in a secure secrets manager.
"""

import secrets
from cryptography.fernet import Fernet


def generate_jwt_secret() -> str:
    """
    Generate a cryptographically secure random secret for JWT signing.
    
    Returns:
        URL-safe base64-encoded string (43 characters)
        Provides 256 bits of entropy
    """
    return secrets.token_urlsafe(32)


def generate_fernet_key() -> str:
    """
    Generate a Fernet encryption key for field-level encryption.
    
    Returns:
        Base64-encoded 32-byte key (44 characters)
        Compatible with cryptography.fernet.Fernet
    """
    return Fernet.generate_key().decode('utf-8')


def main():
    print("=" * 80)
    print("BioNex Secure Secret Generation")
    print("=" * 80)
    print()
    print("⚠️  SECURITY WARNING:")
    print("   - NEVER commit these secrets to version control")
    print("   - Store production secrets in a secure secrets manager")
    print("   - Use different secrets for dev, staging, and production")
    print("   - Rotate secrets regularly (every 90 days recommended)")
    print()
    print("=" * 80)
    print()
    
    # Generate secrets
    jwt_secret = generate_jwt_secret()
    fernet_key = generate_fernet_key()
    
    # Print formatted output for .env file
    print("# Add these to your .env file:")
    print()
    print(f"SECRET_KEY={jwt_secret}")
    print(f"FIELD_ENCRYPTION_KEY={fernet_key}")
    print()
    print("=" * 80)
    print()
    print("✓ Secrets generated successfully!")
    print()
    print("Next steps:")
    print("  1. Copy the values above to your .env file")
    print("  2. NEVER commit .env to version control")
    print("  3. Verify .env is listed in .gitignore")
    print("  4. For production, use secure secrets management (Vault, AWS Secrets, etc.)")
    print()


if __name__ == "__main__":
    main()
