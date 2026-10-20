import type { Context } from "../context.js";

export interface CommandInput {
  /** Positional arguments, in declaration order. */
  args: string[];
  /** Options of this command and its parents. */
  opts: Record<string, string | boolean | undefined>;
}

export type Handler = (ctx: Context, input: CommandInput) => Promise<void>;

/**
 * Turns a handler into a commander action. Supplied by `cli.ts`, which owns
 * building the context, so command files stay free of process and I/O wiring.
 */
export type Runner = (handler: Handler) => (...actionArgs: unknown[]) => Promise<void>;
