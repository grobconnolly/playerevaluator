// =============================
// MODEL CONSTANTS (V1 LOCKED)
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
// OUTCOME PROBABILITIES (2012–2013 TOP-100)
// rank_group × pos_type → bucket probabilities
// =============================
const BUCKET_ORDER = ["<$5M", "$5-25M", "$25-75M", "$75-150M", ">$150M"];

// Data-driven (as currently defined for v1). You can replace with re-computed values later.
const OUTCOME_PROBS = {
  "1-20": {
    "Hitter":  { "<$5M": 0.1333, "$5-25M": 0.0667, "$25-75M": 0.1333, "$75-150M": 0.2000, ">$150M": 0.4667 },
    "Pitcher": { "<$5M": 0.1429, "$5-25M": 0.2381, "$25-75M": 0.2381, "$75-150M": 0.2381, ">$150M": 0.1429 },
    "Catcher": { "<$5M": 0.2500, "$5-25M": 0.0000, "$25-75M": 0.7500, "$75-150M": 0.0000, ">$150M": 0.0000 }
  },
  "21-50": {
    "Hitter":  { "<$5M": 0.3462, "$5-25M": 0.1923, "$25-75M": 0.1538, "$75-150M": 0.0769, ">$150M": 0.2308 },
    "Pitcher": { "<$5M": 0.2188, "$5-25M": 0.2813, "$25-75M": 0.3750, "$75-150M": 0.0625, ">$150M": 0.0625 },
    "Catcher": { "<$5M": 0.0000, "$5-25M": 0.0000, "$25-75M": 1.0000, "$75-150M": 0.0000, ">$150M": 0.0000 }
  },
  "51-100": {
    "Hitter":  { "<$5M": 0.5854, "$5-25M": 0.0976, "$25-75M": 0.1463, "$75-150M": 0.1220, ">$150M": 0.0488 },
    "Pitcher": { "<$5M": 0.4706, "$5-25M": 0.2353, "$25-75M": 0.1765, "$75-150M": 0.0784, ">$150M": 0.0392 },
    "Catcher": { "<$5M": 0.3750, "$5-25M": 0.1250, "$25-75M": 0.5000, "$75-150M": 0.0000, ">$150M": 0.0000 }
  }
};

// Sample sizes (for transparency)
const OUTCOME_N = {
  "1-20":   { "Hitter": 15, "Pitcher": 21, "Catcher": 4 },
  "21-50":  { "Hitter": 26, "Pitcher": 32, "Catcher": 2 },
  "51-100": { "Hitter": 41, "Pitcher": 51, "Catcher": 8 }
};

// Fallback distribution if a cell is thin/missing (rank_group only)
const OUTCOME_FALLBACK = {
  "1-20":   { "<$5M": 0.15, "$5-25M": 0.15, "$25-75M": 0.25, "$75-150M": 0.20, ">$150M": 0.25 },
  "21-50":  { "<$5M": 0.27, "$5-25M": 0.23, "$25-75M": 0.33, "$75-150M": 0.05, ">$150M": 0.12 },
  "51-100": { "<$5M": 0.51, "$5-25M": 0.16, "$25-75M": 0.19, "$75-150M": 0.09, ">$150M": 0.05 }
};

// =============================
// HELPERS
// =============================
function rankGroup(rank) {
  if (rank <= 20) return "1-20";
  if (rank <= 50) return "21-50";
  return "51-100";
}

function formatMoney(num) {
  return `$${Math.round(num / 1e6)}M`;
}

function formatMoneyFull(num) {
  return "$" + Math.round(num).toLocaleString("en-US");
}

function offerPer1ForMoic(valuePer1, moic) {
  return valuePer1 / moic;
}

function posTypeFromPosition(position) {
  if (position === "RHP" || position === "LHP") return "Pitcher";
  if (position === "C") return "Catcher";
  return "Hitter";
}

function pct(x) {
  return `${Math.round(x * 100)}%`;
}

function renderOutcomeProbabilities(group, position) {
  const posType = posTypeFromPosition(position);

  const cell = (OUTCOME_PROBS[group] && OUTCOME_PROBS[group][posType]) || null;
  const probs = cell || OUTCOME_FALLBACK[group];
  const n = (OUTCOME_N[group] && OUTCOME_N[group][posType]) || null;

  const tbody = document.getElementById("probBody");
  tbody.innerHTML = "";

  for (const b of BUCKET_ORDER) {
    const p = probs[b] ?? 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="fw-semibold">${b}</td>
      <td>${pct(p)}</td>
    `;
    tbody.appendChild(tr);
  }

  const note = document.getElementById("probNote");
  if (cell && n) {
    note.innerText = `Based on 2012–2013 Top-100 comps for ${group} ${posType} (n=${n}).`;
  } else {
    note.innerText = `Based on 2012–2013 Top-100 comps for rank group ${group} (fallback).`;
  }
}

// =============================
// CORE ENGINE
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

  // Projected career earnings (nominal future $)
  const ev = projectCareerEarnings(rank, position);

  // Value of 1%
  const value1 = 0.01 * ev;

  // Top-line outputs
  document.getElementById("result").innerText = formatMoney(ev);
  document.getElementById("details").innerText =
    `Rank group: ${group} • Position: ${position} • Model v1`;

  document.getElementById("careerEarnings").innerText = formatMoneyFull(ev);
  document.getElementById("valuePer1").innerText = formatMoneyFull(value1);

  // MOIC-driven offers table
  const moics = [2, 4, 6, 8, 10];
  const moicBody = document.getElementById("moicOfferBody");
  moicBody.innerHTML = "";

  for (const m of moics) {
    const offer = offerPer1ForMoic(value1, m);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="fw-semibold">${m}×</td>
      <td>${formatMoneyFull(offer)}</td>
    `;
    moicBody.appendChild(tr);
  }

  // Outcome probabilities
  renderOutcomeProbabilities(group, position);

  // Show output
  document.getElementById("output").classList.remove("d-none");
});
