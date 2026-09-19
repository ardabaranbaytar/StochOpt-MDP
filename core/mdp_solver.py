"""Value iteration for the discounted (s, S) inventory MDP.

State x in [-B, C] (integers; negative = backlog).  Action: order up to
y in [x, C].  One-period cost with fixed cost K, unit cost c, expected
holding/shortage cost L(y) and discount gamma:

    T(V)(x) = min_{y >= x} { K*1[y > x] + c*(y - x) + L(y) + gamma * W(y) }
    W(y)    = E_D[ V(max(y - D, -B)) ]

W depends on y only, so each sweep is one matrix-vector product (W = P @ V)
plus a suffix-minimum over y, i.e. O(N^2) for the product and O(N) for the
optimisation instead of O(N^2) per state.  Backlog below -B is absorbed at -B.
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass

import numpy as np

from .cost import expected_cost
from .demand import DemandDistribution, FloatArray


@dataclass(frozen=True)
class MDPSolution:
    states: np.ndarray  # x = -B..C
    values: FloatArray  # V*(x)
    policy: np.ndarray  # pi*(x): optimal order quantity
    s: int | None  # highest x with pi*(x) > 0 (None if never ordering)
    S: int | None  # s + pi*(s)
    is_s_S_optimal: bool
    iterations: int
    residual: float  # last ||V_{k+1} - V_k||_inf
    converged: bool = True  # False if max_iter was hit before the stopping rule


def transition_matrix(demand: DemandDistribution, B: int, C: int) -> FloatArray:
    """P[i, j] = P(x' = x_j | post-order level y_i), with y = x = -B..C.

    x' = y - D, values below -B are absorbed at -B.  Rows sum to 1.
    """
    x = np.arange(-B, C + 1)
    P = demand.pmf(x[:, None] - x[None, :])  # pmf(y - x'); 0 where y - x' < 0
    P[:, 0] = demand.sf(x + B - 1)  # P(D >= y + B): all mass at/below -B
    return P


def _suffix_min(h: FloatArray) -> tuple[FloatArray, np.ndarray]:
    """m[i] = min_{j>=i} h[j] and the (smallest-y) argmin index."""
    rev = h[::-1]
    cm = np.minimum.accumulate(rev)
    idx = np.maximum.accumulate(np.where(rev == cm, np.arange(len(h)), 0))
    return cm[::-1], (len(h) - 1 - idx)[::-1]


def _check_s_S(states: np.ndarray, policy: np.ndarray) -> bool:
    """True iff policy is 'order up to S iff x <= s' (vacuously true if never ordering)."""
    order = policy > 0
    if not order.any():
        return True
    s_idx = np.flatnonzero(order).max()
    if not order[: s_idx + 1].all():
        return False
    targets = states[: s_idx + 1] + policy[: s_idx + 1]
    return bool((targets == targets[0]).all())


def solve_mdp(
    demand: DemandDistribution,
    holding: float,
    shortage: float,
    order_cost: float,
    fixed_cost: float,
    gamma: float,
    B: int,
    C: int,
    eps: float = 1e-8,
    max_iter: int = 100_000,
    tie_tol: float = 1e-9,
) -> MDPSolution:
    if not 0 < gamma < 1:
        raise ValueError("gamma must be in (0, 1)")
    if B < 0 or C < 1 or fixed_cost < 0 or order_cost < 0:
        raise ValueError("need B >= 0, C >= 1, K >= 0, c >= 0")

    x = np.arange(-B, C + 1)
    L = expected_cost(x, demand, holding, shortage)
    P = transition_matrix(demand, B, C)
    K, c = fixed_cost, order_cost

    def bellman(V: FloatArray):
        H = c * x + L + gamma * (P @ V)  # cost of ordering up to y (before -c*x)
        sufmin, sufarg = _suffix_min(H)
        # min over y > x (strict); x = C has no ordering option
        order_val = np.full_like(H, np.inf)
        order_val[:-1] = K + sufmin[1:]
        order_arg = np.empty_like(x)
        order_arg[:-1] = sufarg[1:]
        order_arg[-1] = len(x) - 1
        stay = H  # y = x, no fixed cost
        return -c * x + np.minimum(stay, order_val), stay, order_val, order_arg

    V = np.zeros(len(x))
    threshold = eps * (1 - gamma) / (2 * gamma)
    residual = np.inf
    it = 0
    converged = False
    while it < max_iter:
        it += 1
        V_new = bellman(V)[0]
        residual = float(np.max(np.abs(V_new - V)))
        V = V_new
        if residual < threshold:
            converged = True
            break
    if not converged:
        warnings.warn(
            f"value iteration hit max_iter={max_iter} (residual {residual:.3g})", stacklevel=2
        )

    _, stay, order_val, order_arg = bellman(V)
    orders = order_val < stay - tie_tol * (1.0 + np.abs(stay))
    policy = np.where(orders, order_arg - np.arange(len(x)), 0).astype(np.int64)

    if orders.any():
        s_idx = int(np.flatnonzero(orders).max())
        s, S = int(x[s_idx]), int(x[s_idx] + policy[s_idx])
    else:
        s = S = None

    return MDPSolution(
        states=x,
        values=V,
        policy=policy,
        s=s,
        S=S,
        is_s_S_optimal=_check_s_S(x, policy),
        iterations=it,
        residual=residual,
        converged=converged,
    )
