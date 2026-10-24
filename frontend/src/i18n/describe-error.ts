import { ApiError } from "@/lib/api";
import { CsvError } from "@/lib/analysis";
import type { Messages } from "./en";

/**
 * Text for an error in the current language. Errors the app raises itself carry a code and are
 * translated; the detail the server sends back (a sentence from the API) is shown as received.
 */
export function describeError(e: unknown, t: Messages): string {
  if (e instanceof ApiError && e.code) return t.errors[e.code];
  if (e instanceof CsvError) return t.csv.errors[e.code];
  return e instanceof Error ? e.message : t.errors.unexpected;
}
