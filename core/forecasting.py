"""Fit a Poisson or Negative Binomial demand distribution to a daily sales history.

Method:

* Poisson:  mu_hat = x_bar (MLE = MoM).
* Dispersion index D = s^2 / x_bar (s^2 with ddof=1). Under H0 (Poisson)
  (n-1) D ~ chi2(n-1), so a one-sided p-value tests for over-dispersion.
* If s^2 > x_bar and the test is significant, a Negative Binomial is fitted by the method of
  moments: r = x_bar^2 / (s^2 - x_bar), p = r / (r + x_bar)  (scipy's ``nbinom(r, p)``).
* The model with the lowest AIC = 2k - 2 ln L wins (k = 1 for Poisson, 2 for NB).
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Literal

import numpy as np
from pydantic import BaseModel, Field
from scipy import stats

OVERDISPERSION_ALPHA = 0.05


class DemandFitResult(BaseModel):
    distribution_type: Literal["poisson", "negative_binomial"]
    mu: float = Field(description="Sample mean (= fitted mean of either model).")
    variance: float = Field(description="Sample variance (ddof=1).")
    aic_scores: dict[str, float] = Field(description="AIC per fitted candidate model.")
    parameters: dict[str, float] = Field(description="Parameters of the selected model.")
    dispersion_index: float = Field(description="D = s^2 / x_bar.")
    overdispersion_p_value: float = Field(description="One-sided chi-square test, H0: Poisson.")
    n: int = Field(description="Number of observations.")


def _validate(sales_series: Sequence[int]) -> np.ndarray:
    x = np.asarray(sales_series)
    if x.ndim != 1 or x.size < 2:
        raise ValueError("sales_series must be a 1-D sequence with at least 2 observations")
    if x.dtype.kind not in "iuf":
        raise ValueError("sales_series must contain numbers")
    if not np.all(np.isfinite(x)):
        raise ValueError("sales_series must be finite")
    if np.any(x < 0):
        raise ValueError("sales_series must be non-negative")
    xi = np.rint(x).astype(np.int64)
    if not np.array_equal(x, xi):
        raise ValueError("sales_series must contain integers")
    if xi.sum() == 0:
        raise ValueError("sales_series is all zeros; cannot fit a demand distribution")
    return xi


def fit_demand_distribution(sales_series: Sequence[int]) -> DemandFitResult:
    """Fit Poisson / Negative Binomial to daily sales and select the best model by AIC."""
    x = _validate(sales_series)
    n = int(x.size)
    mean = float(x.mean())
    var = float(x.var(ddof=1))
    dispersion = var / mean

    ll_pois = float(stats.poisson.logpmf(x, mean).sum())
    aic = {"poisson": 2 * 1 - 2 * ll_pois}
    best: Literal["poisson", "negative_binomial"] = "poisson"
    params = {"mu": mean}

    p_value = float(stats.chi2.sf((n - 1) * dispersion, n - 1))
    if var > mean and p_value < OVERDISPERSION_ALPHA:
        r = mean**2 / (var - mean)
        p = r / (r + mean)
        ll_nb = float(stats.nbinom.logpmf(x, r, p).sum())
        aic["negative_binomial"] = 2 * 2 - 2 * ll_nb
        if aic["negative_binomial"] < aic["poisson"]:
            best = "negative_binomial"
            params = {"r": r, "p": p, "mu": mean}

    return DemandFitResult(
        distribution_type=best,
        mu=mean,
        variance=var,
        aic_scores=aic,
        parameters=params,
        dispersion_index=dispersion,
        overdispersion_p_value=p_value,
        n=n,
    )
