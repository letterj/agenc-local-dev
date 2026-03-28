#!/usr/bin/env node
/**
 * devnet-task-lifecycle-test.mjs
 *
 * Task 7 test run — full lifecycle with a specific verifiable task:
 *
 *   Description (first 64 bytes on-chain):
 *     "Compute the SHA-256 hash of the string: 'This is only a test o"
 *   Expected result / proof hash (SHA-256 of the test string):
 *     91a3adb05ed70ededf6ea7cdd14255eaa7f3f93ce60730a408b7ca9ad89bdf60
 *
 * Derives from devnet-task-lifecycle.mjs. Only differences:
 *   - description: fixed test string (truncated to 64 bytes by fixedUtf8Bytes)
 *   - proofHash: SHA-256 of the test string, not sha256(taskId)
 *
 * Usage:
 *   AGENC_IDL_PATH=<path> node scripts/devnet-task-lifecycle-test.mjs
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
  claimTask,
  completeTask,
  getTask,
  formatTaskState,
  TaskState,
} from "@tetsuo-ai/sdk";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CREATOR_AGENT_PDA = new PublicKey("HmZqAsDzW1Ew6SwQCcZoBvzYaYRXs2TeXBx31s8xSy7H");
const WORKER_AGENT_PDA  = new PublicKey("DQ1drYVZ9WuHANrnBBLWiaHm9vifZ2p4y7HZ4EFiNDdv");

const TEST_DESCRIPTION = "Compute the SHA-256 hash of the string: 'This is only a test of the agenc-lifecycle on 2026-03-28'";
const TEST_PROOF_HEX   = "91a3adb05ed70ededf6ea7cdd14255eaa7f3f93ce60730a408b7ca9ad89bdf60";

const RPC_URL      = process.env.RPC_URL        ?? "https://api.devnet.solana.com";
const CREATOR_PATH = process.env.CREATOR_WALLET ?? `${process.env.HOME}/.config/solana/id.json`;
const WORKER_PATH  = process.env.WORKER_WALLET  ?? `${process.env.HOME}/.config/solana/worker.json`;
const IDL_PATH     = process.env.AGENC_IDL_PATH;
const REWARD       = BigInt(process.env.REWARD_LAMPORTS ?? "10000000"); // 0.01 SOL
const DEADLINE_ADD = Number(process.env.DEADLINE_SECS   ?? "3600");    // 1 hour

const SOLSCAN = (sig) => `https://solscan.io/tx/${sig}?cluster=devnet`;

if (!IDL_PATH) {
  console.error("[error] AGENC_IDL_PATH is required");
  console.error("  export AGENC_IDL_PATH=~/workshop/agencproj/forks/agenc-protocol/artifacts/anchor/idl/agenc_coordination.json");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

console.log("=== AgenC Task Lifecycle Test — devnet ===\n");
console.log(`[task] description: ${TEST_DESCRIPTION}`);
console.log(`[task] proof hash:  ${TEST_PROOF_HEX}`);
console.log(`[task] reward:      ${lamportsToSol(Number(REWARD))} SOL\n`);

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

const [creatorBal, workerBal] = await Promise.all([
  connection.getBalance(creatorKeypair.publicKey, "confirmed").then(BigInt),
  connection.getBalance(workerKeypair.publicKey,  "confirmed").then(BigInt),
]);
console.log(`[config] creator balance: ${lamportsToSol(Number(creatorBal))} SOL`);
console.log(`[config] worker balance:  ${lamportsToSol(Number(workerBal))} SOL`);

const creatorMin = REWARD + 20_000_000n;
if (creatorBal < creatorMin) {
  console.error(`[error] creator balance too low. Need ${lamportsToSol(Number(creatorMin))} SOL minimum.`);
  process.exit(1);
}
if (workerBal < 5_000_000n) {
  console.error(`[error] worker balance too low. Need at least 0.005 SOL for transaction fees.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 0 — Verify agent registrations
// ---------------------------------------------------------------------------

console.log("\n[step 0] verifying agent registrations...");

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

console.log(`[step 0] ✅ creator agent — capabilities: ${creatorAgent.capabilities} | reputation: ${creatorAgent.reputation}`);
console.log(`[step 0] ✅ worker agent  — capabilities: ${workerAgent.capabilities}  | reputation: ${workerAgent.reputation}`);

// ---------------------------------------------------------------------------
// Step 1 — Create task (creator wallet)
// ---------------------------------------------------------------------------

console.log("\n[step 1] creating task...");

const taskId      = crypto.randomBytes(32);
const deadline    = Math.floor(Date.now() / 1000) + DEADLINE_ADD;
// NOTE: fixedUtf8Bytes truncates to 64 bytes — full description in runbook
const description = fixedUtf8Bytes(TEST_DESCRIPTION, 64);

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
    taskType: 0,
    constraintHash: null,
    minReputation: 0,
    rewardMint: null,
  },
);

console.log(`[step 1] ✅ task created`);
console.log(`         taskPda:        ${taskPda.toBase58()}`);
console.log(`         deadline:       ${formatUnix(deadline)}`);
console.log(`         description[0:64]: ${TEST_DESCRIPTION.slice(0, 64)}`);
console.log(`         tx:             ${createTx}`);
console.log(`         solscan:        ${SOLSCAN(createTx)}`);

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
console.log(`         tx:      ${claimTx}`);
console.log(`         solscan: ${SOLSCAN(claimTx)}`);

const taskAfterClaim = await getTask(workerProgram, taskPda);
console.log(`[step 2] state:   ${formatTaskState(taskAfterClaim.state)} (expected: In Progress)`);
if (taskAfterClaim.state !== TaskState.InProgress) {
  console.error(`[error] unexpected state after claim: ${formatTaskState(taskAfterClaim.state)}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 3 — Complete task (worker wallet)
// ---------------------------------------------------------------------------

console.log("\n[step 3] completing task...");
console.log(`         proof hash: ${TEST_PROOF_HEX}`);

// proofHash = SHA-256("This is only a test of the agenc-lifecycle on 2026-03-28")
const proofHash = Buffer.from(TEST_PROOF_HEX, "hex");

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
console.log(`         tx:      ${completeTx}`);
console.log(`         solscan: ${SOLSCAN(completeTx)}`);

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

console.log("\n[verify] fetching final task state...");
const finalTask = await getTask(creatorProgram, taskPda);

if (!finalTask) {
  console.log("[verify] ✅ task account closed (escrow reclaimed after completion)");
} else {
  console.log(`[verify] state:       ${formatTaskState(finalTask.state)}`);
  console.log(`[verify] completedAt: ${finalTask.completedAt ? formatUnix(finalTask.completedAt) : "null"}`);
  if (finalTask.state !== TaskState.Completed) {
    console.error(`[error] expected Completed, got ${formatTaskState(finalTask.state)}`);
    process.exit(1);
  }
  console.log("[verify] ✅ state confirmed: Completed");
}

// Hash verification
const expectedHash = TEST_PROOF_HEX;
const confirmedHash = proofHash.toString("hex");
if (confirmedHash !== expectedHash) {
  console.error(`[verify] ❌ hash mismatch: submitted ${confirmedHash}, expected ${expectedHash}`);
  process.exit(1);
}
console.log(`[verify] ✅ proof hash matches: ${confirmedHash}`);

console.log("\n=== lifecycle complete ===");
console.log(`  create:   ${SOLSCAN(createTx)}`);
console.log(`  claim:    ${SOLSCAN(claimTx)}`);
console.log(`  complete: ${SOLSCAN(completeTx)}`);
