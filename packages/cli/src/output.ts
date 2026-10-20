/**
 * Everything the CLI prints goes through here, and everything that goes
 * through here is scrubbed of anything shaped like a Stellar secret seed.
 *
 * The key loader never puts a secret in a message to begin with. This is the
 * second line of defence for the case where some library error, a pasted
 * argument or a response body carries one anyway.
 */

const SECRET_SEED = /S[A-D][A-Z2-7]{54}/g;

export function redact(text: string): string {
  return text.replace(SECRET_SEED, "[redacted secret key]");
}

export interface Sink {
  stdout(text: string): void;
  stderr(text: string): void;
}

export class Output {
  constructor(
    private readonly sink: Sink,
    readonly json: boolean,
  ) {}

  /** A human-readable line. Suppressed in `--json` mode so stdout stays parseable. */
  line(text = ""): void {
    if (!this.json) this.sink.stdout(`${redact(text)}\n`);
  }

  /** The machine-readable result. Only emitted in `--json` mode. */
  result(value: unknown): void {
    if (!this.json) return;
    const text = JSON.stringify(value, (_key, v: unknown) => (typeof v === "bigint" ? v.toString() : v), 2);
    this.sink.stdout(`${redact(text)}\n`);
  }

  /** Advice and progress. Always stderr, so it never pollutes piped output. */
  note(text: string): void {
    this.sink.stderr(`${redact(text)}\n`);
  }
}
