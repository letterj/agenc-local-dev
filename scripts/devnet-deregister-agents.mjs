#!/usr/bin/env node
/**
 * devnet-deregister-agents.mjs
 *
 * Deregisters stale agent accounts from the AgenC private program.
 * If the agent has uncompleted, expired task claims, expires them first
 * so activeTasks reaches zero, which is required before deregistration.
 *
 * Stale PDAs targeted:
 *   Creator: 8kGWdXVPkqZk36npStk5JL5CFW2YfPqWAs2SioLju4W5
 *   Worker:  8FfnjVhyJdz5UNaRZhz3WfNv8uMbm2tvhgt9zs6V4FZ5
 *
 * Usage:
 *   AGENC_IDL_PATH=<path> node scripts/devnet-deregister-agents.mjs
 *
 * Env vars:
 *   AGENC_PROGRAM_ID    override program ID (default: private program)
 *   AGENC_IDL_PATH      path to agenc_coordination.json IDL (required)
 *   CREATOR_WALLET      path to creator keypair (default: ~/.config/solana/creator.json)
 *   WORKER_WALLET       path to worker keypair  (default: ~/.config/solana/worker.json)
 *
 * Author: J Brett (letterj) with Claude Sonnet 4.6
 * Date: 2026-04-10
 */

import process from "node:process";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  loadKeypair,
  loadIdl,
  createProgram,
  lamportsToSol,
} from "../../forks/agenc-sdk/scripts/devnet-helpers.mjs";
import {
  deregisterAgent,
  expireClaim,
  getAgent,
} from "@tetsuo-ai/sdk";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const IDL_PATH     = process.env.AGENC_IDL_PATH;
const RPC_URL      = process.env.RPC_URL        ?? "https://api.devnet.solana.com";
const CREATOR_PATH = process.env.CREATOR_WALLET ?? `${process.env.HOME}/.config/solana/creator.json`;
const WORKER_PATH  = process.env.WORKER_WALLET  ?? `${process.env.HOME}/.config/solana/worker.json`;

const STALE_CREATOR_PDA = new PublicKey("8kGWdXVPkqZk36npStk5JL5CFW2YfPqWAs2SioLju4W5");
const STALE_WORKER_PDA  = new PublicKey("8FfnjVhyJdz5UNaRZhz3WfNv8uMbm2tvhgt9zs6V4FZ5");

const SOLSCAN = (sig) => `https://solscan.io/tx/${sig}?cluster=devnet`;

if (!IDL_PATH) {
  console.error("[error] AGENC_IDL_PATH is required");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

console.log("=== AgenC Agent Deregistration — devnet ===\n");

const connection     = new Connection(RPC_URL, "confirmed");
const idl            = await loadIdl(IDL_PATH);
const creatorKeypair = await loadKeypair(CREATOR_PATH);
const workerKeypair  = await loadKeypair(WORKER_PATH);
const creatorProgram = createProgram(connection, idl, creatorKeypair);
const workerProgram  = createProgram(connection, idl, workerKeypair);

console.log(`[config] creator wallet: ${creatorKeypair.publicKey.toBase58()}`);
console.log(`[config] worker wallet:  ${workerKeypair.publicKey.toBase58()}`);

// ---------------------------------------------------------------------------
// Helper: expire all open, expired claims for a given agent PDA
// Returns the number of claims expired.
// ---------------------------------------------------------------------------

async function expireStaleClaimsForAgent(program, callerKeypair, agentPda, agentId) {
  const allClaims = await program.account.taskClaim.all();
  const agentPdaStr = agentPda.toBase58();
  const now = Math.floor(Date.now() / 1000);

  const stale = allClaims.filter(
    (c) => c.account.worker.toBase58() === agentPdaStr && !c.account.isCompleted,
  );

  if (stale.length === 0) {
    console.log("         no open claims found");
    return 0;
  }

  console.log(`         found ${stale.length} open claim(s) — checking expiry...`);
  let expired = 0;

  for (const c of stale) {
    const expiresAt = c.account.expiresAt?.toNumber?.() ?? 0;
    const taskPda   = c.account.task;
    const claimPda  = c.publicKey.toBase58();

    if (expiresAt === 0 || now <= expiresAt) {
      console.log(`         claim ${claimPda} — not yet expired (expires ${new Date(expiresAt * 1000).toISOString()}), skipping`);
      continue;
    }

    console.log(`         expiring claim ${claimPda}...`);
    try {
      const { txSignature } = await expireClaim(
        connection,
        program,
        callerKeypair,
        taskPda,
        agentId,
        callerKeypair.publicKey,
      );
      console.log(`         ✅ expired — tx: ${txSignature}`);
      console.log(`            url: ${SOLSCAN(txSignature)}`);
      expired++;
    } catch (e) {
      console.log(`         ❌ expire failed: ${e.message}`);
    }
  }

  return expired;
}

// ---------------------------------------------------------------------------
// Helper: deregister a single agent (fetches agentId, then calls SDK)
// ---------------------------------------------------------------------------

async function deregisterStaleAgent(label, program, callerKeypair, stalePda) {
  console.log(`\n[${label}] fetching ${stalePda.toBase58()}...`);

  const agent = await getAgent(program, stalePda);
  if (!agent) {
    console.log(`[${label}] ⚠️  account not found — already deregistered`);
    return true;
  }

  console.log(`         authority:   ${agent.authority.toBase58()}`);
  console.log(`         activeTasks: ${agent.activeTasks}`);

  if (agent.activeTasks > 0) {
    console.log(`[${label}] active tasks = ${agent.activeTasks} — expiring stale claims first...`);
    await expireStaleClaimsForAgent(program, callerKeypair, stalePda, agent.agentId);

    // Re-fetch to check activeTasks after expiry
    const refreshed = await getAgent(program, stalePda);
    if (!refreshed) {
      console.log(`[${label}] account closed unexpectedly`);
      return true;
    }
    console.log(`         activeTasks after expiry: ${refreshed.activeTasks}`);
    if (refreshed.activeTasks > 0) {
      console.log(`[${label}] ❌ still has ${refreshed.activeTasks} active task(s) — cannot deregister`);
      return false;
    }
  }

  console.log(`[${label}] deregistering...`);
  try {
    const { txSignature } = await deregisterAgent(
      connection,
      program,
      callerKeypair,
      agent.agentId,
    );
    console.log(`[${label}] ✅ deregistered — rent returned to ${callerKeypair.publicKey.toBase58()}`);
    console.log(`         tx:  ${txSignature}`);
    console.log(`         url: ${SOLSCAN(txSignature)}`);
    return true;
  } catch (e) {
    console.log(`[${label}] ❌ deregister failed: ${e.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const creatorOk = await deregisterStaleAgent(
  "step 1 — creator",
  creatorProgram,
  creatorKeypair,
  STALE_CREATOR_PDA,
);

const workerOk = await deregisterStaleAgent(
  "step 2 — worker",
  workerProgram,
  workerKeypair,
  STALE_WORKER_PDA,
);

console.log("\n=== Deregistration complete ===");
console.log(`  creator PDA: ${creatorOk ? "✅ done" : "❌ failed"}`);
console.log(`  worker  PDA: ${workerOk  ? "✅ done" : "❌ failed"}`);

if (!creatorOk || !workerOk) {
  process.exit(1);
}
