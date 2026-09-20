"""Report export: benchmark CSV and a one-page "Executive Inventory Policy Summary" PDF.

Streamlit-free so it can be unit-tested.  The PDF uses reportlab's built-in Helvetica, which has
no Turkish glyphs, so all report text is in English.
"""

from __future__ import annotations

import csv
import io
from datetime import date

from .compute import POLICY_LABELS, Analysis

CSV_HEADER = [
    "Policy",
    "Mean cost",
    "Mean cost SE",
    "Cycle service level (CSL)",
    "Fill rate",
    "Stockout day ratio",
    "Mean on-hand",
]
PDF_HEADER = ["Policy", "Mean cost", "SE", "CSL", "Fill rate", "Stockout days", "Mean on-hand"]


def input_parameters(a: Analysis) -> list[tuple[str, str]]:
    """Flat (label, value) list of every model input."""
    r = a.request
    d = r.demand
    rows = [
        ("Demand distribution", "Poisson" if d.type == "poisson" else "Negative Binomial"),
        ("Mean demand (mu)", f"{d.mu:g}"),
    ]
    if d.type == "negative_binomial":
        rows.append(("Demand variance", f"{d.var:g}"))
    rows += [
        ("Fixed order cost (K)", f"{r.cost.setup:g}"),
        ("Unit order cost (c)", f"{r.cost.unit_order:g}"),
        ("Holding cost (h)", f"{r.cost.holding:g}"),
        ("Shortage cost (p)", f"{r.cost.shortage:g}"),
        ("Discount factor (gamma)", f"{r.bounds.gamma:g}"),
        ("Lead time (L, days)", str(r.bounds.lead_time)),
        ("Max backlog (B)", str(r.bounds.max_backlog)),
        ("Capacity (C)", str(r.bounds.capacity)),
        ("Horizon (days)", str(r.T)),
        ("Replications", str(r.replications)),
        ("Seed", str(r.seed)),
    ]
    return rows


def _benchmark_rows(a: Analysis) -> list[list[float | str]]:
    return [
        [
            POLICY_LABELS.get(name, name),
            rep.mean("mean_cost"),
            rep.stderr("mean_cost"),
            rep.mean("cycle_service_level"),
            rep.mean("fill_rate"),
            rep.mean("stockout_rate"),
            rep.mean("mean_on_hand"),
        ]
        for name, rep in a.reports.items()
    ]


def benchmark_csv(a: Analysis) -> bytes:
    """UTF-8 (BOM, for Excel) CSV: input parameters, the MDP policy, then the benchmark table."""
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["# Input parameters"])
    w.writerow(["Parameter", "Value"])
    w.writerows(input_parameters(a))
    w.writerow([])
    w.writerow(["# Optimal MDP policy"])
    w.writerow(["s", "" if a.solution.s is None else a.solution.s])
    w.writerow(["S", "" if a.solution.S is None else a.solution.S])
    w.writerow([])
    w.writerow(["# Benchmark results (mean over replications)"])
    w.writerow(CSV_HEADER)
    for row in _benchmark_rows(a):
        w.writerow([row[0], *(f"{v:.6f}" for v in row[1:])])
    return buf.getvalue().encode("utf-8-sig")


def pdf_available() -> bool:
    try:
        import reportlab  # noqa: F401
    except ImportError:
        return False
    return True


def policy_report_pdf(a: Analysis) -> bytes:
    """One-page A4 "Executive Inventory Policy Summary" (requires reportlab)."""
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    except ImportError as e:  # pragma: no cover
        raise RuntimeError("PDF export requires the 'reportlab' package") from e

    styles = getSampleStyleSheet()
    sol, cmp = a.solution, a.comparison
    mdp = a.reports["MDP"].mean("mean_cost")
    base = a.reports["BaseStock"].mean("mean_cost")
    eoq = a.reports["StaticEOQ"].mean("mean_cost")

    def table(data, header=True):
        t = Table(data, hAlign="LEFT")
        style = [
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]
        if header:
            style += [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f3a5f")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ]
        t.setStyle(TableStyle(style))
        return t

    if sol.s is None:
        policy_txt = "The optimal policy never orders within the modelled state space."
    else:
        policy_txt = (
            f"When the inventory position falls to <b>s = {sol.s}</b> or below, order up to "
            f"<b>S = {sol.S}</b> (order band S - s = {sol.S - sol.s})."
        )
    if not sol.is_s_S_optimal:
        policy_txt += " Note: the computed policy is not a pure (s, S) rule."
    savings = (
        f"Simulated cost is {100 * (1 - mdp / base):.1f}% lower than Base-Stock and "
        f"{100 * (1 - mdp / eoq):.1f}% lower than Static EOQ."
    )

    bench = [PDF_HEADER]
    for row in _benchmark_rows(a):
        bench.append([row[0], *(f"{v:.3f}" for v in row[1:])])

    params = input_parameters(a)
    half = (len(params) + 1) // 2
    left, right = params[:half], params[half:]
    right += [("", "")] * (len(left) - len(right))
    param_rows = [[*lp, *rp] for lp, rp in zip(left, right, strict=True)]

    story = [
        Paragraph("Executive Inventory Policy Summary", styles["Title"]),
        Paragraph(f"StochOpt-MDP - generated {date.today().isoformat()}", styles["Normal"]),
        Spacer(1, 6 * mm),
        Paragraph("Recommended policy", styles["Heading2"]),
        Paragraph(policy_txt, styles["Normal"]),
        Spacer(1, 2 * mm),
        Paragraph(savings, styles["Normal"]),
        Spacer(1, 4 * mm),
        Paragraph("Policy benchmark (mean over replications)", styles["Heading2"]),
        table(bench),
        Spacer(1, 4 * mm),
        Paragraph("Theory vs simulation", styles["Heading2"]),
        table(
            [
                ["Theoretical V*(0)", f"{cmp['V_x0']:.2f}"],
                ["Simulated discounted cost", f"{cmp['sim_discounted']:.2f}"],
                ["Gap (standard errors)", f"{cmp['discounted_gap_in_se']:+.2f}"],
            ],
            header=False,
        ),
        Spacer(1, 4 * mm),
        Paragraph("Input parameters", styles["Heading2"]),
        table(param_rows, header=False),
    ]

    buf = io.BytesIO()
    SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title="Executive Inventory Policy Summary",
    ).build(story)
    return buf.getvalue()
