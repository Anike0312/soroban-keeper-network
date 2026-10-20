/**
 * Where a signing key can come from, and the rules that keep it from leaking.
 *
 * There is deliberately no `--secret-key <value>` flag: an argument lands in
 * shell history and in the process table (`ps`) for anyone on the machine.
 * The accepted sources are an environment variable, a file, or stdin.
 *
 * Nothing here ever includes the key, or any part of it, in an error message.
 */

import { readFileSync, statSync } from "node:fs";

import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { keypairSigner, type TransactionSigner } from "@soroban-keeper-network/sdk";

import { CliError, EXIT_USAGE } from "./errors.js";

export const DEFAULT_SECRET_ENV = "SKN_SECRET_KEY";

export interface KeyOptions {
  /** Name of the environment variable holding the key. */
  secretKeyEnv?: string | undefined;
  /** Path of a file holding the key. Must not be readable by group or others. */
  secretKeyFile?: string | undefined;
  /** Read the key from standard input. */
  secretKeyStdin?: boolean | undefined;
}

export interface KeyIo {
  env: Record<string, string | undefined>;
  readStdin(): Promise<string>;
  stdinIsTty: boolean;
}

export async function loadSigner(options: KeyOptions, io: KeyIo): Promise<TransactionSigner> {
  const secret = await readSecret(options, io);
  if (!StrKey.isValidEd25519SecretSeed(secret)) {
    throw new CliError(
      "The signing key is not a valid Stellar secret seed (it should start with S and be 56 characters). " +
        "The key itself is not shown.",
      EXIT_USAGE,
    );
  }
  return keypairSigner(Keypair.fromSecret(secret));
}

async function readSecret(options: KeyOptions, io: KeyIo): Promise<string> {
  const chosen = [
    options.secretKeyEnv !== undefined,
    options.secretKeyFile !== undefined,
    options.secretKeyStdin === true,
  ].filter(Boolean).length;
  if (chosen > 1) {
    throw new CliError(
      "Choose one signing-key source: --secret-key-env, --secret-key-file or --secret-key-stdin.",
      EXIT_USAGE,
    );
  }

  if (options.secretKeyStdin) {
    if (io.stdinIsTty) {
      throw new CliError(
        "--secret-key-stdin expects the key to be piped in, for example: skn ... --secret-key-stdin < keyfile",
        EXIT_USAGE,
      );
    }
    return nonEmpty((await io.readStdin()).trim(), "standard input");
  }

  if (options.secretKeyFile !== undefined) {
    return nonEmpty(readKeyFile(options.secretKeyFile), `file ${options.secretKeyFile}`);
  }

  const name = options.secretKeyEnv ?? DEFAULT_SECRET_ENV;
  const value = io.env[name]?.trim();
  if (!value) {
    throw new CliError(
      `No signing key found. Set ${name}, or use --secret-key-file <path> or --secret-key-stdin. ` +
        "Keys are never accepted as a command-line argument.",
      EXIT_USAGE,
    );
  }
  return value;
}

function readKeyFile(path: string): string {
  let mode: number;
  try {
    mode = statSync(path).mode;
  } catch {
    throw new CliError(`Cannot read the key file ${path}.`, EXIT_USAGE);
  }
  // Group/other bits on a secret are a mistake worth stopping for, like ssh
  // does with private keys. Not checked on Windows, which has no such bits.
  if (process.platform !== "win32" && (mode & 0o077) !== 0) {
    throw new CliError(
      `The key file ${path} is readable by other users. Run: chmod 600 ${path}`,
      EXIT_USAGE,
    );
  }
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    throw new CliError(`Cannot read the key file ${path}.`, EXIT_USAGE);
  }
}

function nonEmpty(value: string, where: string): string {
  if (!value) throw new CliError(`The signing key from ${where} is empty.`, EXIT_USAGE);
  return value;
}
