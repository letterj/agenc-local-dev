#!/usr/bin/env node
/**
 * devnet-feed-post.mjs
 *
 * Task 16 — Step 1: post_to_feed
 * Runs in agenc-creator container. Posts to the agent feed on the V3 program.
 * Prints the post PDA to stdout on success.
 *
 * Usage (inside agenc-creator container):
 *   node devnet-feed-post.mjs
 *
 * Env vars (all optional):
 *   KEYPAIR_PATH  Signer keypair (default: ~/.config/solana/creator.json)
 *   RPC_URL       Devnet RPC (default: https://api.devnet.solana.com)
 *   PROGRAM_ID    Program ID (default: V3)
 */

import crypto from "node:crypto";
import fs from "node:fs";
import process from "node:process";

// ---------------------------------------------------------------------------
// Constants — direct CJS entry points known to work in the container
// ---------------------------------------------------------------------------

const MOD_BASE   = "/root/.agenc/runtime/current/node_modules";
const WEB3_CJS   = `${MOD_BASE}/@solana/web3.js/lib/index.cjs.js`;
const ANCHOR_CJS = `${MOD_BASE}/@coral-xyz/anchor/dist/cjs/index.js`;
const IDL_PATH   = `${MOD_BASE}/@tetsuo-ai/protocol/src/generated/agenc_coordination.json`;

const { Connection, PublicKey, Keypair } = await import(WEB3_CJS);
const { AnchorProvider, Program, setProvider } = await import(ANCHOR_CJS);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROGRAM_ID        = new PublicKey(process.env.PROGRAM_ID  ?? "2jdBSJ8U5ixfwgs1bRLPtRRnpZAPm8Xv1tEdu8yjHJC7");
const RPC_URL           = process.env.RPC_URL                   ?? "https://api.devnet.solana.com";
const KEYPAIR_PATH      = process.env.KEYPAIR_PATH              ?? `${process.env.HOME}/.config/solana/creator.json`;

const CREATOR_AGENT_PDA = new PublicKey("HYZyLSXTpC2g9XNAweud7XeCNAH8PfzMNAX2JKEKzbQY");
const PROTOCOL_PDA      = new PublicKey("GVJ4qEk6ZjUrXGtzh6Hb9HmytJqgHDz95991X8tdA4Kq");

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

function deriveFeedPostPda(authorAgentPda, nonce) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("post"), authorAgentPda.toBuffer(), Buffer.from(nonce)],
    PROGRAM_ID,
  )[0];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const idl        = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
idl.address      = PROGRAM_ID.toBase58(); // IDL has V2 address hardcoded; override to V3
const creatorKp  = loadKeypair(KEYPAIR_PATH);
const connection = new Connection(RPC_URL, "confirmed");
const provider   = new AnchorProvider(connection, makeWallet(creatorKp), { commitment: "confirmed" });
setProvider(provider);
const program = new Program(idl, provider);

console.log("=== Task 16 — post_to_feed (creator) ===");
console.log("program  :", PROGRAM_ID.toBase58());
console.log("signer   :", creatorKp.publicKey.toBase58());
console.log("agent PDA:", CREATOR_AGENT_PDA.toBase58());
console.log("protocol :", PROTOCOL_PDA.toBase58());
console.log();

const nonce       = crypto.randomBytes(32);
const contentHash = crypto.createHash("sha256").update("Task 16 feed test — agenc V3").digest();
// topic must be non-zero (post_to_feed.rs:71 rejects [0u8;32])
const topic       = crypto.createHash("sha256").update("task16-test").digest();
const postPda     = deriveFeedPostPda(CREATOR_AGENT_PDA, nonce);

console.log("nonce    :", Buffer.from(nonce).toString("hex").slice(0, 16) + "...");
console.log("post PDA :", postPda.toBase58());
console.log();

try {
  const sig = await program.methods
    .postToFeed(
      Array.from(contentHash),
      Array.from(nonce),
      Array.from(topic),
      null, // parent_post (Option<Pubkey>)
    )
    .accounts({
      post:           postPda,
      author:         CREATOR_AGENT_PDA,
      protocolConfig: PROTOCOL_PDA,
      authority:      creatorKp.publicKey,
      systemProgram:  PublicKey.default,
    })
    .signers([creatorKp])
    .rpc();

  console.log("tx sig   :", sig);
  console.log();
  console.log("✅ post_to_feed succeeded");
  console.log();
  console.log("POST_PDA=" + postPda.toBase58());
} catch (err) {
  console.error("❌ post_to_feed FAILED:", err.message);
  if (err.logs) console.error("logs:\n" + err.logs.slice(-8).join("\n"));
  process.exit(1);
}
