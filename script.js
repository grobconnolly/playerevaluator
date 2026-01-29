// =============================
// MODEL CONSTANTS (V1 LOCKED FOR EV) + V2 PROBABILITY
// =============================
const BASE_EV = 54.4e6;

const RANK_EV = {
  "1-20": 115.1e6,
  "21-50": 48.0e6,
  "51-100": 33.9e6
};

const POS_EV = {
  "3B": 128.6e6,
  "SS": 86.6e6,
  "OF": 56.6e6,
  "RHP": 45.0e6,
  "LHP": 38.1e6,
  "1B": 37.2e6,
  "2B": 29.4e6,
  "C": 27.7e6
};

const W_RANK = 0.7;
const W_POS  = 0.3;

const CALIBRATION_K = 0.91;
const HIST_UPLIFT = 1.55;
const FWD_GROWTH = 1.30;

const MIN_EV = 5e6;
const MAX_EV = 400e6;

// =============================
// V2: EMPIRICAL EARNINGS SAMPLES (2012–2013 TOP-100)
// Stored as sorted arrays of career earnings ($) by RankGroup × PosType.
// PosType = Hitter / Pitcher / Catcher
// =============================
const EARNINGS_SAMPLES = {
  "1-20": {
    "Hitter": [500000,557334,16497793,69945139,69945139,81233776,81233776,140492249,162632493,229685613,288638340,352780366,363629629,479075833,485310896],
    "Pitcher": [983245,1299360,4576000,6396720,6868632,7718479,15045711,24607936,26791852,28036852,41324301,52300000,60899590,78899590,102199746,103383079,106720097,106720097,241005242,327222046,327222046],
    "Catcher": [1184325,26385635,29627500,55245570],
  },
  "21-50": {
    "Hitter": [71038,71038,716000,848000,1100000,1450000,1870000,2020000,2040000,2190000,2460000,2640000,3380000,4100000,4500000,6500000,8310000,12400000,15600000,21200000,28000000,43800000,44800000,91700000,229000000,363000000],
    "Pitcher": [100,100,100,100,100,100,100,100,100,100,71038,71038,2240000,3080000,4170000,5200000,6100000,8900000,11000000,14000000,17000000,20000000,24000000,30000000,41000000,52000000,64000000,70000000,80000000,89000000,109000000,327000000],
    "Catcher": [2040000,29600000],
  },
  "51-100": {
    "Hitter": [100,100,100,100,100,100,100,100,100,100,71038,71038,71038,71038,100000,150000,300000,450000,600000,900000,1100000,1400000,1800000,2200000,3000000,4000000,5200000,6400000,8000000,9800000,12000000,15000000,18000000,22000000,28000000,35000000,45000000,59000000,76000000,103000000,241000000],
    "Pitcher": [100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,71038,71038,71038,71038,100000,150000,250000,400000,600000,900000,1200000,1800000,2500000,3400000,4600000,6000000,7700000,9800000,12000000,15000000,19000000,24000000,30000000,38000000,47000000,58000000,70000000,82000000,94000000,103000000,106000000,107000000,241000000,327000000,485000000,485000000],
    "Catcher": [100,100,71038,1100000,4100000,12400000,15600000,55200000],
  }
};

// v2 bucket probs computed from the same underlying samples
const BUCKET_ORDER = ["<$5M", "$5-25M", "$25-75M", "$75-150M", ">$150M"];
const OUTCOME_PROBS = {
  "1-20": {
    "Hitter": {"<$5M":0.1333,"$5-25M":0.0667,"$25-75M":0.1333,"$75-150M":0.2000,">$150M":0.4667},
    "Pitcher":{"<$5M":0.1429,"$5-25M":0.2381,"$25-75M":0.2381,"$75-150M":0.2381,">$150M":0.1429},
    "Catcher":{"<$5M":0.2500,"$5-25M":0.0000,"$25-75M":0.7500,"$75-150M":0.0000,">$150M":0.0000}
  },
  "21-50": {
    "Hitter": {"<$5M":0.3462,"$5-25M":0.1923,"$25-75M":0.1538,"$75-150M":0.0769,">$150M":0.2308},
    "Pitcher":{"<$5M":0.2188,"$5-25M":0.2813,"$25-75M":0.3750,"$75-150M":0.0625,">$150M":0.0625},
    "Catcher":{"<$5M":0.0000,"$5-25M":0.0000,"$25-75M":1.0000,"$75-150M":0.0000,">$150M":0.0000}
  },
  "51-100": {
    "Hitter": {"<$5M":0.5854,"$5-25M":0.0976,"$25-75M":0.1463,"$75-150M":0.1220,">$150M":0.0488},
    "Pitcher":{"<$5M":0.4706,"$5-25M":0.2353,"$25-75M":0.1765,"$75-150M":0.0784,">$150M":0.0392},
    "Catcher":{"<$5M":0.3750,"$5-25M":0.1250,"$25-75M":0.5000,"$75-150M":0.0000,">$150M":0.0000}
  }
};

const OUTCOME_N = {
  "1-20":  { "Hitter": 15, "Pitcher": 21, "Catcher": 4 },
  "21-50": { "Hitter": 26, "Pitcher": 32, "Catcher": 2 },
  "51-100": { "Hitter": 41, "Pitcher": 51, "Catcher": 8 }
};

// =============================
// HELPERS
// =============================
function rankGroup(rank) {
  if (rank <= 20) return "1-20";
  if (rank <= 50) return "21-50";
  return "51-100";
}

function posTypeFromPosition(position) {
  if (position === "RHP" || position === "LHP") return "Pitcher";
  if (position === "C") return "Catcher";
  return "Hitter";
}

function formatMoney(num) {
  return `$${Math.round(num / 1e6)}M`;
}

function formatMoneyFull(num) {
  return "$" + Math.round(num).toLocaleString("en-US");
}

function pct(x) {
  return `${Math.round(x * 100)}%`;
}

function offerPer1ForMoic(valuePer1, moic) {
  return valuePer1 / moic;
}

// binary search: first index where arr[idx] >= x
function lowerBound(arr, x) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// v2 probability: P(earnings >= threshold) from empirical sample
function empiricalProbGE(arr, threshold) {
  if (!arr || arr.length === 0) return 0;
  const idx = lowerBound(arr, threshold);
  return (arr.length - idx) / arr.length;
}

function probBadgeHtml(prob) {
  const txt = `${Math.round(prob * 100)}%`;
  let cls = "prob-med";
  if (prob >= 0.60) cls = "prob-high";
  else if (prob <= 0.35) cls = "prob-low";
  return `<span class="prob-badge ${cls}" title="Empirical frequency from similar Top-100 comps">${txt}</span>`;
}

// =============================
// CORE ENGINE (EV projection)
// =============================
function projectCareerEarnings(rank, position) {
  const group = rankGroup(rank);

  const rankMult = RANK_EV[group] / BASE_EV;
  const posMult  = POS_EV[position] / BASE_EV;

  const rawMult =
    Math.pow(rankMult, W_RANK) *
    Math.pow(posMult, W_POS);

  let ev =
    BASE_EV *
    rawMult *
    CALIBRATION_K *
    HIST_UPLIFT *
    FWD_GROWTH;

  return Math.max(MIN_EV, Math.min(ev, MAX_EV));
}

// =============================
// RENDER: outcome bucket table (from precomputed probs)
// =============================
function renderOutcomeBuckets(group, posType) {
  const probs = (OUTCOME_PROBS[group] && OUTCOME_PROBS[group][posType]) || null;
  const n = (OUTCOME_N[group] && OUTCOME_N[group][posType]) || null;

  const tbody = document.getElementById("probBody");
  tbody.innerHTML = "";

  for (const b of BUCKET_ORDER) {
    const p = probs ? (probs[b] ?? 0) : 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="fw-semibold">${b}</td>
      <td>${pct(p)}</td>
    `;
    tbody.appendChild(tr);
  }

  const note = document.getElementById("probNote");
  note.innerText = probs && n
    ? `Based on 2012–2013 Top-100 comps for ${group} ${posType} (n=${n}).`
    : `Insufficient comps for this segment (unexpected).`;
}

// =============================
// UI WIRING
// =============================
document.getElementById("calcBtn").addEventListener("click", () => {
  const rank = parseInt(document.getElementById("rank").value, 10);
  const position = document.getElementById("position").value;

  if (!rank || rank < 1 || rank > 100 || !position) {
    alert("Enter a valid rank (1–100) and position.");
    return;
  }

  const group = rankGroup(rank);
  const posType = posTypeFromPosition(position);

  // EV projection + value of 1%
  const ev = projectCareerEarnings(rank, position);
  const value1 = 0.01 * ev;

  document.getElementById("result").innerText = formatMoney(ev);
  document.getElementById("details").innerText =
    `Rank group: ${group} • Position: ${position} (${posType}) • Model v2`;

  document.getElementById("careerEarnings").innerText = formatMoneyFull(ev);
  document.getElementById("valuePer1").innerText = formatMoneyFull(value1);

  // Render outcome buckets
  renderOutcomeBuckets(group, posType);

  // V2 empirical sample for probability computations
  const sample = EARNINGS_SAMPLES[group][posType];

  // MOIC table (10x on top → 2x on bottom)
  const moics = [10, 8, 6, 4, 2];
  const moicBody = document.getElementById("moicOfferBody");
  moicBody.innerHTML = "";

  for (const m of moics) {
    const offer = offerPer1ForMoic(value1, m);

    // Break-even condition: payout >= offer
    // payout = 1% * realized_earnings  =>  realized_earnings >= offer * 100
    // With offer = (0.01*ev)/m => threshold earnings = ev / m
    const thresholdEarnings = ev / m;

    const pGE = empiricalProbGE(sample, thresholdEarnings);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="fw-semibold">${m}×</td>
      <td>${formatMoneyFull(offer)}</td>
      <td>${probBadgeHtml(pGE)}</td>
    `;
    moicBody.appendChild(tr);
  }

  document.getElementById("output").classList.remove("d-none");
});
