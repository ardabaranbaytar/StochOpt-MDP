import { describe, expect, it } from "vitest";
import { createFormat } from "../i18n/format";
import { CsvError, parseSalesCsv, savingsPct } from "./analysis";
import { formatApiError } from "./api";
import { DEFAULT_FORM, toOptimizeRequest, toSimulateRequest, validateForm } from "./form";
import type { PolicyMetrics } from "./types";

const m = (mean_cost: number): PolicyMetrics => ({
  mean_cost,
  cost_stderr: 0,
  csl: 0.9,
  fill_rate: 0.99,
  stockout_days_ratio: 0.1,
  mean_on_hand: 5,
});

describe("form", () => {
  it("defaults are valid", () => {
    expect(validateForm(DEFAULT_FORM)).toEqual([]);
  });

  it("flags NB variance <= mean, bad lead time and workload", () => {
    const errs = validateForm({
      ...DEFAULT_FORM,
      demandType: "negative_binomial",
      variance: 5,
      leadTime: 31,
      horizon: 100_000,
      replications: 100,
    });
    expect(errs).toEqual(expect.arrayContaining(["variance", "leadTime", "workload"]));
  });

  it("rejects NaN inputs", () => {
    expect(validateForm({ ...DEFAULT_FORM, mu: Number.NaN }).length).toBeGreaterThan(0);
  });

  it("builds API payloads (poisson omits var, NB includes it)", () => {
    expect(toOptimizeRequest(DEFAULT_FORM).demand).toEqual({ type: "poisson", mu: 8 });
    const nb = toSimulateRequest({ ...DEFAULT_FORM, demandType: "negative_binomial", leadTime: 2 });
    expect(nb.demand).toEqual({ type: "negative_binomial", mu: 8, var: 24 });
    expect(nb.bounds.lead_time).toBe(2);
    expect(nb.T).toBe(365);
    expect(Object.keys(toOptimizeRequest(DEFAULT_FORM))).not.toContain("T");
  });
});

describe("analysis", () => {
  it("computes savings vs a baseline", () => {
    expect(savingsPct(m(68), m(100))).toBeCloseTo(32);
    expect(savingsPct(m(110), m(100))).toBeCloseTo(-10);
  });

  it("formats numbers and percents for each language", () => {
    expect(createFormat("en-US").pct(0.9876)).toBe("98.8%");
    expect(createFormat("tr-TR").pct(0.9876)).toBe("%98,8");
    expect(createFormat("de-DE").pct(0.9876).replace(/\s/g, " ")).toBe("98,8 %");
    expect(createFormat("en-US").num(1234.5, 1)).toBe("1,234.5");
    expect(createFormat("tr-TR").num(1234.5, 1)).toBe("1.234,5");
    expect(createFormat("de-DE").num(1234.5, 1)).toBe("1.234,5");
  });

  it("parses CSVs with and without header / extra columns", () => {
    expect(parseSalesCsv("sales\n3\n5\n4\n")).toEqual([3, 5, 4]);
    expect(parseSalesCsv("3\n5\n4")).toEqual([3, 5, 4]);
    expect(parseSalesCsv("day,sales\r\nmon,3\r\ntue,5\r\n")).toEqual([3, 5]);
    expect(parseSalesCsv('"date";"units"\n"a";7\n"b";9')).toEqual([7, 9]);
  });

  it("rejects unusable CSVs", () => {
    expect(() => parseSalesCsv("")).toThrow(CsvError);
    expect(() => parseSalesCsv("a,b\nx,y\nz,w")).toThrow(CsvError);
    expect(() => parseSalesCsv("5")).toThrow(CsvError);
  });

  it("names the reason a CSV was rejected, so the UI can translate it", () => {
    const codeOf = (text: string) => {
      try {
        parseSalesCsv(text);
      } catch (e) {
        return e instanceof CsvError ? e.code : "other";
      }
      return "none";
    };
    expect(codeOf("")).toBe("empty");
    expect(codeOf("5")).toBe("noColumn");
  });
});

describe("api errors", () => {
  it("formats FastAPI 400 / 422 bodies", () => {
    expect(formatApiError(400, { detail: "boom" })).toBe("boom");
    expect(
      formatApiError(422, { detail: [{ loc: ["body", "bounds", "lead_time"], msg: "too big" }] }),
    ).toBe("bounds.lead_time: too big");
    expect(formatApiError(500, null)).toContain("500");
  });
});
