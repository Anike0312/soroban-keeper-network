import type { Command } from "commander";

import type { Handler, Runner } from "../types.js";

export const withdrawHandler: Handler = async (ctx) => {
  const signer = await ctx.signer();
  const keeper = signer.publicKey;
  const { registry } = ctx.chain;

  // Checked first so an empty balance never costs a simulated, let alone a
  // submitted, transaction.
  const available = await registry.keeperBalance(keeper);
  if (available === 0n) {
    ctx.out.line("Nothing to withdraw: the balance is zero.");
    ctx.out.result({ keeper, withdrawn: 0n });
    return;
  }

  // `tryWithdrawRewards` covers the balance having been drained between the
  // check above and the call.
  const withdrawn = await registry.tryWithdrawRewards({ keeper, signer });
  if (withdrawn === 0n) {
    ctx.out.line("Nothing to withdraw: the balance was emptied before the withdrawal ran.");
  } else {
    ctx.out.line(`Withdrew ${withdrawn} to ${keeper}.`);
  }
  ctx.out.result({ keeper, withdrawn });
};

export function withdrawCommand(parent: Command, run: Runner): void {
  parent
    .command("withdraw")
    .description("Withdraw the signing keeper's accrued rewards")
    .action(run(withdrawHandler));
}
