#!/usr/bin/env node
/**
 * devnet-task-create.mjs
 *
 * Creates a single task on the AgenC protocol (private program by default).
 * Does not claim or complete — use devnet-task-lifecycle-test.mjs for full flow.
 *
 * Usage:
 *   node scripts/devnet-task-create.mjs
 *
 * Env vars:
 *   AGENC_PROGRAM_ID, AGENC_IDL_PATH, CREATOR_AGENT_PDA,
 *   TASK_DESCRIPTION, TASK_REWARD_SOL,
 *   TASK_CONSTRAINT_HASH (optional, default: null — set to a 64-char hex string to make the task private)
 *
 * Author: J Brett (letterj) with Claude Sonnet 4.6
 * Date: 2026-04-10
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
import { getAgent, createTask } from "@tetsuo-ai/sdk";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROGRAM_ID_STR   = process.env.AGENC_PROGRAM_ID   ?? "9dMNFLWENJSQWriPt7p5XpSqakxsdmKB4Q7gJvbbznmc";
const IDL_PATH         = process.env.AGENC_IDL_PATH      ?? `${process.env.HOME}/workshop/agencproj/forks/agenc-protocol/target/idl/agenc_coordination.json`;
const CREATOR_AGENT_PDA = new PublicKey(process.env.CREATOR_AGENT_PDA ?? "8dHNT4zrJojCyzVmxPkBP4xnfmEwd6eDXYq2Lp12Z7nW");

const TASK_DESCRIPTION = process.env.TASK_DESCRIPTION ?? "Compute the SHA-256 hash of the string: This is only a test of the agenc-lifecycle on 2026-03-28";
const TASK_REWARD_SOL      = parseFloat(process.env.TASK_REWARD_SOL ?? "0.01");
const TASK_CONSTRAINT_HASH = process.env.TASK_CONSTRAINT_HASH ?? null;

const REWARD       = BigInt(Math.round(TASK_REWARD_SOL * 1_000_000_000));
const DEADLINE_ADD = Number(process.env.DEADLINE_SECS ?? "3600"); // 1 hour

const RPC_URL      = process.env.RPC_URL        ?? "https://api.devnet.solana.com";
const CREATOR_PATH = process.env.CREATOR_WALLET ?? `${process.env.HOME}/.config/solana/creator.json`;

const SOLSCAN = (sig) => `https://solscan.io/tx/${sig}?cluster=devnet`;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

console.log("=== AgenC Task Create — devnet ===\n");

const connection     = new Connection(RPC_URL, "confirmed");
const idl            = await loadIdl(IDL_PATH);
const creatorKeypair = await loadKeypair(CREATOR_PATH);
const creatorProgram = createProgram(connection, idl, creatorKeypair);

console.log(`[config] program:        ${PROGRAM_ID_STR}`);
console.log(`[config] creator wallet: ${creatorKeypair.publicKey.toBase58()}`);
console.log(`[config] creator agent:  ${CREATOR_AGENT_PDA.toBase58()}`);
console.log(`[config] reward:         ${lamportsToSol(Number(REWARD))} SOL`);

const creatorBal = BigInt(await connection.getBalance(creatorKeypair.publicKey, "confirmed"));
const creatorMin = REWARD + 20_000_000n;
if (creatorBal < creatorMin) {
  console.error(`[error] creator balance too low. Have ${lamportsToSol(Number(creatorBal))} SOL, need ${lamportsToSol(Number(creatorMin))} SOL minimum.`);
  process.exit(1);
}

const creatorAgent = await getAgent(creatorProgram, CREATOR_AGENT_PDA);
if (!creatorAgent) {
  console.error(`[error] creator agent not found at ${CREATOR_AGENT_PDA.toBase58()}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 1 — Create task
// ---------------------------------------------------------------------------

console.log("\n[step 1] creating task...");

const taskId         = crypto.randomBytes(32);
const deadline       = Math.floor(Date.now() / 1000) + DEADLINE_ADD;
const description    = fixedUtf8Bytes(TASK_DESCRIPTION, 64);
const constraintHash = TASK_CONSTRAINT_HASH ? Buffer.from(TASK_CONSTRAINT_HASH, "hex") : null;

const { taskPda, txSignature: createTx } = await createTask(
  connection,
  creatorProgram,
  creatorKeypair,
  creatorAgent.agentId,
  {
    taskId,
    requiredCapabilities: creatorAgent.capabilities,
    description,
    rewardAmount: REWARD,
    maxWorkers: 1,
    deadline,
    taskType: 0,
    constraintHash,
    minReputation: 0,
    rewardMint: null,
  },
);

console.log(`[step 1] ✅ task PDA: ${taskPda.toBase58()}`);
console.log(`         deadline:   ${formatUnix(deadline)}`);
console.log(`         tx:         ${createTx}`);
console.log(`         solscan:    ${SOLSCAN(createTx)}`);

console.log(`\n[done] view in UI: http://localhost:3100/ui/?view=marketplace`);
