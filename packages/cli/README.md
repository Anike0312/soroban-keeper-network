# skn

Command-line tool for the Soroban Keeper Network registry. It wraps the
[TypeScript SDK](../sdk-ts), so every command is one SDK call plus a readable
result.

```sh
# build the SDK first, then the CLI
(cd ../sdk-ts && npm ci && npm run build)
npm ci && npm run build
node dist/bin.js --help      # or `npm link`, then `skn --help`
```

## Configuration

| What | Flag | Environment | Default |
| --- | --- | --- | --- |
| Registry contract | `--contract-id` | `SKN_CONTRACT_ID` | required |
| Network | `--network` | `SKN_NETWORK` | `testnet` |
| RPC endpoint | `--rpc-url` | `SKN_RPC_URL` | the network's public RPC |
| Output | `--json` | | text |

`--json` prints one JSON document to stdout. Amounts are strings, because they
can exceed what a JSON number holds. Advice and warnings go to stderr.

## Signing keys

A command that submits a transaction needs a secret seed (`S...`). Pick one source:

| Source | How |
| --- | --- |
| Environment variable | `SKN_SECRET_KEY`, or `--secret-key-env NAME` to name another variable |
| File | `--secret-key-file path`. The file must not be readable by group or others (`chmod 600`) |
| Standard input | `--secret-key-stdin`, for example `skn keeper withdraw --secret-key-stdin < keyfile` |

There is deliberately no flag that takes the key itself: command-line
arguments end up in shell history and in `ps` output. The key is never printed
or included in an error, and anything shaped like a secret seed is scrubbed
from all output as a second line of defence. Read-only commands never load a
key.

## Commands

All amounts are in the reward token's smallest unit (stroops for XLM). Times
are Unix seconds or ISO 8601, such as `2030-01-01T00:00:00Z`. Each task command
ends by printing the task's state as read back from the registry.

```sh
skn task register --type liquidation --reward 5000000 --deadline 2030-01-01T00:00:00Z \
    --ttl-ledgers 100000 --lock-ledgers 50 [--calldata 0a1b] [--verifier C...]
skn task cancel <id>
skn task expire <id>
skn task increase-reward <id> --by <amount>
skn task extend-deadline <id> --to <time>

skn keeper balance [--keeper G...]
skn keeper withdraw
```

- `task cancel` works on a pending task, or a claimed task whose lock has
  lapsed. If the lock is still live it says who holds it and when it lapses
  (the ledger, and roughly how long from now), and exits non-zero.
- `task expire` can be run by any account; the signing key only pays the fee.
- `keeper withdraw` checks the balance first. A zero balance prints
  "Nothing to withdraw" and sends no transaction.

Exit codes: `0` success, `1` the call failed or was refused, `2` bad usage or
configuration.

## Not available yet

The registry contract and SDK in this repository have no staking or
reputation entry points yet (backlog 0289-0299 and 0318-0328). Until they
exist, `keeper balance` shows the reward balance only, and there are no
`skn keeper stake`, `unbond` or `withdraw-stake` commands.
