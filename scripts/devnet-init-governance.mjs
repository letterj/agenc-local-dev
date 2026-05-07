#!/usr/bin/env node
/**
 * devnet-init-governance.mjs
 *
 * Initializes the governance_config PDA on a deployed agenc-coordination program.
 * Required for marketplace-tui-devnet-smoke.ts governance phase.
 * Not covered by the standard validation-initialize.mjs script.
 *
 * Usage:
 *   AGENC_IDL_PATH=<path-to-idl> \
 *   AGENC_PROGRAM_ID=<program-id> \
 *   PROTOCOL_AUTHORITY_WALLET=~/.config/solana/protocol-authority.json \
 *   node scripts/devnet-init-governance.mjs
 *
 * Private program:
 *   Program ID: 9dMNFLWENJSQWriPt7p5XpSqakxsdmKB4Q7gJvbbznmc
 *   Governance Config PDA: nXZbxo5v9L2Wi7PdhTW5qXALKNAhFFgiLRUEwMfVdWq
 *
 * Required env:
 *   AGENC_IDL_PATH          — path to agenc_coordination.json IDL
 *
 * Optional env:
 *   RPC_URL                 — defaults to https://api.devnet.solana.com
 *   PROTOCOL_AUTHORITY_WALLET or AUTHORITY_WALLET — keypair path; defaults to
 *                             ~/.config/solana/protocol-authority.json
 *   PROGRAM_ID              — defaults to 9dMNFLWENJSQWriPt7p5XpSqakxsdmKB4Q7gJvbbznmc
 *
 * Governance params (devnet-friendly defaults):
 *   voting_period          = 86400 s (1 day max)
 *   execution_delay        = 0 s
 *   quorum_bps             = 100 (1%)
 *   approval_threshold_bps = 5100 (51%)
 *   min_proposal_stake     = 100_000 lamports (0.0001 SOL)
 *
 * Idempotent — exits cleanly if governance_config is already initialized.
 *
 * Author: J Brett (letterj) with Claude Sonnet 4.6
 * Date: 2026-04-09
 */

import process from "node:process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import pkg from "@coral-xyz/anchor";
const anchor = pkg;
const BN = pkg.BN;
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RPC_URL       = process.env.RPC_URL        ?? "https://api.devnet.solana.com";
const AUTHORITY_PATH = process.env.PROTOCOL_AUTHORITY_WALLET ?? process.env.AUTHORITY_WALLET ?? `${process.env.HOME}/.config/solana/protocol-authority.json`;
const PROGRAM_ID    = new PublicKey(process.env.PROGRAM_ID ?? "9dMNFLWENJSQWriPt7p5XpSqakxsdmKB4Q7gJvbbznmc");
const IDL_PATH      = process.env.AGENC_IDL_PATH;

const VOTING_PERIOD          = 86_400;      // 1 day
const EXECUTION_DELAY        = 0;
const QUORUM_BPS             = 100;         // 1%
const APPROVAL_THRESHOLD_BPS = 5_100;       // 51%
const MIN_PROPOSAL_STAKE     = 100_000n;    // 0.0001 SOL

if (!IDL_PATH) {
  console.error("[error] AGENC_IDL_PATH is required");
  console.error("  export AGENC_IDL_PATH=~/workshop/agencproj/forks/agenc-protocol/target/idl/agenc_coordination.json");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function expandHome(p) {
  return p.startsWith("~/") ? path.join(process.env.HOME, p.slice(2)) : p;
}

async function loadKeypair(filePath) {
  const raw = JSON.parse(await readFile(expandHome(filePath), "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function loadIdl(filePath) {
  return JSON.parse(await readFile(expandHome(filePath), "utf8"));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log("=== AgenC — initializeGovernance — devnet ===\n");

const connection  = new Connection(RPC_URL, "confirmed");
const authority   = await loadKeypair(AUTHORITY_PATH);
const idl         = await loadIdl(IDL_PATH);

console.log(`[config] program:   ${PROGRAM_ID.toBase58()}`);
console.log(`[config] authority: ${authority.publicKey.toBase58()}`);

const provider = new anchor.AnchorProvider(
  connection,
  new anchor.Wallet(authority),
  { commitment: "confirmed", preflightCommitment: "confirmed" },
);
anchor.setProvider(provider);
const program = new anchor.Program(idl, provider);

// Derive PDAs
const [protocolConfigPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("protocol")],
  PROGRAM_ID,
);
const [governanceConfigPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("governance")],
  PROGRAM_ID,
);

console.log(`[pda] protocol_config:  ${protocolConfigPda.toBase58()}`);
console.log(`[pda] governance_config: ${governanceConfigPda.toBase58()}`);

// Check if governance_config already exists
const existing = await connection.getAccountInfo(governanceConfigPda, "confirmed");
if (existing) {
  console.log("\n[info] governance_config already initialized — nothing to do.");
  process.exit(0);
}

// Check authority balance
const balance = await connection.getBalance(authority.publicKey, "confirmed");
console.log(`\n[config] authority balance: ${(balance / 1e9).toFixed(4)} SOL`);
if (balance < 5_000_000) {
  console.error("[error] authority balance too low — need at least 0.005 SOL for rent + fees");
  process.exit(1);
}

console.log("\n[step] calling initializeGovernance...");
console.log(`  voting_period:          ${VOTING_PERIOD} s`);
console.log(`  execution_delay:        ${EXECUTION_DELAY} s`);
console.log(`  quorum_bps:             ${QUORUM_BPS} (${QUORUM_BPS / 100}%)`);
console.log(`  approval_threshold_bps: ${APPROVAL_THRESHOLD_BPS} (${APPROVAL_THRESHOLD_BPS / 100}%)`);
console.log(`  min_proposal_stake:     ${MIN_PROPOSAL_STAKE} lamports`);

const tx = await program.methods
  .initializeGovernance(
    new BN(VOTING_PERIOD),
    new BN(EXECUTION_DELAY),
    QUORUM_BPS,
    APPROVAL_THRESHOLD_BPS,
    new BN(MIN_PROPOSAL_STAKE.toString()),
  )
  .accounts({
    governanceConfig: governanceConfigPda,
    protocolConfig:   protocolConfigPda,
    authority:        authority.publicKey,
    systemProgram:    SystemProgram.programId,
  })
  .signers([authority])
  .rpc({ commitment: "confirmed" });

console.log(`\n[✅] governance initialized`);
console.log(`     governance_config: ${governanceConfigPda.toBase58()}`);
console.log(`     tx:      ${tx}`);
console.log(`     solscan: https://solscan.io/tx/${tx}?cluster=devnet`);
