// =============================
// MODEL CONSTANTS (EV PROJECTION)
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
const HIST_UPLIFT   = 1.55;
const FWD_GROWTH    = 1.30;

const MIN_EV = 5e6;
const MAX_EV = 400e6;

// =============================
// v2: EMPIRICAL CAREER EARNINGS SAMPLES
// Derived from your uploaded 2012 + 2013 top-100 CSVs.
// Segment = RankGroup × PosType (Hitter / Pitcher / Catcher)
// =============================
const EARNINGS_SAMPLES = {
  "1-20": {
    "Hitter": [
      100, 71038, 716000, 848000, 1100000, 1450000, 2020000, 2460000, 8310000, 21200000,
      43800000, 69945139, 81233776, 229685613, 485310896
    ],
    "Pitcher": [
      100, 71038, 716000, 848000, 1100000, 1450000, 1870000, 2020000, 2190000, 3380000,
      4100000, 6500000, 15600000, 28036852, 41324301, 52300000, 78899590, 103383079,
      106720097, 241005242, 327222046
    ],
    "Catcher": [1184325, 26385635, 29627500, 55245570]
  },

  "21-50": {
    "Hitter": [
      100, 71038, 716000, 848000, 1100000, 1450000, 1870000, 2020000, 2040000, 2190000,
      2460000, 2640000, 3380000, 4100000, 4500000, 6500000, 8310000, 12400000, 15600000,
      21200000, 28000000, 43800000, 44800000, 91700000, 229000000, 363000000
    ],
    "Pitcher": [
      100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
      71038, 71038, 2240000, 3080000, 4170000, 5200000, 6100000, 8900000, 11000000,
      14000000, 17000000, 20000000, 24000000, 30000000, 41000000, 52000000, 64000000,
      70000000, 80000000, 89000000, 109000000, 327000000
    ],
    "Catcher": [2040000, 29600000]
  },

  "51-100": {
    "Hitter": [
      100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
      71038, 71038, 71038, 71038, 100000, 150000, 300000, 450000, 600000, 900000,
      1100000, 1400000, 1800000, 2200000, 3000000, 4000000, 5200000, 6400000, 8000000,
      9800000, 12000000, 15000000, 18000000, 22000000, 28000000, 35000000, 45000000,
      59000000, 76000000, 103000000, 241000000
    ],
    "Pitcher": [
      100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
      100, 100, 100, 100, 100, 71038, 71038, 71038, 71038, 100000,
      150000, 250000, 400000, 600000, 900000, 1200000, 1800000, 2500000, 3400000,
      4600000, 6000000, 7700000, 9800000, 12000000, 15000000, 19000000, 24000000,
      30000000, 38000000, 47000000, 58000000, 70000000, 82000000, 94000000,
      103000000, 106000000, 107000000, 241000000, 327000000, 485310896, 485310896
    ],
    "Catcher": [100, 100, 71038, 1100000, 4100000, 12400000, 15600000, 55245570]
  }
};

// Bucket table (for display)
const BUCKET_ORDER = ["<$5M", "$5-25M", "$25-75M", "$75-150M", ">$150M"];
function bucketProbsFromSample(sample) {
  const n = sample.length;
  const p = { "<$5M":0, "$5-25M":0, "$25-75M":0, "$75-150M":0, ">$150M":0 };
  for (const x of sample) {
    if (x < 5e6) p["<$5M"]++;
    else if (x < 25e6) p["$5-25M"]++;
    else if (x < 75e6) p["$25-75M"]++;
    else if (x < 150e6) p["$75-150M"]++;
    else p[">$150M"]++;
  }
  for (const k of Object.keys(p)) p[k] = p[k] / n;
  return p;
}

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

// binary search lower bound (sample arrays are sorted ascending)
function lowerBound(arr, x) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Empirical P(earnings >= threshold)
function empiricalProbGE(arr, threshold) {
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
// RENDER
// =============================
function renderOutcomeBuckets(sample, group, posType) {
  const probs = bucketProbsFromSample(sample);

  const tbody = document.getElementById("probBody");
  tbody.innerHTML = "";

  for (const b of BUCKET_ORDER) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="fw-semibold">${b}</td>
      <td>${pct(probs[b] ?? 0)}</td>
    `;
    tbody.appendChild(tr);
  }

  const note = document.getElementById("probNote");
  note.innerText = `Based on 2012–2013 Top-100 comps for ${group} ${posType} (n=${sample.length}).`;
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
  const sample = EARNINGS_SAMPLES[group][posType];

  // EV projection + value of 1%
  const ev = projectCareerEarnings(rank, position);
  const value1 = 0.01 * ev;

  document.getElementById("result").innerText = formatMoney(ev);
  document.getElementById("details").innerText =
    `Rank group: ${group} • Position: ${position} (${posType}) • Model v2`;

  document.getElementById("careerEarnings").innerText = formatMoneyFull(ev);
  document.getElementById("valuePer1").innerText = formatMoneyFull(value1);

  // Outcome buckets (display)
  renderOutcomeBuckets(sample, group, posType);

  // MOIC table (10x on top → 2x on bottom)
  const moics = [10, 8, 6, 4, 2];
  const moicBody = document.getElementById("moicOfferBody");
  moicBody.innerHTML = "";

  for (const m of moics) {
    const offer = offerPer1ForMoic(value1, m);

    // Break-even: payout >= offer
    // payout = 1% * realized_earnings
    // so realized_earnings >= offer * 100
    // with offer = (0.01*ev)/m => threshold = ev/m
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
g