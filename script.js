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
  const tbody = document.getElementById("moicOfferBody");
  tbody.innerHTML = "";

  for (const m of moics) {
    const offer = offerPer1ForMoic(value1, m);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="fw-semibold">${m}×</td>
      <td>${formatMoneyFull(offer)}</td>
    `;
    tbody.appendChild(tr);
  }

  // Show output
  document.getElementById("output").classList.remove("d-none");
});
