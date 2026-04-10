#!/usr/bin/env node
/**
 * devnet-cancel-open-tasks.mjs
 *
 * Queries all open tasks on the AgenC protocol owned by the creator wallet
 * and cancels each one. Tasks in any other state (InProgress, Completed,
 * Disputed, Cancelled) are skipped.
 *
 * Usage:
 *   node scripts/devnet-cancel-open-tasks.mjs --dry-run   # list only
 *   node scripts/devnet-cancel-open-tasks.mjs             # cancel all open tasks
 *
 * Env vars:
 *   AGENC_PROGRAM_ID, AGENC_IDL_PATH, CREATOR_AGENT_PDA
 *
 * Author: J Brett (letterj) with Claude Sonnet 4.6
 * Date: 2026-04-10
 */

import process from "node:process";
import { PublicKey } from "@solana/web3.js";
import { Connection } from "@solana/web3.js";
import {
  loadKeypair,
  loadIdl,
  createProgram,
  lamportsToSol,
} from "../../forks/agenc-sdk/scripts/devnet-helpers.mjs";
import {
  getTasksByCreator,
  cancelTask,
  deriveTaskPda,
  formatTaskState,
  TaskState,
} from "@tetsuo-ai/sdk";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROGRAM_ID_STR    = process.env.AGENC_PROGRAM_ID  ?? "9dMNFLWENJSQWriPt7p5XpSqakxsdmKB4Q7gJvbbznmc";
const IDL_PATH          = process.env.AGENC_IDL_PATH    ?? `${process.env.HOME}/workshop/agencproj/forks/agenc-protocol/target/idl/agenc_coordination.json`;
const CREATOR_AGENT_PDA = new PublicKey(process.env.CREATOR_AGENT_PDA ?? "8kGWdXVPkqZk36npStk5JL5CFW2YfPqWAs2SioLju4W5");

const RPC_URL      = process.env.RPC_URL        ?? "https://api.devnet.solana.com";
const CREATOR_PATH = process.env.CREATOR_WALLET ?? `${process.env.HOME}/.config/solana/id.json`;

const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

console.log("=== AgenC Cancel Open Tasks — devnet ===\n");

const connection     = new Connection(RPC_URL, "confirmed");
const idl            = await loadIdl(IDL_PATH);
const creatorKeypair = await loadKeypair(CREATOR_PATH);
const creatorProgram = createProgram(connection, idl, creatorKeypair);
const programId      = new PublicKey(PROGRAM_ID_STR);

console.log(`[config] program:        ${PROGRAM_ID_STR}`);
console.log(`[config] creator wallet: ${creatorKeypair.publicKey.toBase58()}`);
console.log(`[config] mode:           ${DRY_RUN ? "dry-run (no changes)" : "cancel"}`);

// ---------------------------------------------------------------------------
// Query tasks
// ---------------------------------------------------------------------------

console.log("\n[query] fetching tasks owned by creator wallet...");

const tasks = await getTasksByCreator(creatorProgram, creatorKeypair.publicKey);

console.log(`[query] found ${tasks.length} task(s) total`);

if (tasks.length === 0) {
  console.log("\n[done] cancelled: 0, skipped: 0, errors: 0");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Process tasks
// ---------------------------------------------------------------------------

let cancelled = 0;
let skipped   = 0;
let errors    = 0;

for (let i = 0; i < tasks.length; i++) {
  const task   = tasks[i];
  const taskPda = deriveTaskPda(creatorKeypair.publicKey, task.taskId, programId);
  const pdaStr  = taskPda.toBase58();

  // Build a short description label from the constraint hash or reward
  const descLabel = `reward:${lamportsToSol(Number(task.rewardAmount))}SOL state:${formatTaskState(task.state)}`;
  const label     = descLabel.slice(0, 40);

  // Safety check — only touch tasks owned by this exact wallet
  if (!task.creator.equals(creatorKeypair.publicKey)) {
    console.log(`[task ${i + 1}] ${pdaStr} — ${label} → skipping (creator mismatch)`);
    skipped++;
    continue;
  }

  if (task.state !== TaskState.Open) {
    console.log(`[task ${i + 1}] ${pdaStr} — ${label} → skipping (${formatTaskState(task.state)})`);
    skipped++;
    continue;
  }

  if (DRY_RUN) {
    console.log(`[task ${i + 1}] ${pdaStr} — ${label} → would cancel`);
    cancelled++;
    continue;
  }

  console.log(`[task ${i + 1}] ${pdaStr} — ${label} → cancelling...`);
  try {
    const { txSignature } = await cancelTask(connection, creatorProgram, creatorKeypair, taskPda);
    console.log(`[task ${i + 1}] ✅ cancelled — tx: ${txSignature}`);
    cancelled++;
  } catch (err) {
    console.error(`[task ${i + 1}] ❌ error: ${err.message}`);
    errors++;
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n[done] ${DRY_RUN ? "would cancel" : "cancelled"}: ${cancelled}, skipped: ${skipped}, errors: ${errors}`);

if (DRY_RUN && cancelled > 0) {
  console.log("\nRun without --dry-run to cancel these tasks.");
}
