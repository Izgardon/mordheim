import { payloadOf, type LogFormatter } from "./badges";

type EncampmentPayload = { encampment?: string; message?: string };

/** An encampment taken, lost, razed or given up: the server's own line ("Took Tavern from Rats"). */
const encampmentLine: LogFormatter = (log) => {
  const payload = payloadOf<EncampmentPayload>(log);
  return <span>{payload.message || payload.encampment || "An encampment changed hands"}</span>;
};

/** Who holds the campaign's encampments (William, 24 Nov 2026). */
export const ENCAMPMENT_FORMATTERS: Record<string, LogFormatter> = {
  "encampment:taken": encampmentLine,
  "encampment:lost": encampmentLine,
  "encampment:razed": encampmentLine,
  "encampment:given_up": encampmentLine,
};
