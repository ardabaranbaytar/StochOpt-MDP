import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { toPoints } from "./components/TrajectoryTab";

const metrics = (mean_cost: number, csl: number, fill: number) => ({
  mean_cost,
  cost_stderr: 0.05,
  csl,
  fill_rate: fill,
  stockout_days_ratio: 1 - csl,
  mean_on_hand: 6.5,
});

const STATES = Array.from({ length: 11 }, (_, i) => i - 5);
const OPT = {
  s: 3,
  S: 9,
  is_s_S_optimal: true,
  iterations: 42,
  residual: 1e-7,
  states: STATES,
  policy: STATES.map((x) => (x <= 3 ? 9 - x : 0)),
  values: STATES.map((x) => 100 - x),
};
const SIM = {
  mdp: metrics(10, 0.9, 0.99),
  basestock: metrics(14.7, 0.8, 0.95),
  static_eoq: metrics(13, 0.85, 0.96),
  theoretical_cost: 200,
  simulated_discounted_cost: 201,
  trajectory: {
    days: [1, 2, 3, 4],
    inventory: [4, 1, -2, 6],
    position: [9, 9, 9, 9],
    orders: [9, 0, 0, 8],
  },
};

let fetchMock: ReturnType<typeof vi.fn>;

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

beforeEach(() => {
  fetchMock = vi.fn((url: string) => {
    if (url === "/health") return json({ status: "ok" });
    if (url === "/api/v1/optimize") return json(OPT);
    if (url === "/api/v1/simulate") return json(SIM);
    return json({ detail: "not found" }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("App", () => {
  it("shows header, API status and a pre-populated sample analysis", async () => {
    render(<App />);
    expect(screen.getByText("StochOpt Enterprise")).toBeInTheDocument();
    expect(screen.getByText("v1.1.0")).toBeInTheDocument();
    expect(screen.getByText("Operations Research Suite")).toBeInTheDocument();
    expect(await screen.findByText("API online")).toBeInTheDocument();
    expect(screen.queryByText("No analysis yet")).not.toBeInTheDocument();
    const values = screen.getAllByTestId("kpi-value").map((v) => v.textContent ?? "");
    expect(values[0]).toMatch(/^−?\d+\.\d%$/);
    expect(values[1]).toMatch(/^s=-?\d+ S=\d+$/);
    expect(values[2]).toMatch(/^\d+\.\d%$/);
    expect(values[3]).toMatch(/^\d+\.\d%$/);
    expect(screen.getByText(/Sample analysis/)).toBeInTheDocument();
  });

  it("reports API offline when /health fails", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("down")));
    render(<App />);
    expect(await screen.findByText("API offline")).toBeInTheDocument();
  });

  it("runs the analysis, sends lead_time and renders KPIs + benchmark", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.clear(screen.getByLabelText(/L · lead time/));
    await user.type(screen.getByLabelText(/L · lead time/), "2");
    await user.click(screen.getByRole("button", { name: /Run Optimization & Simulation/ }));

    await waitFor(() =>
      expect(screen.getAllByTestId("kpi-value").map((v) => v.textContent)).toEqual(["32.0%", "s=3 S=9", "90.0%", "99.0%"]),
    );
    expect(screen.queryByText(/Sample analysis/)).not.toBeInTheDocument();
    expect(screen.getByText("MDP (s, S)")).toBeInTheDocument();
    expect(screen.getByText("Base-Stock")).toBeInTheDocument();
    expect(screen.getByText("Static EOQ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export CSV/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export PDF/ })).toBeInTheDocument();

    const sent = fetchMock.mock.calls.filter(([u]) => String(u).startsWith("/api/v1/"));
    expect(sent).toHaveLength(2);
    for (const [, init] of sent) {
      expect(JSON.parse((init as RequestInit).body as string).bounds.lead_time).toBe(2);
    }
  });

  it("switches between the three tabs", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /Run Optimization & Simulation/ }));
    await waitFor(() => expect(screen.queryByText(/Sample analysis/)).not.toBeInTheDocument());

    await user.click(screen.getByRole("tab", { name: /Policy Explorer/ }));
    expect(screen.getByText("V*(x) and the optimal decision rule")).toBeInTheDocument();
    expect(screen.getByText(/42 iterations/)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Monte Carlo Trajectory/ }));
    expect(screen.getByText(/Inventory trajectory · 4 days/)).toBeInTheDocument();
    expect(screen.getByText("Replenishments").nextElementSibling).toHaveTextContent("2");
  });

  it("surfaces API errors", async () => {
    fetchMock.mockImplementation((url: string) =>
      url === "/health" ? json({}) : json({ detail: "value iteration did not converge" }, 400),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /Run Optimization & Simulation/ }));
    expect(await screen.findByText(/did not converge/)).toBeInTheDocument();
  });

  it("blocks the run button on invalid input", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("radio", { name: "NegBin" }));
    const variance = screen.getByLabelText(/Variance/);
    await user.clear(variance);
    await user.type(variance, "3");
    expect(screen.getByRole("button", { name: /Run Optimization & Simulation/ })).toBeDisabled();
    expect(within(screen.getByRole("alert")).getByText(/σ² must be greater/)).toBeInTheDocument();
  });

  it("fits an uploaded CSV and applies it to the model in one click", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/v1/fit-demand")
        return json({
          distribution_type: "negative_binomial",
          mu: 12.345,
          variance: 40.5,
          aic_scores: {},
          parameters: {},
          dispersion_index: 3.28,
          overdispersion_p_value: 0,
          n: 3,
        });
      return json({ status: "ok" });
    });
    const user = userEvent.setup();
    render(<App />);
    const file = new File(["sales\n5\n20\n12\n"], "sales.csv", { type: "text/csv" });
    await user.upload(screen.getByLabelText("Upload demand CSV"), file);
    await user.click(await screen.findByRole("button", { name: /Apply to model/ }));

    await waitFor(() => expect(screen.getByRole("radio", { name: "NegBin" })).toBeChecked());
    expect(screen.getByLabelText(/Mean μ/)).toHaveValue(12.35);
    expect(screen.getByLabelText(/Variance/)).toHaveValue(40.5);
  });
});

describe("trajectory helpers", () => {
  it("marks order days with the post-order position", () => {
    const pts = toPoints(SIM.trajectory);
    expect(pts.map((p) => p.order)).toEqual([9, null, null, 9]);
  });
});
