"""StochOpt-MDP dashboard.  Run with:  streamlit run dashboard/app.py"""

from __future__ import annotations

import sys
from pathlib import Path

# make `core`, `simulation`, `api` importable when launched as a plain script
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import streamlit as st  # noqa: E402
from pydantic import ValidationError  # noqa: E402

from api.schemas import SimulateRequest  # noqa: E402
from dashboard.compute import (  # noqa: E402
    benchmark_table,
    fit_from_csv,
    fit_to_model_settings,
    mdp_trajectory,
    run_analysis,
)
from dashboard.export import (  # noqa: E402
    benchmark_csv,
    pdf_available,
    policy_report_pdf,
)
from dashboard.figures import (  # noqa: E402
    policy_figure,
    trajectory_figure,
    value_function_figure,
)

st.set_page_config(page_title="StochOpt-MDP", page_icon="📦", layout="wide")


def _apply_fit() -> None:
    """on_click callback: runs before the rerun, so widget state can still be set."""
    for key, value in fit_to_model_settings(st.session_state["fit_result"]).items():
        st.session_state[f"demand_{key}"] = value


def history_tab(tab) -> None:
    """CSV upload -> distribution fit -> one-click transfer into the model settings."""
    with tab:
        file = st.file_uploader("Günlük satış serisi (CSV)", type=["csv"], key="history_csv")
        if file is None:
            st.session_state.pop("fit_result", None)
            st.caption(
                "İlk sayısal sütun günlük satış olarak okunur; başlık satırı isteğe bağlıdır."
            )
            return
        try:
            st.session_state["fit_result"] = fit_from_csv(file.getvalue())
        except ValueError as e:
            st.session_state.pop("fit_result", None)
            st.error(str(e))
            return
        fit = st.session_state["fit_result"]
        label = {"poisson": "Poisson", "negative_binomial": "Negative Binomial"}
        st.success(f"En iyi model (AIC): {label[fit.distribution_type]}")
        st.write(
            f"n = {fit.n}, ortalama = {fit.mu:.2f}, varyans = {fit.variance:.2f}, "
            f"dağılım indeksi = {fit.dispersion_index:.2f}"
        )
        st.json({"aic": fit.aic_scores, "parameters": fit.parameters}, expanded=False)
        st.button("Model ayarlarına aktar", on_click=_apply_fit, key="apply_fit")


def sidebar_request() -> tuple[SimulateRequest | None, list[str]]:
    """Render the sidebar; return the validated request (or the validation errors)."""
    model_tab, history = st.sidebar.tabs(["Model", "Geçmiş Veri Yükle (CSV)"])
    history_tab(history)
    sb = model_tab
    sb.header("Model Parametreleri")
    kind = sb.selectbox(
        "Talep dağılımı",
        ["poisson", "negative_binomial"],
        format_func=lambda k: {"poisson": "Poisson", "negative_binomial": "Negative Binomial"}[k],
        key="demand_kind",
    )
    mu = sb.number_input("Ortalama talep μ", value=8.0, step=0.5, format="%.2f", key="demand_mu")
    var = None
    if kind == "negative_binomial":
        var = sb.number_input(
            "Varyans σ² (> μ)", value=24.0, step=1.0, format="%.2f", key="demand_var"
        )

    sb.header("Maliyetler")
    K = sb.number_input("K — Sabit sipariş maliyeti", value=30.0, step=1.0, format="%.2f")
    c = sb.number_input("c — Birim sipariş maliyeti", value=1.0, step=0.5, format="%.2f")
    h = sb.number_input("h — Elde tutma maliyeti", value=1.0, step=0.5, format="%.2f")
    p = sb.number_input("p — Kıtlık (ceza) maliyeti", value=5.0, step=0.5, format="%.2f")

    sb.header("MDP & Simülasyon")
    gamma = sb.slider("γ — İskonto faktörü", 0.50, 0.995, 0.95, step=0.005)
    B = sb.number_input("B — Maks. backlog", min_value=0, max_value=1000, value=40, step=5)
    C = sb.number_input("C — Kapasite", min_value=1, max_value=1000, value=80, step=5)
    T = sb.number_input("T — Gün sayısı", min_value=1, max_value=100_000, value=365, step=30)
    reps = sb.number_input("Replikasyon", min_value=2, max_value=100_000, value=200, step=50)
    seed = sb.number_input("Seed", min_value=0, value=42, step=1)

    try:
        req = SimulateRequest.model_validate(
            {
                "demand": {"type": kind, "mu": mu, "var": var},
                "cost": {"holding": h, "shortage": p, "unit_order": c, "setup": K},
                "bounds": {"max_backlog": B, "capacity": C, "gamma": gamma},
                "T": T,
                "replications": reps,
                "seed": seed,
            }
        )
    except ValidationError as e:
        return None, [f"{'.'.join(map(str, err['loc']))}: {err['msg']}" for err in e.errors()]
    return req, []


def show_policy_tab(a) -> None:
    sol = a.solution
    s_txt = "—" if sol.s is None else str(sol.s)
    S_txt = "—" if sol.S is None else str(sol.S)
    band = "—" if sol.s is None else str(sol.S - sol.s)
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("s (sipariş eşiği)", s_txt)
    c2.metric("S (hedef seviye)", S_txt)
    c3.metric("Sipariş bandı S − s", band)
    c4.metric("Saf (s, S) yapısı", "✅ Evet" if sol.is_s_S_optimal else "❌ Hayır")
    if not sol.converged:
        st.warning("Value iteration maksimum iterasyona ulaştı; sonuçlar yakınsamamış olabilir.")
    st.caption(f"Value iteration: {sol.iterations} iterasyon, kalan hata {sol.residual:.2e}")
    left, right = st.columns(2)
    left.plotly_chart(value_function_figure(sol), use_container_width=True)
    right.plotly_chart(policy_figure(sol), use_container_width=True)


def show_benchmark_tab(a) -> None:
    st.subheader("Politika karşılaştırması")
    st.dataframe(benchmark_table(a.reports), use_container_width=True)
    d1, d2 = st.columns(2)
    d1.download_button(
        "İndir: Benchmark CSV",
        data=benchmark_csv(a),
        file_name="benchmark.csv",
        mime="text/csv",
        use_container_width=True,
    )
    if pdf_available():
        d2.download_button(
            "İndir: Politika Raporu (PDF)",
            data=policy_report_pdf(a),
            file_name="inventory_policy_summary.pdf",
            mime="application/pdf",
            use_container_width=True,
        )
    else:
        d2.button("İndir: Politika Raporu (PDF)", disabled=True, help="reportlab gerekli")
    mdp, base = a.reports["MDP"].mean("mean_cost"), a.reports["BaseStock"].mean("mean_cost")
    eoq = a.reports["StaticEOQ"].mean("mean_cost")
    st.caption(
        f"MDP maliyet avantajı: Base-Stock'a göre %{100 * (1 - mdp / base):.1f}, "
        f"Static EOQ'ya göre %{100 * (1 - mdp / eoq):.1f}"
    )

    st.subheader("Teorik ve simüle edilen maliyet")
    cmp = a.comparison
    c1, c2, c3 = st.columns(3)
    c1.metric("Teorik V*(0)", f"{cmp['V_x0']:.2f}")
    c2.metric(
        "Simüle iskontolu maliyet",
        f"{cmp['sim_discounted']:.2f}",
        delta=f"{cmp['sim_discounted'] - cmp['V_x0']:+.2f} ({cmp['discounted_gap_in_se']:+.1f} SE)",
        delta_color="off",
    )
    c3.metric(
        "Dönemlik ort. maliyet (sim) / (1−γ)·V*(0)",
        f"{cmp['sim_avg_cost']:.3f} / {cmp['theory_avg_cost']:.3f}",
        delta=f"{100 * cmp['avg_rel_gap']:+.1f}%",
        delta_color="off",
    )
    st.caption(
        "İskontolu karşılaştırma tam bir özdeşliktir (fark ≈ 0 SE beklenir). Dönemlik ortalama "
        "karşılaştırması yaklaşıktır: simülasyon iskontosuzdur."
    )


def show_trajectory_tab(a) -> None:
    n = a.request.replications
    rep = st.number_input("Replikasyon no", min_value=0, max_value=n - 1, value=0, step=1)
    st.plotly_chart(
        trajectory_figure(mdp_trajectory(a, int(rep)), a.solution.s, a.solution.S),
        use_container_width=True,
    )
    st.caption("Üçgenler: sipariş verilen günlerde sipariş sonrası envanter pozisyonu (≈ S).")


def main() -> None:
    st.title("📦 StochOpt-MDP")
    st.caption("Stokastik envanter kontrolü için MDP tabanlı (s, S) optimizasyonu")

    req, errors = sidebar_request()
    for msg in errors:
        st.sidebar.error(msg)
    if st.sidebar.button(
        "Optimizasyonu ve Simülasyonu Çalıştır", type="primary", disabled=req is None
    ):
        with st.spinner("MDP çözülüyor ve simülasyon çalışıyor…"):
            st.session_state["analysis"] = run_analysis(req)

    tab1, tab2, tab3 = st.tabs(
        [
            "Optimal Politika & Değer Fonksiyonu",
            "Benchmark & Simülasyon Analitiği",
            "Envanter Yörüngesi",
        ]
    )
    a = st.session_state.get("analysis")
    for tab, show in (
        (tab1, show_policy_tab),
        (tab2, show_benchmark_tab),
        (tab3, show_trajectory_tab),
    ):
        with tab:
            if a is None:
                st.info("Soldan parametreleri seçip çalıştır butonuna basın.")
            else:
                show(a)


main()
