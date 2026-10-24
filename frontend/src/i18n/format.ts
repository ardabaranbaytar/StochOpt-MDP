/** Locale-aware formatters. Build once per language with `createFormat` (see i18n/LocaleProvider). */
export function createFormat(tag: string) {
  const numbers = new Map<string, Intl.NumberFormat>();
  const nf = (key: string, opts: Intl.NumberFormatOptions) => {
    let f = numbers.get(key);
    if (!f) numbers.set(key, (f = new Intl.NumberFormat(tag, opts)));
    return f;
  };
  const time = new Intl.DateTimeFormat(tag, { timeStyle: "medium" });

  return {
    num: (x: number, digits = 2) =>
      nf(`n${digits}`, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x),
    /** `x` is a fraction: 0.25 gives "25.0%" in English and "%25,0" in Turkish. */
    pct: (x: number, digits = 1) =>
      nf(`p${digits}`, { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x),
    int: (x: number) => nf("int", { maximumFractionDigits: 0 }).format(x),
    time: (d: Date) => time.format(d),
  };
}

export type Formatters = ReturnType<typeof createFormat>;
