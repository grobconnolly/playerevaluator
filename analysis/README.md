# Analysis pipeline (2026-08-18)

Reproducible scripts behind the v8 engine and the fund backtest:

- `reconcile_sources.py` — diffs the two historical data exports; produced the dispute
  queue that was arbitrated against Spotrac/Baseball-Reference.
- `refit_model.py` — the v8 fit: Tweedie GLM (log link), 14 vintages (2001–2014),
  fixed 12-yr horizon in 2026$, busts included, cluster-robust by player, holdout
  validation on 2013–2014. Outputs `refit-coefficients.json`.
- `bust-logistic.json` — P(zero MLB earnings | rank) logistic used by the v8 two-part model.
- `reprice_board.py` — reprices the 2026 FanGraphs board v7 vs v8
  (see ../top-100/canonical/board-reprice-2026.csv).
- `fund_simulator_replication.py` — independent replication of the LP fund simulator
  ($300K/4%, era-adjusted, 15-yr window, fees + 20% carry). Fully-consistent-dollars
  result: 2012 vintage ranks 1–100 median ~4.8x net MOIC / ~19% net IRR / 0% losing
  sims — the reference figures for LP conversations. Requires: python3 venv with
  pandas + statsmodels (reconcile/fundsim run on stdlib only).

Data: ../top-100/canonical/ (features 2001–2017, resolved earnings, board reprice).
Note: scripts reference session scratchpad paths for intermediate JSON; adjust paths
to run outside the original session.
