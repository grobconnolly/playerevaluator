"use strict";

// ============================================================
// GEE MODEL — Refined coefficients from regression output
// Gamma distribution with log link function
// ============================================================
const MODEL = Object.freeze({
    // Dispersion parameters (recovered from probability calibration)
    phi: 2.900364615700,
    shape: 0.344784236639,

    // Thresholds for success classification
    THRESHOLD_MLB: 5000000,     // $5M career earnings
    THRESHOLD_STAR: 50000000,   // $50M career earnings

    // MOIC targets for offer table
    MOIC_TARGETS: Object.freeze([3.5, 5.0, 7.5, 10.0, 15.0, 20.0]),
    RECOMMENDED_MOIC: Object.freeze([7.5, 10.0]),

    // Stake percentages
    STAKES: Object.freeze([0.01, 0.05, 0.10]),

    // Reference categories: Position=1B, Level=0("other")
    // Position coefficients (relative to 1B)
    positionCoefficients: Object.freeze({
        '1B':  0.000000000000,
        '2B': -1.087700000000,
        '3B': -0.574255259751,
        'C':  -0.824900000000,
        'C/3B': -5.822300000000,
        'CF': -3.249600000000,
        'DH': -5.548500000000,
        'LF': -2.089300000000,
        'LHP': -1.005843585426,
        'LHP/1B': -5.937700000000,
        'OF': -0.925590968346,
        'RF': -0.810301402762,
        'RHP': -1.374355323927,
        'SS': -0.747957086460,
        'TWP': -0.230648830949,
    }),

    // Level coefficients (relative to level 0="other")
    levelCoefficients: Object.freeze({
        0:  0.000000000000,
        1: -9.326816591625,
        2: -2.543228891600,
        3: -8.803247021684,
        4: -5.892867311270,
        5: -9.288258919179,
        6: -4.362233597074,
    }),

    // Age × Level interaction coefficients
    ageLevelCoefficients: Object.freeze({
        0: 0.000000000000,
        1: 0.612107350866,
        2: 0.250292410563,
        3: 0.584733160550,
        4: 0.432376792217,
        5: 0.596340472495,
        6: 0.385746744273,
    }),

    // Continuous coefficients
    intercept: 26.242947406006,
    rankCoef: -0.012879489864,
    ageCoef: -0.479102776271,
});

// ============================================================
// GAMMA DISTRIBUTION — Pure JS implementation
// ============================================================
const GammaMath = (() => {
    // Log-gamma function using Lanczos approximation (g=7, n=9)
    const LANCZOS_COEFS = [
        0.99999999999980993,
        676.5203681218851,
        -1259.1392167224028,
        771.32342877765313,
        -176.61502916214059,
        12.507343278686905,
        -0.13857109526572012,
        9.9843695780195716e-6,
        1.5056327351493116e-7,
    ];

    function lnGamma(z) {
        if (z < 0.5) {
            return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
        }
        z -= 1;
        let x = LANCZOS_COEFS[0];
        for (let i = 1; i < 9; i++) {
            x += LANCZOS_COEFS[i] / (z + i);
        }
        const t = z + 7.5;
        return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
    }

    // Regularized lower incomplete gamma function P(a, x)
    // Uses series expansion when x < a+1, continued fraction otherwise
    function gammaPLower(a, x) {
        if (x < 0) return 0;
        if (x === 0) return 0;

        if (x < a + 1) {
            // Series expansion
            return gammaPSeries(a, x);
        } else {
            // Continued fraction for Q, then P = 1 - Q
            return 1 - gammaQCF(a, x);
        }
    }

    function gammaPSeries(a, x) {
        const MAX_ITER = 200;
        const EPS = 3e-14;

        const lnPrefix = a * Math.log(x) - x - lnGamma(a);

        let sum = 1 / a;
        let term = 1 / a;
        for (let n = 1; n < MAX_ITER; n++) {
            term *= x / (a + n);
            sum += term;
            if (Math.abs(term) < Math.abs(sum) * EPS) break;
        }
        return sum * Math.exp(lnPrefix);
    }

    function gammaQCF(a, x) {
        const MAX_ITER = 200;
        const EPS = 3e-14;
        const TINY = 1e-30;

        const lnPrefix = a * Math.log(x) - x - lnGamma(a);

        // Modified Lentz's method for continued fraction
        let f = TINY;
        let C = TINY;
        let D = 1 / (x + 1 - a);
        f = D;

        for (let n = 1; n < MAX_ITER; n++) {
            const an = n * (a - n);
            const bn = x + 2 * n + 1 - a;

            D = bn + an * D;
            if (Math.abs(D) < TINY) D = TINY;
            D = 1 / D;

            C = bn + an / C;
            if (Math.abs(C) < TINY) C = TINY;

            const delta = C * D;
            f *= delta;
            if (Math.abs(delta - 1) < EPS) break;
        }

        return f * Math.exp(lnPrefix);
    }

    // Survival function: P(X > x) where X ~ Gamma(shape=a, scale=s)
    function survivalFunction(x, a, scale) {
        if (x <= 0) return 1;
        const z = x / scale;   // Standardize
        return 1 - gammaPLower(a, z);
    }

    return { survivalFunction, lnGamma };
})();


// ============================================================
// PREDICTION ENGINE
// ============================================================
function predictCareerEarnings(rank, position, age, level) {
    let logMu = MODEL.intercept;

    // Position effect
    logMu += MODEL.positionCoefficients[position] || 0;

    // Level effect
    logMu += MODEL.levelCoefficients[level] || 0;

    // Rank (continuous)
    logMu += MODEL.rankCoef * rank;

    // Age (continuous)
    logMu += MODEL.ageCoef * age;

    // Age × Level interaction
    logMu += (MODEL.ageLevelCoefficients[level] || 0) * age;

    return Math.exp(logMu);
}

function calculateProbabilities(mu) {
    const scale = mu * MODEL.phi;

    return {
        probMLB: GammaMath.survivalFunction(MODEL.THRESHOLD_MLB, MODEL.shape, scale),
        probStar: GammaMath.survivalFunction(MODEL.THRESHOLD_STAR, MODEL.shape, scale),
    };
}

function calculateOffers(expectedOnePct) {
    return MODEL.MOIC_TARGETS.map(moic => {
        const offers = {};
        MODEL.STAKES.forEach(stake => {
            offers[stake] = (expectedOnePct * (stake / 0.01)) / moic;
        });
        return { moic, offers, recommended: MODEL.RECOMMENDED_MOIC.includes(moic) };
    });
}


// ============================================================
// FORMATTING
// ============================================================
function formatCurrency(value) {
    if (value >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
    if (value >= 1e6) return '$' + (value / 1e6).toFixed(2) + 'M';
    if (value >= 1e3) return '$' + (value / 1e3).toFixed(1) + 'K';
    return '$' + value.toFixed(0);
}

function formatCurrencyPrecise(value) {
    return '$' + Math.round(value).toLocaleString('en-US');
}

function formatPercent(value) {
    return (value * 100).toFixed(2) + '%';
}

function getLevelLabel(level) {
    const labels = {
        1: 'CPX/DSL/R', 2: 'A', 3: 'A+', 4: 'AA', 5: 'AAA', 6: 'MLB'
    };
    return labels[level] || 'Other';
}


// ============================================================
// INSIGHT GENERATION
// ============================================================
function generateInsights(rank, position, age, level, mu, probs) {
    const insights = [];

    // Age-Level interaction insight
    const ageAtLevel = getAgeLevelInsight(age, level);
    if (ageAtLevel) {
        insights.push({ type: 'info', title: 'Age–Level Assessment', text: ageAtLevel });
    }

    // Rank tier insight
    if (rank <= 10) {
        insights.push({ type: 'info', title: 'Elite Prospect', text: `Rank ${rank} places this prospect in the elite tier. Historically, top-10 prospects show the highest probability of MLB success and star-level earnings, though significant variance remains.` });
    } else if (rank <= 25) {
        insights.push({ type: 'info', title: 'Premium Prospect', text: `Rank ${rank} indicates strong consensus prospect value. Prospects ranked 11–25 have historically shown solid MLB success rates with meaningful star upside.` });
    } else if (rank <= 50) {
        insights.push({ type: 'info', title: 'Mid-Tier Prospect', text: `Rank ${rank} places this prospect in the middle tier. Expected value is moderate — investment success depends heavily on age, level, and developmental trajectory.` });
    } else if (rank <= 75) {
        insights.push({ type: 'info', title: 'Lower-Tier Prospect', text: `Rank ${rank} represents a higher-risk, lower-expected-value investment. Closer scrutiny of age and level progression is critical for valuation accuracy.` });
    } else {
        insights.push({ type: 'info', title: 'Fringe Prospect', text: `Rank ${rank} is in the lowest tier of the Top 100. Historical success rates are lower, but select prospects at this level have delivered outsized returns — due diligence on specific skills is essential.` });
    }

    // Success probability context
    if (probs.probMLB >= 0.75) {
        insights.push({ type: 'info', title: 'High MLB Probability', text: `At ${formatPercent(probs.probMLB)} projected MLB success rate, this prospect has strong expected value. Star probability of ${formatPercent(probs.probStar)} suggests meaningful upside potential.` });
    } else if (probs.probMLB < 0.50) {
        insights.push({ type: 'warning', title: 'Below-Average MLB Probability', text: `MLB success probability of ${formatPercent(probs.probMLB)} is below average for Top 100 prospects. Consider whether the age-level trajectory supports improvement, or if this represents a declining asset.` });
    }

    return insights;
}

function getAgeLevelInsight(age, level) {
    // Age expectations by level (typical age ranges)
    const typical = { 1: [17, 20], 2: [19, 22], 3: [20, 23], 4: [21, 24], 5: [22, 25], 6: [22, 26] };
    const range = typical[level];
    if (!range) return null;

    const levelLabel = getLevelLabel(level);

    if (age < range[0]) {
        return `At age ${age} in ${levelLabel}, this prospect is ahead of the typical developmental curve (ages ${range[0]}–${range[1]}). The model's Age × Level interaction rewards younger prospects at higher levels with significantly enhanced valuations.`;
    } else if (age > range[1]) {
        return `At age ${age} in ${levelLabel}, this prospect is older than typical for this level (ages ${range[0]}–${range[1]}). The model applies an "Age–Level penalty" — each year without advancement reduces projected earnings. This compounding effect is reflected in the lower valuation.`;
    } else {
        return `At age ${age} in ${levelLabel}, this prospect is within the typical developmental window (ages ${range[0]}–${range[1]}). The Age × Level interaction is neutral — no unusual age premium or penalty applies.`;
    }
}


// ============================================================
// UI RENDERING
// ============================================================
function renderResults(rank, position, age, level) {
    const mu = predictCareerEarnings(rank, position, age, level);
    const probs = calculateProbabilities(mu);
    const expectedOnePct = mu * 0.01;
    const offers = calculateOffers(expectedOnePct);
    const insights = generateInsights(rank, position, age, level, mu, probs);

    // Profile summary
    document.getElementById('results-profile').textContent =
        `${position} · Rank ${rank} · Age ${age} · ${getLevelLabel(level)}`;

    // Metric cards
    document.getElementById('metric-earnings').textContent = formatCurrency(mu);
    document.getElementById('metric-earnings-sub').textContent = formatCurrencyPrecise(mu);
    document.getElementById('metric-1pct').textContent = formatCurrency(expectedOnePct);

    document.getElementById('metric-mlb').textContent = formatPercent(probs.probMLB);
    const mlbDot = document.getElementById('mlb-dot');
    mlbDot.className = 'status-dot ' + (probs.probMLB >= 0.65 ? 'status-dot--green' : probs.probMLB >= 0.50 ? 'status-dot--amber' : 'status-dot--red');
    document.getElementById('metric-mlb-sub').textContent = probs.probMLB >= 0.65 ? 'Strong' : probs.probMLB >= 0.50 ? 'Moderate' : 'Below avg';

    document.getElementById('metric-star').textContent = formatPercent(probs.probStar);
    const starDot = document.getElementById('star-dot');
    starDot.className = 'status-dot ' + (probs.probStar >= 0.40 ? 'status-dot--green' : probs.probStar >= 0.20 ? 'status-dot--amber' : 'status-dot--red');
    document.getElementById('metric-star-sub').textContent = probs.probStar >= 0.40 ? 'High upside' : probs.probStar >= 0.20 ? 'Moderate upside' : 'Limited upside';

    // Offer table
    const tbody = document.getElementById('offer-tbody');
    tbody.innerHTML = '';
    offers.forEach(row => {
        const tr = document.createElement('tr');
        if (row.recommended) tr.classList.add('recommended');
        const moicTd = document.createElement('td');
        moicTd.textContent = row.moic.toFixed(1) + 'x MOIC';
        tr.appendChild(moicTd);

        MODEL.STAKES.forEach(stake => {
            const td = document.createElement('td');
            td.textContent = formatCurrencyPrecise(row.offers[stake]);
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    // Insights
    const container = document.getElementById('insights-container');
    container.innerHTML = '';
    insights.forEach(insight => {
        const div = document.createElement('div');
        div.className = 'insight-box' + (insight.type === 'warning' ? ' insight-box--warning' : '');
        div.innerHTML = `
            <div class="insight-box__title">${insight.title}</div>
            <div class="insight-box__text">${insight.text}</div>
        `;
        container.appendChild(div);
    });

    // Alert for edge-case positions
    const alertBanner = document.getElementById('alert-banner');
    const rarPositions = ['C/3B', 'DH', 'LHP/1B', 'LF', 'CF'];
    if (rarPositions.includes(position)) {
        alertBanner.classList.add('visible');
        document.getElementById('alert-text').textContent =
            `Position "${position}" has limited representation in the training data. Predictions for this position carry higher uncertainty. Use additional due diligence.`;
    } else {
        alertBanner.classList.remove('visible');
    }

    // Show results
    const section = document.getElementById('results-section');
    section.classList.add('visible');
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


// ============================================================
// INPUT VALIDATION & EVENT HANDLING
// ============================================================
function validateAndCalculate() {
    const rankInput = document.getElementById('input-rank');
    const ageInput = document.getElementById('input-age');

    const rank = parseInt(rankInput.value, 10);
    const position = document.getElementById('input-position').value;
    const age = parseInt(ageInput.value, 10);
    const level = parseInt(document.getElementById('input-level').value, 10);

    // Validate rank
    if (isNaN(rank) || rank < 1 || rank > 100) {
        rankInput.focus();
        rankInput.select();
        return;
    }

    // Validate age
    if (isNaN(age) || age < 16 || age > 30) {
        ageInput.focus();
        ageInput.select();
        return;
    }

    renderResults(rank, position, age, level);
}

// Button click
document.getElementById('btn-calculate').addEventListener('click', validateAndCalculate);

// Enter key on any input
document.querySelectorAll('.field__input, .field__select').forEach(el => {
    el.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            validateAndCalculate();
        }
    });
});

// Initial calculation on page load
document.addEventListener('DOMContentLoaded', () => {
    validateAndCalculate();
});
