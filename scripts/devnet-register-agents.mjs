#!/usr/bin/env node
/**
 * devnet-register-agents.mjs
 *
 * Register fresh creator and worker agents against the current devnet program.
 * Prints the resulting agent PDAs — copy them into devnet-task-lifecycle-test.mjs.
 *
 * Usage:
 *   AGENC_IDL_PATH=<path> node scripts/devnet-register-agents.mjs
 */

import crypto from "node:crypto";
import process from "node:process";
import { Connection } from "@solana/web3.js";
import {
  loadKeypair,
  loadIdl,
  createProgram,
  lamportsToSol,
} from "../../forks/agenc-sdk/scripts/devnet-helpers.mjs";
import {
  registerAgent,
  getProtocolConfig,
} from "@tetsuo-ai/sdk";

const RPC_URL      = process.env.RPC_URL        ?? "https://api.devnet.solana.com";
const CREATOR_PATH = process.env.CREATOR_WALLET ?? `${process.env.HOME}/.config/solana/id.json`;
const WORKER_PATH  = process.env.WORKER_WALLET  ?? `${process.env.HOME}/.config/solana/worker.json`;
const IDL_PATH     = process.env.AGENC_IDL_PATH;

const SOLSCAN = (sig) => `https://solscan.io/tx/${sig}?cluster=devnet`;

if (!IDL_PATH) {
  console.error("[error] AGENC_IDL_PATH is required");
  process.exit(1);
}

console.log("=== AgenC Agent Registration — devnet ===\n");

const connection     = new Connection(RPC_URL, "confirmed");
const idl            = await loadIdl(IDL_PATH);
const creatorKeypair = await loadKeypair(CREATOR_PATH);
const workerKeypair  = await loadKeypair(WORKER_PATH);
const creatorProgram = createProgram(connection, idl, creatorKeypair);
const workerProgram  = createProgram(connection, idl, workerKeypair);

console.log(`[config] creator wallet: ${creatorKeypair.publicKey.toBase58()}`);
console.log(`[config] worker wallet:  ${workerKeypair.publicKey.toBase58()}`);

const [creatorBal, workerBal] = await Promise.all([
  connection.getBalance(creatorKeypair.publicKey, "confirmed").then(BigInt),
  connection.getBalance(workerKeypair.publicKey,  "confirmed").then(BigInt),
]);
console.log(`[config] creator balance: ${lamportsToSol(Number(creatorBal))} SOL`);
console.log(`[config] worker balance:  ${lamportsToSol(Number(workerBal))} SOL`);

const protocolConfig = await getProtocolConfig(creatorProgram);
if (!protocolConfig) {
  console.error("[error] protocol config not found — is the IDL pointing at the right program?");
  process.exit(1);
}
const minStake = protocolConfig.minAgentStake;
console.log(`[protocol] minAgentStake: ${lamportsToSol(Number(minStake))} SOL (${minStake} lamports)\n`);

// --- Register creator agent ---
console.log("[step 1] registering creator agent...");
const creatorAgentId = crypto.randomBytes(32);
const { agentPda: creatorAgentPda, txSignature: creatorTx } = await registerAgent(
  connection,
  creatorProgram,
  creatorKeypair,
  {
    agentId: creatorAgentId,
    capabilities: 1n,
    endpoint: "https://example.invalid/creator",
    metadataUri: null,
    stakeAmount: minStake,
  },
);
console.log(`[step 1] ✅ creator agent registered`);
console.log(`         PDA: ${creatorAgentPda.toBase58()}`);
console.log(`         tx:  ${creatorTx}`);
console.log(`         url: ${SOLSCAN(creatorTx)}`);

// --- Register worker agent ---
console.log("\n[step 2] registering worker agent...");
const workerAgentId = crypto.randomBytes(32);
const { agentPda: workerAgentPda, txSignature: workerTx } = await registerAgent(
  connection,
  workerProgram,
  workerKeypair,
  {
    agentId: workerAgentId,
    capabilities: 1n,
    endpoint: "https://example.invalid/worker",
    metadataUri: null,
    stakeAmount: minStake,
  },
);
console.log(`[step 2] ✅ worker agent registered`);
console.log(`         PDA: ${workerAgentPda.toBase58()}`);
console.log(`         tx:  ${workerTx}`);
console.log(`         url: ${SOLSCAN(workerTx)}`);

console.log("\n=== Registration complete ===");
console.log("\nAdd these to devnet-task-lifecycle-test.mjs:");
console.log(`  CREATOR_AGENT_PDA = new PublicKey("${creatorAgentPda.toBase58()}")`);
console.log(`  WORKER_AGENT_PDA  = new PublicKey("${workerAgentPda.toBase58()}")`);
