"""Expected single-period holding / shortage cost L(y).

With order-up-to (post-order inventory position) level ``y`` and demand D:

    L(y) = h * E[(y - D)^+] + p * E[(D - y)^+]

Using the truncated pmf with cumulative sums F(k) = P(D<=k) and
M(k) = sum_{d<=k} d p(d), for integer y:

    E[(y - D)^+] = y F(y-1) - M(y-1)
    E[(D - y)^+] = E[(y - D)^+] + E[D] - y

so evaluating L on a whole grid of y costs O(K + len(y)) with no Python loops.
Negative y (backlog) is supported: both cumulative terms are 0 there.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import ArrayLike

from .demand import DemandDistribution, FloatArray


def expected_excess_and_shortage(
    y: ArrayLike, demand: DemandDistribution, eps: float = 1e-12
) -> tuple[FloatArray, FloatArray]:
    """Return ``(E[(y-D)^+], E[(D-y)^+])`` for integer-valued ``y`` (any shape)."""
    y = np.asarray(y)
    yi = np.rint(y).astype(np.int64)
    if not np.allclose(y, yi):
        raise ValueError("y must be integer-valued")

    d, p = demand.support(eps)
    F = np.cumsum(p)
    M = np.cumsum(d * p)
    mean = demand.mean

    # index k = y-1 into cumulative arrays; <0 -> 0, beyond support -> saturate
    k = np.clip(yi - 1, -1, len(d) - 1)
    Fk = np.where(k >= 0, F[np.maximum(k, 0)], 0.0)
    Mk = np.where(k >= 0, M[np.maximum(k, 0)], 0.0)
    # Beyond truncation point the tail is negligible: F -> 1, M -> mean.
    beyond = yi - 1 >= len(d)
    Fk = np.where(beyond, 1.0, Fk)
    Mk = np.where(beyond, mean, Mk)

    excess = yi * Fk - Mk
    shortage = excess + mean - yi
    # guard tiny negative round-off
    return np.maximum(excess, 0.0), np.maximum(shortage, 0.0)


def expected_cost(
    y: ArrayLike,
    demand: DemandDistribution,
    holding: float,
    shortage: float,
    eps: float = 1e-12,
    lead_time: int = 0,
) -> FloatArray:
    """L(y) = h E[(y-D)^+] + p E[(D-y)^+], vectorised over ``y``.

    With a deterministic lead time ``lead_time`` = L > 0, ``y`` is the inventory *position*
    right after ordering.  Stock ordered now arrives L periods later, so the period that its
    order decision affects ends with net inventory ``y - D_{L+1}``, where D_{L+1} is the
    (L+1)-fold convolution of one-period demand.  The returned value is then

        L~(y) = h E[(y - D_{L+1})^+] + p E[(D_{L+1} - y)^+]

    (undiscounted; the MDP solver applies the gamma**L discount).  ``lead_time=0`` gives L(y).
    """
    if holding < 0 or shortage < 0:
        raise ValueError("holding and shortage costs must be >= 0")
    if lead_time < 0:
        raise ValueError("lead_time must be >= 0")
    if lead_time > 0:
        demand = demand.convolve(lead_time + 1)
    ex, sh = expected_excess_and_shortage(y, demand, eps)
    return holding * ex + shortage * sh
