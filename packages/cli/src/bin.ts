#!/usr/bin/env node
import { runCli } from "./cli.js";
import { connectToNetwork } from "./context.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const code = await runCli(process.argv.slice(2), {
  env: process.env,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  readStdin,
  stdinIsTty: process.stdin.isTTY === true,
  connect: connectToNetwork,
});
process.exitCode = code;
