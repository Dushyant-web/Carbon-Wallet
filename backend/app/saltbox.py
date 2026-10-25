"""Statement salts at rest: AES-256-GCM (Docs/blockchain.md §2.2).

The salt is what links an on-chain leaf to a household's statement, so it never sits in the database in the
clear. Deleting it crypto-shreds the leaf: the Merkle root stays on-chain, but nothing can be matched to it.
Salts stored before encryption (plain "0x…") are still read as they are.
"""

import base64
import hashlib
import os

from Crypto.Cipher import AES

from app import config

PREFIX = "enc:v1:"


def _key() -> bytes:
    if config.ENGINE_SALT_KEY:
        key = base64.b64decode(config.ENGINE_SALT_KEY)
        if len(key) != 32:
            raise RuntimeError("ENGINE_SALT_KEY must be 32 bytes, base64-encoded.")
        return key
    if not config.ENGINE_API_KEY:
        raise RuntimeError("Set ENGINE_SALT_KEY (or ENGINE_API_KEY) so statement salts can be encrypted.")
    return hashlib.sha256(b"carbon-wallet/statement-salt/v1|" + config.ENGINE_API_KEY.encode()).digest()


def seal(salt_hex: str) -> str:
    nonce = os.urandom(12)
    cipher = AES.new(_key(), AES.MODE_GCM, nonce=nonce)
    ciphertext, tag = cipher.encrypt_and_digest(salt_hex.encode())
    return PREFIX + base64.b64encode(nonce + ciphertext + tag).decode()


def open_salt(stored: str) -> str:
    if not stored.startswith(PREFIX):
        return stored  # stored before encryption
    raw = base64.b64decode(stored[len(PREFIX):])
    nonce, ciphertext, tag = raw[:12], raw[12:-16], raw[-16:]
    return AES.new(_key(), AES.MODE_GCM, nonce=nonce).decrypt_and_verify(ciphertext, tag).decode()
