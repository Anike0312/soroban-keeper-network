/**
 * What a command handler gets: a registry client, a lazily loaded signer, and
 * an output sink. Handlers never touch `process` directly, which is what lets
 * the tests drive them with a fake registry and captured output.
 */

import {
  KeeperRegistryClient,
  NETWORK_PRESETS,
  isNetworkName,
  type TransactionSigner,
} from "@soroban-keeper-network/sdk";
import { StrKey, rpc } from "@stellar/stellar-sdk";

import { CliError, EXIT_USAGE } from "./errors.js";
import { loadSigner, type KeyIo, type KeyOptions } from "./keys.js";
import type { Output } from "./output.js";

/** The slice of {@link KeeperRegistryClient} the commands use. */
export type Registry = Pick<
  KeeperRegistryClient,
  | "getTask"
  | "registerTask"
  | "cancelTask"
  | "expireTask"
  | "increaseReward"
  | "extendDeadline"
  | "keeperBalance"
  | "tryWithdrawRewards"
>;

export interface Chain {
  registry: Registry;
  latestLedger(): Promise<number>;
}

export interface ConnectionConfig {
  contractId: string;
  rpcUrl: string;
  networkPassphrase: string;
}

/** Options shared by every command, as parsed from the command line. */
export interface GlobalOptions extends KeyOptions {
  network?: string | undefined;
  rpcUrl?: string | undefined;
  contractId?: string | undefined;
  json?: boolean | undefined;
}

export interface Runtime extends KeyIo {
  stdout(text: string): void;
  stderr(text: string): void;
  /** Builds the chain connection. Replaced in tests. */
  connect(config: ConnectionConfig): Chain;
}

export interface Context {
  out: Output;
  chain: Chain;
  /** Loads the signing key on first use; commands that only read never call it. */
  signer(): Promise<TransactionSigner>;
}

export function resolveConnection(options: GlobalOptions, env: Runtime["env"]): ConnectionConfig {
  const networkName = options.network ?? env.SKN_NETWORK ?? "testnet";
  if (!isNetworkName(networkName)) {
    throw new CliError(
      `Unknown network ${JSON.stringify(networkName)}. Use testnet, futurenet or mainnet.`,
      EXIT_USAGE,
    );
  }
  const preset = NETWORK_PRESETS[networkName];

  const contractId = options.contractId ?? env.SKN_CONTRACT_ID;
  if (!contractId) {
    throw new CliError(
      "No registry contract. Pass --contract-id <C...> or set SKN_CONTRACT_ID.",
      EXIT_USAGE,
    );
  }

  if (!StrKey.isValidContract(contractId)) {
    throw new CliError(`Invalid contract id ${JSON.stringify(contractId)}: expected a C... address.`, EXIT_USAGE);
  }

  return {
    contractId,
    rpcUrl: options.rpcUrl ?? env.SKN_RPC_URL ?? preset.rpcUrl,
    networkPassphrase: preset.networkPassphrase,
  };
}

export function createContext(options: GlobalOptions, rt: Runtime, out: Output): Context {
  const chain = rt.connect(resolveConnection(options, rt.env));
  let signer: Promise<TransactionSigner> | undefined;
  return {
    out,
    chain,
    signer: () => (signer ??= loadSigner(options, rt)),
  };
}

/** The production connection: the real SDK client and an RPC handle for ledger height. */
export function connectToNetwork(config: ConnectionConfig): Chain {
  const registry = new KeeperRegistryClient({
    contractId: config.contractId,
    rpcUrl: config.rpcUrl,
    networkPassphrase: config.networkPassphrase,
  });
  const server = new rpc.Server(config.rpcUrl);
  return {
    registry,
    latestLedger: async () => (await server.getLatestLedger()).sequence,
  };
}
