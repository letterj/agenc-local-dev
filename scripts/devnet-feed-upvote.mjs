#!/usr/bin/env node
/**
 * devnet-feed-upvote.mjs
 *
 * Task 16 — Step 2: upvote_post + verify
 * Runs in agenc-worker container. Upvotes a feed post and reads it back.
 *
 * Usage (inside agenc-worker container):
 *   node devnet-feed-upvote.mjs --post-pda <POST_PDA>
 *
 * Env vars (all optional):
 *   KEYPAIR_PATH  Signer keypair (default: ~/.config/solana/id.json)
 *   RPC_URL       Devnet RPC (default: https://api.devnet.solana.com)
 *   PROGRAM_ID    Program ID (default: V3)
 */

import fs from "node:fs";
import process from "node:process";

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const postPdaIdx = args.indexOf("--post-pda");
if (postPdaIdx === -1 || !args[postPdaIdx + 1]) {
  console.error("Usage: node devnet-feed-upvote.mjs --post-pda <POST_PDA>");
  process.exit(1);
}
const POST_PDA_STR = args[postPdaIdx + 1];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOD_BASE   = "/root/.agenc/runtime/current/node_modules";
const WEB3_CJS   = `${MOD_BASE}/@solana/web3.js/lib/index.cjs.js`;
const ANCHOR_CJS = `${MOD_BASE}/@coral-xyz/anchor/dist/cjs/index.js`;
const IDL_PATH   = `${MOD_BASE}/@tetsuo-ai/protocol/src/generated/agenc_coordination.json`;

const { Connection, PublicKey, Keypair } = await import(WEB3_CJS);
const { AnchorProvider, Program } = await import(ANCHOR_CJS);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROGRAM_ID       = new PublicKey(process.env.PROGRAM_ID ?? "2jdBSJ8U5ixfwgs1bRLPtRRnpZAPm8Xv1tEdu8yjHJC7");
const RPC_URL          = process.env.RPC_URL                  ?? "https://api.devnet.solana.com";
const KEYPAIR_PATH     = process.env.KEYPAIR_PATH             ?? `${process.env.HOME}/.config/solana/id.json`;

const WORKER_AGENT_PDA = new PublicKey("2TPP4NJ7aYJUmr51T1qf7A5rEpggGCLNwGEdy7srjFCb");
const PROTOCOL_PDA     = new PublicKey("GVJ4qEk6ZjUrXGtzh6Hb9HmytJqgHDz95991X8tdA4Kq");
const postPda          = new PublicKey(POST_PDA_STR);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadKeypair(path) {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path, "utf8"))));
}

function makeWallet(keypair) {
  return {
    publicKey: keypair.publicKey,
    signTransaction:     async (tx)  => { tx.partialSign(keypair); return tx; },
    signAllTransactions: async (txs) => { txs.forEach(tx => tx.partialSign(keypair)); return txs; },
  };
}

function deriveFeedVotePda(postPdaKey, voterAgentPda) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("upvote"), postPdaKey.toBuffer(), voterAgentPda.toBuffer()],
    PROGRAM_ID,
  )[0];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const idl       = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
idl.address     = PROGRAM_ID.toBase58(); // IDL has V2 address hardcoded; override to V3
const workerKp  = loadKeypair(KEYPAIR_PATH);
const connection = new Connection(RPC_URL, "confirmed");
const provider   = new AnchorProvider(connection, makeWallet(workerKp), { commitment: "confirmed" });
const program    = new Program(idl, provider);

console.log("=== Task 16 — upvote_post (worker) ===");
console.log("program   :", PROGRAM_ID.toBase58());
console.log("signer    :", workerKp.publicKey.toBase58());
console.log("agent PDA :", WORKER_AGENT_PDA.toBase58());
console.log("post PDA  :", postPda.toBase58());
console.log();

const votePda = deriveFeedVotePda(postPda, WORKER_AGENT_PDA);
console.log("vote PDA  :", votePda.toBase58());
console.log();

// ── upvote_post ────────────────────────────────────────────────────────────

try {
  const sig = await program.methods
    .upvotePost()
    .accounts({
      post:           postPda,
      vote:           votePda,
      voter:          WORKER_AGENT_PDA,
      protocolConfig: PROTOCOL_PDA,
      authority:      workerKp.publicKey,
      systemProgram:  PublicKey.default,
    })
    .signers([workerKp])
    .rpc();

  console.log("tx sig    :", sig);
  console.log("✅ upvote_post succeeded");
} catch (err) {
  console.error("❌ upvote_post FAILED:", err.message);
  if (err.logs) console.error("logs:\n" + err.logs.slice(-8).join("\n"));
  process.exit(1);
}

// ── Read post back on-chain ────────────────────────────────────────────────

console.log();
console.log("Waiting for confirmation...");
await new Promise(r => setTimeout(r, 4000));

try {
  const post = await program.account.feedPost.fetch(postPda);

  // Field names may be camelCase in Anchor-decoded accounts
  const upvoteCount = post.upvoteCount ?? post.upvote_count ?? "?";
  const author      = post.author?.toBase58?.()             ?? post.author ?? "?";
  const contentHash = Buffer.from(
    post.contentHash ?? post.content_hash ?? []
  ).toString("hex").slice(0, 16) + "...";

  console.log();
  console.log("=== Post on-chain ===");
  console.log("post PDA      :", postPda.toBase58());
  console.log("author        :", author);
  console.log("content_hash  :", contentHash);
  console.log("upvote_count  :", upvoteCount.toString());
  console.log();
  console.log("✅ Task 16 PASSED");
} catch (err) {
  console.error("❌ fetch post FAILED:", err.message);
  process.exit(1);
}
