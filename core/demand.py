"""Discrete demand distributions (Poisson, Negative Binomial).

Every distribution exposes the same vectorised interface so the MDP / cost
layers never depend on a concrete family:

* ``pmf(k)``, ``cdf(k)``  -- accept scalars or arrays of any shape.
* ``support(eps)``        -- ``(d, p)`` arrays: demand values 0..K and their
                             probabilities, with tail mass beyond K <= ``eps``.
* ``mean`` / ``var``.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np
from numpy.typing import ArrayLike, NDArray
from scipy import stats

FloatArray = NDArray[np.float64]


class DemandDistribution(ABC):
    """Non-negative integer-valued demand per period."""

    @property
    @abstractmethod
    def mean(self) -> float: ...

    @property
    @abstractmethod
    def var(self) -> float: ...

    @abstractmethod
    def _frozen(self):
        """Frozen ``scipy.stats`` discrete distribution."""

    def pmf(self, k: ArrayLike) -> FloatArray:
        return np.asarray(self._frozen().pmf(np.asarray(k)), dtype=np.float64)

    def cdf(self, k: ArrayLike) -> FloatArray:
        return np.asarray(self._frozen().cdf(np.asarray(k)), dtype=np.float64)

    def sf(self, k: ArrayLike) -> FloatArray:
        """P(D > k), accurate in the tail (unlike ``1 - cdf``)."""
        return np.asarray(self._frozen().sf(np.asarray(k)), dtype=np.float64)

    def upper_bound(self, eps: float = 1e-12) -> int:
        """Smallest K with P(D > K) <= eps."""
        return int(self._frozen().isf(eps))

    def support(self, eps: float = 1e-12) -> tuple[FloatArray, FloatArray]:
        """Truncated support ``d = 0..K`` and ``p(d)`` (sums to 1 - O(eps))."""
        d = np.arange(self.upper_bound(eps) + 1, dtype=np.float64)
        return d, self.pmf(d)

    def sample(self, size, rng: np.random.Generator | None = None) -> NDArray[np.int64]:
        rng = np.random.default_rng() if rng is None else rng
        return np.asarray(self._frozen().rvs(size=size, random_state=rng), dtype=np.int64)


class Poisson(DemandDistribution):
    def __init__(self, mu: float):
        if mu <= 0:
            raise ValueError("mu must be > 0")
        self.mu = float(mu)

    @property
    def mean(self) -> float:
        return self.mu

    @property
    def var(self) -> float:
        return self.mu

    def _frozen(self):
        return stats.poisson(self.mu)


class NegativeBinomial(DemandDistribution):
    """Over-dispersed demand parametrised by ``mean`` and size ``r``.

    Var = mean + mean**2 / r  (> mean); r -> inf recovers Poisson.
    scipy's (n, p) = (r, r / (r + mean)).
    """

    def __init__(self, mean: float, r: float):
        if mean <= 0 or r <= 0:
            raise ValueError("mean and r must be > 0")
        self._mean = float(mean)
        self.r = float(r)

    @classmethod
    def from_mean_var(cls, mean: float, var: float) -> NegativeBinomial:
        if var <= mean:
            raise ValueError("Negative Binomial requires var > mean")
        return cls(mean, mean**2 / (var - mean))

    @property
    def mean(self) -> float:
        return self._mean

    @property
    def var(self) -> float:
        return self._mean + self._mean**2 / self.r

    def _frozen(self):
        return stats.nbinom(self.r, self.r / (self.r + self._mean))
