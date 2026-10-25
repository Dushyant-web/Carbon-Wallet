// Compiles contracts/CarbonAnchor.sol with solc-js (no network) into contracts/build/CarbonAnchor.json,
// which the engine loads to deploy and call the contract. Run: node scripts/compile-contract.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import solc from "solc";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const source = readFileSync(path.join(root, "contracts/CarbonAnchor.sol"), "utf8");
const input = {
  language: "Solidity",
  sources: { "CarbonAnchor.sol": { content: source } },
  settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris", outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
};
const findImports = (p) => {
  try {
    return { contents: readFileSync(path.join(root, "node_modules", p), "utf8") };
  } catch {
    return { error: `not found: ${p}` };
  }
};
const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = (out.errors ?? []).filter((e) => e.severity === "error");
if (errors.length) {
  console.error(errors.map((e) => e.formattedMessage).join("\n"));
  process.exit(1);
}
const c = out.contracts["CarbonAnchor.sol"].CarbonAnchor;
const artifact = {
  contractName: "CarbonAnchor",
  compiler: `solc ${solc.version()}`,
  evmVersion: "paris",
  sourceSha256: createHash("sha256").update(source).digest("hex"),
  abi: c.abi,
  bytecode: "0x" + c.evm.bytecode.object,
};
writeFileSync(path.join(root, "contracts/build/CarbonAnchor.json"), JSON.stringify(artifact, null, 2) + "\n");
console.log(`compiled with ${artifact.compiler}: ${artifact.abi.length} ABI entries, ${(artifact.bytecode.length - 2) / 2} bytes`);
