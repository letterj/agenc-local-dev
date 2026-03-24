#!/usr/bin/env node
/**
 * devnet-task-lifecycle.mjs
 *
 * Runs the full AgenC task lifecycle on devnet with separate creator and worker
 * wallets/agents:
 *
 *   Creator (id.json / BP3r...)    — creates and funds the task
 *   Worker  (worker.json / 26d6...) — claims and completes the task
 *
 * Usage:
 *   node scripts/devnet-task-lifecycle.mjs
 *
 * Required env vars:
 *   AGENC_IDL_PATH   Path to agenc_coordination.json
 *
 * Optional env vars:
 *   CREATOR_WALLET   Keypair file (default: ~/.config/solana/id.json)
 *   WORKER_WALLET    Keypair file (default: ~/.config/solana/worker.json)
 *   RPC_URL          Devnet RPC endpoint (default: https://api.devnet.solana.com)
 *   REWARD_LAMPORTS  Task reward in lamports (default: 10000000 = 0.01 SOL)
 *   DEADLINE_SECS    Seconds from now until task deadline (default: 3600 = 1h)
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
  sha256Bytes,
} from "../../forks/agenc-sdk/scripts/devnet-helpers.mjs";
import {
  getAgent,
  createTask,
  claimTask,
  completeTask,
  getTask,
  formatTaskState,
  TaskState,
} from "@tetsuo-ai/sdk";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CREATOR_AGENT_PDA = new PublicKey("GvXS49pWYMtgThmeVw32L7dPBFyCD1siYsTH4CaobpEs");
const WORKER_AGENT_PDA  = new PublicKey("CmehT9UrmeCEFNKuXKVHuoQuAjZAa6J6sgC1W8gRr58V");

const RPC_URL        = process.env.RPC_URL         ?? "https://api.devnet.solana.com";
const CREATOR_PATH   = process.env.CREATOR_WALLET  ?? `${process.env.HOME}/.config/solana/id.json`;
const WORKER_PATH    = process.env.WORKER_WALLET   ?? `${process.env.HOME}/.config/solana/worker.json`;
const IDL_PATH       = process.env.AGENC_IDL_PATH;
const REWARD         = BigInt(process.env.REWARD_LAMPORTS ?? "10000000"); // 0.01 SOL
const DEADLINE_ADD   = Number(process.env.DEADLINE_SECS   ?? "3600");    // 1 hour

const SOLSCAN = (sig) => `https://solscan.io/tx/${sig}?cluster=devnet`;

if (!IDL_PATH) {
  console.error("[error] AGENC_IDL_PATH is required");
  console.error("  export AGENC_IDL_PATH=~/workshop/agencproj/forks/agenc-protocol/artifacts/anchor/idl/agenc_coordination.json");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Setup — load both keypairs and programs
// ---------------------------------------------------------------------------

console.log("=== AgenC Task Lifecycle — devnet ===\n");

const connection     = new Connection(RPC_URL, "confirmed");
const idl            = await loadIdl(IDL_PATH);
const creatorKeypair = await loadKeypair(CREATOR_PATH);
const workerKeypair  = await loadKeypair(WORKER_PATH);
const creatorProgram = createProgram(connection, idl, creatorKeypair);
const workerProgram  = createProgram(connection, idl, workerKeypair);

console.log(`[config] creator wallet:  ${creatorKeypair.publicKey.toBase58()}`);
console.log(`[config] creator agent:   ${CREATOR_AGENT_PDA.toBase58()}`);
console.log(`[config] worker wallet:   ${workerKeypair.publicKey.toBase58()}`);
console.log(`[config] worker agent:    ${WORKER_AGENT_PDA.toBase58()}`);
console.log(`[config] reward:          ${lamportsToSol(Number(REWARD))} SOL`);

// Balance checks
const [creatorBal, workerBal] = await Promise.all([
  connection.getBalance(creatorKeypair.publicKey, "confirmed").then(BigInt),
  connection.getBalance(workerKeypair.publicKey,  "confirmed").then(BigInt),
]);
console.log(`[config] creator balance: ${lamportsToSol(Number(creatorBal))} SOL`);
console.log(`[config] worker balance:  ${lamportsToSol(Number(workerBal))} SOL`);

const creatorMin = REWARD + 20_000_000n; // reward + ~0.02 SOL for fees and escrow rent
if (creatorBal < creatorMin) {
  console.error(`[error] creator balance too low. Need ${lamportsToSol(Number(creatorMin))} SOL minimum.`);
  process.exit(1);
}
if (workerBal < 5_000_000n) { // ~0.005 SOL for claim + complete tx fees
  console.error(`[error] worker balance too low. Need at least 0.005 SOL for transaction fees.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 0 — Recover agent IDs from on-chain PDAs
// ---------------------------------------------------------------------------

console.log("\n[step 0] fetching agent registrations...");

const [creatorAgent, workerAgent] = await Promise.all([
  getAgent(creatorProgram, CREATOR_AGENT_PDA),
  getAgent(workerProgram,  WORKER_AGENT_PDA),
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
// Step 1 — Create task (creator wallet)
// ---------------------------------------------------------------------------

console.log("\n[step 1] creating task...");

const taskId      = crypto.randomBytes(32);
const deadline    = Math.floor(Date.now() / 1000) + DEADLINE_ADD;
const description = fixedUtf8Bytes(`agenc lifecycle test ${new Date().toISOString()}`, 64);

const { taskPda, txSignature: createTx } = await createTask(
  connection,
  creatorProgram,
  creatorKeypair,
  creatorAgent.agentId,
  {
    taskId,
    requiredCapabilities: workerAgent.capabilities, // worker must meet this
    description,
    rewardAmount: REWARD,
    maxWorkers: 1,
    deadline,
    taskType: 0,        // Exclusive
    constraintHash: null,
    minReputation: 0,
    rewardMint: null,   // SOL reward
  },
);

console.log(`[step 1] ✅ task created`);
console.log(`         taskPda:  ${taskPda.toBase58()}`);
console.log(`         deadline: ${formatUnix(deadline)}`);
console.log(`         tx:       ${createTx}`);
console.log(`         solscan:  ${SOLSCAN(createTx)}`);

// ---------------------------------------------------------------------------
// Step 2 — Claim task (worker wallet)
// ---------------------------------------------------------------------------

console.log("\n[step 2] claiming task...");

const { txSignature: claimTx } = await claimTask(
  connection,
  workerProgram,
  workerKeypair,
  workerAgent.agentId,
  taskPda,
);

console.log(`[step 2] ✅ task claimed`);
console.log(`         tx:       ${claimTx}`);
console.log(`         solscan:  ${SOLSCAN(claimTx)}`);

const taskAfterClaim = await getTask(workerProgram, taskPda);
console.log(`[step 2] state:    ${formatTaskState(taskAfterClaim.state)} (expected: In Progress)`);
if (taskAfterClaim.state !== TaskState.InProgress) {
  console.error(`[error] unexpected state after claim: ${formatTaskState(taskAfterClaim.state)}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 3 — Complete task (worker wallet)
// ---------------------------------------------------------------------------

console.log("\n[step 3] completing task...");

// proofHash: sha256 of taskId — any 32 bytes are accepted for public tasks
const proofHash = sha256Bytes(Buffer.from(taskId), "lifecycle-complete");

const { txSignature: completeTx } = await completeTask(
  connection,
  workerProgram,
  workerKeypair,
  workerAgent.agentId,
  taskPda,
  proofHash,
  null,
);

console.log(`[step 3] ✅ task completed`);
console.log(`         tx:       ${completeTx}`);
console.log(`         solscan:  ${SOLSCAN(completeTx)}`);

// ---------------------------------------------------------------------------
// Final verification
// ---------------------------------------------------------------------------

console.log("\n[verify] fetching final task state...");
const finalTask = await getTask(creatorProgram, taskPda);

if (!finalTask) {
  console.log("[verify] task account closed (escrow reclaimed after completion)");
} else {
  console.log(`[verify] state:       ${formatTaskState(finalTask.state)}`);
  console.log(`[verify] completedAt: ${finalTask.completedAt ? formatUnix(finalTask.completedAt) : "null"}`);
  if (finalTask.state !== TaskState.Completed) {
    console.error(`[error] expected Completed, got ${formatTaskState(finalTask.state)}`);
    process.exit(1);
  }
}

console.log("\n=== lifecycle complete ===");
console.log(`  create:   ${SOLSCAN(createTx)}`);
console.log(`  claim:    ${SOLSCAN(claimTx)}`);
console.log(`  complete: ${SOLSCAN(completeTx)}`);
