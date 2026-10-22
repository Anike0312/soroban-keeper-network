# skn

`skn` is the command-line tool for the Soroban Keeper Network: deploying the
keeper registry and treasury contracts, registering tasks (single or batch),
inspecting protocol state, and running admin operations.

This package is built on [`@soroban-keeper-network/sdk`](../sdk-ts).

## Commands

- `skn --help` — list all command groups and global flags
- `skn --version` — print the CLI version and supported contract `VERSION` range
- `skn config init [--force]` — write a config file with `testnet`, `futurenet`, and `mainnet` profiles
- `skn config show` — print effective configuration and signing-key source (never the secret)
- `skn inspect [summary | version]` — read-only protocol state summary and SDK compatibility check
- `skn admin <pause|unpause|set-fee-bps|set-min-reward|set-min-stake|set-dispute-window|sweep-fees>` — admin operations with pre-flight admin verification, current/new value display, and confirmation
- `skn batch register <tasks.json|tasks.csv> [--dry-run]` — batch task registration with local pre-flight validation and automatic chunking by `max_batch_size`
- `skn deploy [registry|treasury|all]` — upload WASM, deploy, initialize, and save contract IDs to the selected profile

## Signing keys

Keys are resolved in precedence order and are never echoed to stdout, stderr, or logs:

1. `--key-file <path>` (refused on POSIX if readable by group/others)
2. `--identity <name>` (from `~/.config/stellar/identity/<name>.toml`)
3. `SKN_SECRET_KEY` environment variable

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Unexpected internal failure |
| `2` | Usage, configuration, settings, or key error |
| `3` | RPC or network error |
| `4` | Contract error |
| `5` | Not found |
