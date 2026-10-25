"""Chain clients for anchoring Merkle roots (Docs/blockchain.md).

- `EvmChain`: the real thing. Sends `anchor(root, factorSetHash, period)` to the CarbonAnchor contract
  (contracts/CarbonAnchor.sol, compiled to contracts/build/CarbonAnchor.json) on any EVM chain, e.g.
  Polygon Amoy, and checks proofs with the contract's own `verify`. Used when CHAIN_RPC_URL, CHAIN_ID,
  ANCHOR_PRIVATE_KEY and ANCHOR_CONTRACT_ADDRESS are all set.
- `LocalDevnetChain`: records anchors only in our own database, with a deterministic pseudo transaction hash.
  It is labelled "local-devnet" everywhere so nobody mistakes it for a public chain.
"""

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Protocol

from app import config
from app.engine.merkle import keccak

ARTIFACT = Path(__file__).resolve().parents[2] / "contracts" / "build" / "CarbonAnchor.json"


class ChainError(Exception):
    pass


@dataclass
class AnchorReceipt:
    tx_hash: str
    chain_batch_id: int | None = None  # the contract's own batch index
    block_number: int | None = None
    chain_id: int | None = None
    contract: str | None = None


class ChainClient(Protocol):
    name: str

    def anchor(self, root: bytes, factor_set_hash: bytes, batch_id: int, period: str, factor_set_version: str) -> AnchorReceipt: ...

    def verify_onchain(self, chain_batch_id: int, proof: list[bytes], leaf: bytes) -> bool | None: ...


class LocalDevnetChain:
    name = "local-devnet"

    def anchor(self, root: bytes, factor_set_hash: bytes, batch_id: int, period: str = "", factor_set_version: str = "") -> AnchorReceipt:
        return AnchorReceipt(tx_hash="0x" + keccak(root + factor_set_hash + batch_id.to_bytes(8, "big")).hex())

    def verify_onchain(self, chain_batch_id: int, proof: list[bytes], leaf: bytes) -> bool | None:
        return None  # nothing on-chain to ask


def load_artifact() -> dict:
    return json.loads(ARTIFACT.read_text())


class EvmChain:
    def __init__(self, w3, contract_address: str, private_key: str, name: str):
        from web3 import Web3

        self.w3 = w3
        self.name = name
        self.account = w3.eth.account.from_key(private_key)
        self.address = Web3.to_checksum_address(contract_address)
        self.contract = w3.eth.contract(address=self.address, abi=load_artifact()["abi"])
        self.chain_id = w3.eth.chain_id

    def _send(self, call):
        from web3 import Web3

        tx = call.build_transaction(
            {"from": self.account.address, "nonce": self.w3.eth.get_transaction_count(self.account.address, "pending"), "chainId": self.chain_id}
        )
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
        if receipt["status"] != 1:
            raise ChainError(f"Transaction {Web3.to_hex(tx_hash)} failed on-chain.")
        return receipt

    def ensure_factor_set(self, factor_set_hash: bytes, version: str) -> None:
        if not self.contract.functions.factorSetVersion(factor_set_hash).call():
            self._send(self.contract.functions.publishFactorSet(factor_set_hash, version))

    def anchor(self, root: bytes, factor_set_hash: bytes, batch_id: int, period: str, factor_set_version: str) -> AnchorReceipt:
        from web3 import Web3

        try:
            self.ensure_factor_set(factor_set_hash, factor_set_version)
            receipt = self._send(self.contract.functions.anchor(root, factor_set_hash, period[:64]))
        except ChainError:
            raise
        except Exception as exc:  # RPC down, out of gas money, nonce clash…
            raise ChainError(f"Couldn't anchor on {self.name}: {exc}") from exc
        events = self.contract.events.BatchAnchored().process_receipt(receipt)
        return AnchorReceipt(
            tx_hash=Web3.to_hex(receipt["transactionHash"]),
            chain_batch_id=int(events[0]["args"]["id"]) if events else None,
            block_number=int(receipt["blockNumber"]),
            chain_id=self.chain_id,
            contract=self.address,
        )

    def verify_onchain(self, chain_batch_id: int, proof: list[bytes], leaf: bytes) -> bool | None:
        try:
            return bool(self.contract.functions.verify(chain_batch_id, proof, leaf).call())
        except Exception:
            return None  # chain unreachable: the local check still stands


def deploy(w3, private_key: str) -> str:
    """Deploys CarbonAnchor from the compiled artifact; returns its address. Used by contracts/deploy.py and tests."""
    from web3 import Web3

    art = load_artifact()
    account = w3.eth.account.from_key(private_key)
    factory = w3.eth.contract(abi=art["abi"], bytecode=art["bytecode"])
    tx = factory.constructor().build_transaction(
        {"from": account.address, "nonce": w3.eth.get_transaction_count(account.address, "pending"), "chainId": w3.eth.chain_id}
    )
    signed = account.sign_transaction(tx)
    receipt = w3.eth.wait_for_transaction_receipt(w3.eth.send_raw_transaction(signed.raw_transaction), timeout=300)
    if receipt["status"] != 1:
        raise ChainError("Contract deployment failed.")
    return Web3.to_checksum_address(receipt["contractAddress"])


def public_chain_configured() -> bool:
    return bool(config.CHAIN_RPC_URL and config.CHAIN_ID and config.ANCHOR_PRIVATE_KEY and config.ANCHOR_CONTRACT_ADDRESS)


@lru_cache(maxsize=1)
def _evm_chain() -> EvmChain:
    from web3 import HTTPProvider, Web3

    w3 = Web3(HTTPProvider(config.CHAIN_RPC_URL, request_kwargs={"timeout": 30}))
    chain = EvmChain(w3, config.ANCHOR_CONTRACT_ADDRESS, config.ANCHOR_PRIVATE_KEY, config.CHAIN_NAME or f"evm-{config.CHAIN_ID}")
    if chain.chain_id != config.CHAIN_ID:
        raise ChainError(f"RPC is chain {chain.chain_id}, expected {config.CHAIN_ID}.")
    return chain


def get_chain() -> ChainClient:
    return _evm_chain() if public_chain_configured() else LocalDevnetChain()


def explorer_tx_url(chain_name: str, tx_hash: str) -> str | None:
    if config.CHAIN_EXPLORER and public_chain_configured() and chain_name == (config.CHAIN_NAME or f"evm-{config.CHAIN_ID}"):
        return f"{config.CHAIN_EXPLORER.rstrip('/')}/tx/{tx_hash}"
    return None
