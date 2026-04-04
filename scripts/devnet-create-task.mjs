#!/usr/bin/env node
/**
 * devnet-create-task.mjs
 *
 * Creates a single task on devnet and exits — does NOT claim or complete.
 * The task remains Open, visible in the daemon UI.
 *
 * Usage:
 *   AGENC_IDL_PATH=<path> node scripts/devnet-create-task.mjs
 *
 * Required env vars:
 *   AGENC_IDL_PATH   Path to agenc_coordination.json
 *
 * Optional env vars:
 *   CREATOR_WALLET   Keypair file (default: ~/.config/solana/id.json)
 *   RPC_URL          Devnet RPC endpoint (default: https://api.devnet.solana.com)
 *   REWARD_LAMPORTS  Task reward in lamports (default: 10000000 = 0.01 SOL)
 *   DEADLINE_SECS    Seconds from now until task deadline (default: 3600 = 1h)
 *   TASK_DESCRIPTION Task description string (truncated to 64 bytes on-chain)
 */

import crypto from "node:crypto";
import process from "node:process";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  loadKeypair,
  loadIdl,
  createProgram,
  lamportsToSol,
  formatUnix,
  fixedUtf8Bytes,
} from "../../forks/agenc-sdk/scripts/devnet-helpers.mjs";
import {
  getAgent,
  createTask,
} from "@tetsuo-ai/sdk";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CREATOR_AGENT_PDA = new PublicKey("HmZqAsDzW1Ew6SwQCcZoBvzYaYRXs2TeXBx31s8xSy7H");
const WORKER_AGENT_PDA  = new PublicKey("DQ1drYVZ9WuHANrnBBLWiaHm9vifZ2p4y7HZ4EFiNDdv");

const DEFAULT_DESCRIPTION =
  "Artemis II Lunar Flyby Report — research when Orion will reach closest approach to the Moon, trajectory type, lunar features visible, comms blackout duration, and distance record. Return as a structured report.";

const RPC_URL      = process.env.RPC_URL            ?? "https://api.devnet.solana.com";
const CREATOR_PATH = process.env.CREATOR_WALLET     ?? `${process.env.HOME}/.config/solana/id.json`;
const IDL_PATH     = process.env.AGENC_IDL_PATH;
const REWARD       = BigInt(process.env.REWARD_LAMPORTS ?? "10000000"); // 0.01 SOL
const DEADLINE_ADD = Number(process.env.DEADLINE_SECS   ?? "3600");    // 1 hour
const DESCRIPTION  = process.env.TASK_DESCRIPTION   ?? DEFAULT_DESCRIPTION;

const SOLSCAN = (sig) => `https://solscan.io/tx/${sig}?cluster=devnet`;

if (!IDL_PATH) {
  console.error("[error] AGENC_IDL_PATH is required");
  console.error("  export AGENC_IDL_PATH=~/workshop/agencproj/forks/agenc-protocol/artifacts/anchor/idl/agenc_coordination.json");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

console.log("=== AgenC Create Task — devnet ===\n");

const connection     = new Connection(RPC_URL, "confirmed");
const idl            = await loadIdl(IDL_PATH);
const creatorKeypair = await loadKeypair(CREATOR_PATH);
const creatorProgram = createProgram(connection, idl, creatorKeypair);

console.log(`[config] creator wallet: ${creatorKeypair.publicKey.toBase58()}`);
console.log(`[config] creator agent:  ${CREATOR_AGENT_PDA.toBase58()}`);
console.log(`[config] reward:         ${lamportsToSol(Number(REWARD))} SOL`);
console.log(`[config] description:    ${DESCRIPTION.slice(0, 64)}...`);

const creatorBal = BigInt(await connection.getBalance(creatorKeypair.publicKey, "confirmed"));
console.log(`[config] creator balance: ${lamportsToSol(Number(creatorBal))} SOL`);

const creatorMin = REWARD + 20_000_000n;
if (creatorBal < creatorMin) {
  console.error(`[error] creator balance too low. Need ${lamportsToSol(Number(creatorMin))} SOL minimum.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 0 — Fetch agent registration
// ---------------------------------------------------------------------------

console.log("\n[step 0] fetching agent registrations...");

const [creatorAgent, workerAgent] = await Promise.all([
  getAgent(creatorProgram, CREATOR_AGENT_PDA),
  // worker agent needed to set requiredCapabilities
  (async () => {
    const { createProgram: cp } = await import("../../forks/agenc-sdk/scripts/devnet-helpers.mjs");
    // reuse same connection/idl/keypair — capabilities are just a u64
    return getAgent(creatorProgram, WORKER_AGENT_PDA);
  })(),
]);

if (!creatorAgent) {
  console.error(`[error] creator agent not found at ${CREATOR_AGENT_PDA.toBase58()}`);
  process.exit(1);
}
if (!workerAgent) {
  console.error(`[error] worker agent not found at ${WORKER_AGENT_PDA.toBase58()}`);
  process.exit(1);
}

console.log(`[step 0] creator agent — capabilities: ${creatorAgent.capabilities} | reputation: ${creatorAgent.reputation}`);
console.log(`[step 0] worker agent  — capabilities: ${workerAgent.capabilities}  | reputation: ${workerAgent.reputation}`);

// ---------------------------------------------------------------------------
// Step 1 — Create task
// ---------------------------------------------------------------------------

console.log("\n[step 1] creating task...");

const taskId      = crypto.randomBytes(32);
const deadline    = Math.floor(Date.now() / 1000) + DEADLINE_ADD;
const description = fixedUtf8Bytes(DESCRIPTION, 64);

const { taskPda, txSignature: createTx } = await createTask(
  connection,
  creatorProgram,
  creatorKeypair,
  creatorAgent.agentId,
  {
    taskId,
    requiredCapabilities: workerAgent.capabilities,
    description,
    rewardAmount: REWARD,
    maxWorkers: 1,
    deadline,
    taskType: 0,       // Exclusive
    constraintHash: null,
    minReputation: 0,
    rewardMint: null,  // SOL reward
  },
);

const balAfter = BigInt(await connection.getBalance(creatorKeypair.publicKey, "confirmed"));

console.log(`[step 1] ✅ task created`);
console.log(`         taskPda:           ${taskPda.toBase58()}`);
console.log(`         deadline:          ${formatUnix(deadline)}`);
console.log(`         description[0:64]: ${DESCRIPTION.slice(0, 64)}`);
console.log(`         tx:                ${createTx}`);
console.log(`         solscan:           ${SOLSCAN(createTx)}`);
console.log(`\n[balance] before: ${lamportsToSol(Number(creatorBal))} SOL`);
console.log(`[balance] after:  ${lamportsToSol(Number(balAfter))} SOL`);
console.log(`[balance] spent:  ${lamportsToSol(Number(creatorBal - balAfter))} SOL`);
