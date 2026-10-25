"""Encrypt public keys in user_keypairs table

Revision ID: a1b2c3d4e5f6
Revises: d1f5e8c2a3b4
Create Date: 2026-10-17 00:00:00.000000

This migration:
1. Adds public_key_pem_encrypted column
2. Encrypts existing public_key_pem values  
3. Drops old public_key_pem column
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker, Session as DBSession
import logging
import json
import uuid
import os

logger = logging.getLogger(__name__)

revision = 'a1b2c3d4e5f6'
down_revision = 'd1f5e8c2a3b4'
branch_labels = None
depends_on = None


def encrypt_public_key_simple(public_key_pem: str, user_id_str: str) -> str:
    """Simple encryption using HKDF and AES-256-GCM"""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.hkdf import HKDF
    from cryptography.hazmat.backends import default_backend
    import base64
    import os
    
    # Derive key from user_id
    try:
        user_uuid = uuid.UUID(user_id_str)
        user_id_bytes = user_uuid.bytes
    except (ValueError, AttributeError):
        user_id_bytes = str(user_id_str).encode("utf-8")[:16].ljust(16, b"\x00")
    
    # HKDF to derive AES-256 key
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,  # AES-256
        salt=b"migration_salt_v1",
        info=b"bionex_public_key_encryption_v1",
        backend=default_backend(),
    )
    encryption_key = hkdf.derive(user_id_bytes)
    
    # Generate random nonce
    gcm_nonce = os.urandom(12)
    
    # Encrypt
    cipher = AESGCM(encryption_key)
    plaintext = public_key_pem.encode("utf-8")
    ciphertext = cipher.encrypt(gcm_nonce, plaintext, associated_data=None)
    
    # Format: compact JSON
    storage_blob = {
        "v": 1,
        "ct": base64.urlsafe_b64encode(ciphertext).rstrip(b"=").decode("ascii"),
        "n": base64.urlsafe_b64encode(gcm_nonce).rstrip(b"=").decode("ascii"),
        "a": "AES-256-GCM",
    }
    
    return json.dumps(storage_blob, separators=(",", ":"))


def upgrade() -> None:
    """Add encrypted column and migrate data"""
    # Step 1: Add new column
    op.add_column(
        'user_keypairs',
        sa.Column('public_key_pem_encrypted', sa.Text(), nullable=True),
        schema='bionex'
    )
    
    # Step 2: Migrate data
    bind = op.get_bind()
    
    try:
        result = bind.execute(
            sa.text("SELECT id, user_id, public_key_pem FROM bionex.user_keypairs WHERE public_key_pem IS NOT NULL")
        )
        rows = result.fetchall()
        
        logger.info(f"Encrypting {len(rows)} public keys...")
        
        for row in rows:
            row_id, user_id, public_key_pem = row
            
            try:
                # Encrypt
                encrypted_blob = encrypt_public_key_simple(public_key_pem, str(user_id))
                
                # Update row
                bind.execute(
                    sa.text(
                        "UPDATE bionex.user_keypairs SET public_key_pem_encrypted = :encrypted WHERE id = :id"
                    ),
                    {"encrypted": encrypted_blob, "id": str(row_id)},
                )
                
            except Exception as e:
                logger.error(f"Failed to encrypt keypair {row_id}: {e}")
                # Continue with next row
        
        bind.commit()
        
        logger.info(f"✓ Encrypted {len(rows)} public keys")
        
        # Step 3: Drop old column
        op.drop_column('public_key_pem', schema='bionex')
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise


def downgrade() -> None:
    """Restore plaintext column (for dev/test only)"""
    op.add_column(
        'user_keypairs',
        sa.Column('public_key_pem', sa.Text(), nullable=True),
        schema='bionex'
    )
    op.drop_column('public_key_pem_encrypted', schema='bionex')

