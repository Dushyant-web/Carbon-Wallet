"""Settings. Reads the project-root .env (shared with the Next app) for values not already set."""

import os
from pathlib import Path

_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"
# Only engine settings are taken from the shared file. DATABASE_URL there is Prisma's, not ours.
_ALLOWED = {
    "ENGINE_API_KEY", "BILL_HASH_SALT", "TESSDATA_DIR",
    "BILL_AI_PROVIDER", "ANTHROPIC_API_KEY", "BILL_AI_MODEL", "NVIDIA_API_KEY", "NVIDIA_BILL_MODEL", "NVIDIA_TEXT_MODEL",
    "ENGINE_SALT_KEY", "CHAIN_RPC_URL", "CHAIN_ID", "CHAIN_NAME", "CHAIN_EXPLORER", "ANCHOR_PRIVATE_KEY", "ANCHOR_CONTRACT_ADDRESS",
}


def _load_root_env() -> None:
    if not _ROOT_ENV.exists():
        return
    for raw in _ROOT_ENV.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() in _ALLOWED:
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_root_env()

ENGINE_API_KEY = os.getenv("ENGINE_API_KEY", "")
MAX_BILL_BYTES = 10 * 1024 * 1024

# Statement salts are encrypted at rest with this key (base64, 32 bytes). Without it a key is derived from
# ENGINE_API_KEY, so set ENGINE_SALT_KEY before rotating the engine key.
ENGINE_SALT_KEY = os.getenv("ENGINE_SALT_KEY", "")

# Public-chain anchoring (Docs/blockchain.md). All four must be set, or anchoring stays on the local devnet.
CHAIN_RPC_URL = os.getenv("CHAIN_RPC_URL", "")
CHAIN_ID = int(os.getenv("CHAIN_ID", "0") or 0)
CHAIN_NAME = os.getenv("CHAIN_NAME", "")  # e.g. "polygon-amoy"
CHAIN_EXPLORER = os.getenv("CHAIN_EXPLORER", "")  # e.g. "https://amoy.polygonscan.com"
ANCHOR_PRIVATE_KEY = os.getenv("ANCHOR_PRIVATE_KEY", "")
ANCHOR_CONTRACT_ADDRESS = os.getenv("ANCHOR_CONTRACT_ADDRESS", "")
