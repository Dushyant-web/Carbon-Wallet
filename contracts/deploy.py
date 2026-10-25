"""Deploy CarbonAnchor to a public EVM chain (e.g. Polygon Amoy) and publish the current factor set.

Usage (from backend/):
    CHAIN_RPC_URL=https://rpc-amoy.polygon.technology ANCHOR_PRIVATE_KEY=0x... uv run python ../contracts/deploy.py

The key is read from the environment only and never printed. Fund its address from a faucet first.
Prints the .env lines to add so the engine anchors there.
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from web3 import HTTPProvider, Web3  # noqa: E402

from app.chain import EvmChain, deploy  # noqa: E402
from app.engine import factors, merkle  # noqa: E402

EXPLORERS = {80002: "https://amoy.polygonscan.com", 11155111: "https://sepolia.etherscan.io", 137: "https://polygonscan.com"}
NAMES = {80002: "polygon-amoy", 11155111: "sepolia", 137: "polygon"}


def main() -> None:
    rpc = os.environ.get("CHAIN_RPC_URL")
    key = os.environ.get("ANCHOR_PRIVATE_KEY")
    if not rpc or not key:
        sys.exit("Set CHAIN_RPC_URL and ANCHOR_PRIVATE_KEY in the environment.")
    w3 = Web3(HTTPProvider(rpc, request_kwargs={"timeout": 30}))
    chain_id = w3.eth.chain_id
    account = w3.eth.account.from_key(key)
    balance = w3.eth.get_balance(account.address)
    print(f"chain {chain_id} ({NAMES.get(chain_id, 'unknown')}), deployer {account.address}, balance {w3.from_wei(balance, 'ether')}")
    if balance == 0:
        sys.exit("The deployer has no funds. Use the chain's faucet first.")

    address = deploy(w3, key)
    chain = EvmChain(w3, address, key, NAMES.get(chain_id, f"evm-{chain_id}"))
    fs_hash = merkle.keccak(merkle.canonical_json({"version": factors.FACTOR_SET_VERSION, "factors": factors.registry_as_dicts()}))
    chain.ensure_factor_set(fs_hash, factors.FACTOR_SET_VERSION)

    explorer = EXPLORERS.get(chain_id, "")
    print(f"\nCarbonAnchor deployed at {address}")
    if explorer:
        print(f"{explorer}/address/{address}")
    print("\nAdd to .env (the key stays as you set it):")
    print(f"CHAIN_RPC_URL={rpc}\nCHAIN_ID={chain_id}\nCHAIN_NAME={NAMES.get(chain_id, f'evm-{chain_id}')}")
    print(f"CHAIN_EXPLORER={explorer}\nANCHOR_CONTRACT_ADDRESS={address}\nANCHOR_PRIVATE_KEY=<the same key>")


if __name__ == "__main__":
    main()
