"""Plotly figure builders for the dashboard."""

from __future__ import annotations

import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from core.mdp_solver import MDPSolution

from .compute import Trajectory

BLUE, ORANGE, GREY, RED = "#1f77b4", "#ff7f0e", "#7f7f7f", "#d62728"


def _mark_s_S(fig: go.Figure, s: int | None, S: int | None, axis: str = "x", **kw) -> None:
    """Dashed guide lines for s and S (vertical for state axes, horizontal for time series)."""
    add = fig.add_vline if axis == "x" else fig.add_hline
    if s is not None:
        add(s, line_dash="dash", line_color=RED, annotation_text=f"s = {s}", **kw)
    if S is not None:
        add(S, line_dash="dash", line_color=GREY, annotation_text=f"S = {S}", **kw)


def value_function_figure(sol: MDPSolution) -> go.Figure:
    x, V = sol.states, sol.values
    fig = make_subplots(specs=[[{"secondary_y": True}]])
    fig.add_trace(go.Scatter(x=x, y=V, name="V*(x)", line={"color": BLUE}), secondary_y=False)
    fig.add_trace(
        go.Scatter(
            x=x[:-1] + 0.5,
            y=np.diff(V),
            name="Eğim V*(x+1) − V*(x)",
            line={"color": ORANGE, "dash": "dot"},
        ),
        secondary_y=True,
    )
    _mark_s_S(fig, sol.s, sol.S, annotation_position="top")
    fig.update_xaxes(title_text="Envanter seviyesi x")
    fig.update_yaxes(title_text="V*(x)", secondary_y=False)
    fig.update_yaxes(title_text="Eğim", secondary_y=True, showgrid=False)
    fig.update_layout(title="Değer fonksiyonu V*(x)", legend={"orientation": "h", "y": -0.2})
    return fig


def policy_figure(sol: MDPSolution) -> go.Figure:
    fig = go.Figure(
        go.Scatter(
            x=sol.states,
            y=sol.policy,
            mode="lines",
            line={"shape": "hv", "color": BLUE},
            name="π*(x)",
        )
    )
    _mark_s_S(fig, sol.s, sol.S, annotation_position="top")
    fig.update_layout(
        title="Optimal sipariş miktarı π*(x)",
        xaxis_title="Envanter seviyesi x",
        yaxis_title="Sipariş miktarı",
    )
    return fig


def trajectory_figure(t: Trajectory, s: int | None, S: int | None) -> go.Figure:
    fig = go.Figure(
        go.Scatter(
            x=t.days,
            y=t.inventory,
            mode="lines+markers",
            name="Gün sonu stok",
            line={"color": BLUE},
            marker={"size": 4},
        )
    )
    ordered = t.orders > 0
    fig.add_trace(
        go.Scatter(
            x=t.days[ordered],
            y=t.post_order[ordered],
            mode="markers",
            name="Sipariş sonrası seviye",
            marker={"symbol": "triangle-up", "size": 11, "color": ORANGE},
            customdata=t.orders[ordered],
            hovertemplate="Gün %{x}<br>Sipariş: %{customdata}<br>Seviye: %{y}<extra></extra>",
        )
    )
    _mark_s_S(fig, s, S, axis="y", annotation_position="top left")
    fig.add_hline(y=0, line_color="black", line_width=1)
    fig.update_layout(
        title="Envanter yörüngesi (MDP politikası)",
        xaxis_title="Gün",
        yaxis_title="Net envanter",
        legend={"orientation": "h", "y": -0.2},
    )
    return fig
