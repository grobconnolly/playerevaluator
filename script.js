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

    // Upfront-cash pricing (July 2026 methodology).
    // Offer = stake x mu x (1 - h) x DF(level, r) / M_res, each risk priced exactly once:
    //   bust risk        -> already inside mu (the Gamma mean); charged nowhere else
    //   time + systematic-> real discount rate r over the level's effective duration
    //   seller info      -> adverse-selection haircut h (screening tier)
    //   model bias/costs -> residual margin M_res (bumped at CPX where the GEE extrapolates furthest)
    PRICING: Object.freeze({
        // Earnings-weighted years from today until the money arrives, by level
        durationYears: Object.freeze({ 1: 12.7, 2: 11.2, 3: 10.2, 4: 9.2, 5: 8.2, 6: 7.2 }),
        // Spread-cash-flow convexity premium over lump-sum discounting, by real rate
        convexity: Object.freeze([[0.08, 0.020], [0.12, 0.042], [0.15, 0.063]]),
        tiers: Object.freeze([
            Object.freeze({ key: 'aggressive', label: 'Aggressive', rReal: 0.10, mRes: 1.50 }),
            Object.freeze({ key: 'base', label: 'Base', rReal: 0.12, mRes: 1.75, recommended: true }),
            Object.freeze({ key: 'conservative', label: 'Conservative', rReal: 0.15, mRes: 2.00 }),
        ]),
        cpxMresBump: 0.25,
        haircuts: Object.freeze({ screened: 0.10, base: 0.20, unscreened: 0.30 }),
    }),

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
        // C initializes to 1/TINY (a huge value) per Lentz's algorithm; initializing
        // it to TINY made the first C update explode and returned garbage survival
        // probabilities whenever x/scale exceeded a+1 (low-mu players, high thresholds).
        let f = TINY;
        let C = 1 / TINY;
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

    // Quantile function: x such that P(X <= x) = q, via bisection on the CDF
    function quantile(q, a, scale) {
        if (q <= 0) return 0;
        if (q >= 1) return Infinity;
        let lo = 0;
        let hi = a * scale;    // Start at the mean, expand until CDF(hi) >= q
        while (gammaPLower(a, hi / scale) < q) hi *= 2;
        for (let i = 0; i < 100; i++) {
            const mid = (lo + hi) / 2;
            if (gammaPLower(a, mid / scale) < q) lo = mid;
            else hi = mid;
        }
        return (lo + hi) / 2;
    }

    return { survivalFunction, quantile, lnGamma };
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

function calculateQuantiles(mu) {
    const scale = mu * MODEL.phi;
    return {
        p25: GammaMath.quantile(0.25, MODEL.shape, scale),
        median: GammaMath.quantile(0.50, MODEL.shape, scale),
        p75: GammaMath.quantile(0.75, MODEL.shape, scale),
    };
}

// Discount factor for real cash flows arriving at the level's effective duration.
// Lump-sum factor times a convexity premium (spread cash flows are worth slightly
// more than a lump at their duration), interpolated in the real rate.
function discountFactor(level, rReal) {
    const D = MODEL.PRICING.durationYears[level];
    const pts = MODEL.PRICING.convexity;
    let c;
    if (rReal <= pts[0][0]) {
        c = pts[0][1];
    } else if (rReal >= pts[pts.length - 1][0]) {
        c = pts[pts.length - 1][1];
    } else {
        for (let i = 1; i < pts.length; i++) {
            if (rReal <= pts[i][0]) {
                const r0 = pts[i - 1][0], c0 = pts[i - 1][1];
                const r1 = pts[i][0], c1 = pts[i][1];
                c = c0 + (c1 - c0) * (rReal - r0) / (r1 - r0);
                break;
            }
        }
    }
    return Math.pow(1 + rReal, -D) * (1 + c);
}

function calculateOffers(mu, level, haircut) {
    const scale = mu * MODEL.phi;
    return MODEL.PRICING.tiers.map(tier => {
        const mRes = tier.mRes + (level === 1 ? MODEL.PRICING.cpxMresBump : 0);
        const df = discountFactor(level, tier.rReal);
        // Required multiple on raw expected earnings implied by the three levers
        const mReq = mRes / ((1 - haircut) * df);
        const offers = {};
        MODEL.STAKES.forEach(stake => {
            offers[stake] = (mu * stake) / mReq;
        });
        // Payout >= offer  <=>  earnings >= mu / mReq, independent of stake size
        const probBreakEven = GammaMath.survivalFunction(mu / mReq, MODEL.shape, scale);
        return { key: tier.key, label: tier.label, rReal: tier.rReal, recommended: !!tier.recommended,
                 mRes, df, mReq, offers, probBreakEven };
    });
}

// Net per-year age effect on log(earnings) at a given level.
// Positive means the fitted model REWARDS age at that level — a likely artifact.
function netAgeEffect(level) {
    return MODEL.ageCoef + (MODEL.ageLevelCoefficients[level] || 0);
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

    // Model-artifact fence: at some levels the fitted Age × Level interaction outweighs
    // the age penalty, so the model REWARDS additional age. For an older-than-typical
    // prospect this inflates the valuation on exactly the profile that should be discounted.
    const netAge = netAgeEffect(level);
    if (netAge > 0) {
        const pctPerYear = ((Math.exp(netAge) - 1) * 100).toFixed(0);
        const typical = TYPICAL_AGE_BY_LEVEL[level];
        const isOld = typical && age > typical[1];
        insights.push({
            type: 'warning',
            title: isOld ? 'Model Artifact — Likely Overvaluation' : 'Model Artifact Caution',
            text: isOld
                ? `At ${getLevelLabel(level)}, the fitted model adds ~${pctPerYear}% predicted earnings per year of age — and this prospect is older than typical for the level. This is a statistical artifact (age–level collinearity in the training data), not a real signal: an older prospect stuck at this level should generally be valued lower, not higher. Treat this valuation as an upper bound and haircut accordingly.`
                : `At ${getLevelLabel(level)}, the fitted age effect is positive (~+${pctPerYear}% predicted earnings per year of age), likely an artifact of age–level collinearity in the training data. Age-driven differences between prospects at this level should be interpreted cautiously.`,
        });
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

// Age expectations by level (typical age ranges)
const TYPICAL_AGE_BY_LEVEL = Object.freeze({ 1: [17, 20], 2: [19, 22], 3: [20, 23], 4: [21, 24], 5: [22, 25], 6: [22, 26] });

function getAgeLevelInsight(age, level) {
    const range = TYPICAL_AGE_BY_LEVEL[level];
    if (!range) return null;

    const levelLabel = getLevelLabel(level);
    const netAge = netAgeEffect(level);
    const direction = netAge < 0
        ? `At this level the model's net age effect is negative — each additional year of age reduces projected earnings.`
        : `Note: at this level the model's fitted age effect is positive (see artifact caution below), so the usual age penalty does not apply in this valuation.`;

    if (age < range[0]) {
        return `At age ${age} in ${levelLabel}, this prospect is ahead of the typical developmental curve (ages ${range[0]}–${range[1]}). ${direction}`;
    } else if (age > range[1]) {
        return `At age ${age} in ${levelLabel}, this prospect is older than typical for this level (ages ${range[0]}–${range[1]}). ${direction}`;
    } else {
        return `At age ${age} in ${levelLabel}, this prospect is within the typical developmental window (ages ${range[0]}–${range[1]}). ${direction}`;
    }
}


// ============================================================
// UI RENDERING
// ============================================================
function renderResults(rank, position, age, level, scrollToResults = true) {
    const mu = predictCareerEarnings(rank, position, age, level);
    const probs = calculateProbabilities(mu);
    const quantiles = calculateQuantiles(mu);
    const expectedOnePct = mu * 0.01;
    const haircut = MODEL.PRICING.haircuts[screeningTier];
    const offers = calculateOffers(mu, level, haircut);
    const insights = generateInsights(rank, position, age, level, mu, probs);

    // Profile summary — include player name when inputs still match a loaded prospect
    const player = getMatchingLoadedPlayer(rank, position, age, level);
    const profileBase = `${position} · Rank ${rank} · Age ${age} · ${getLevelLabel(level)}`;
    document.getElementById('results-profile').textContent = player
        ? `${player.name} (${player.team}) · ${profileBase} · FV ${player.fv} · ETA ${player.eta}`
        : profileBase;

    // Metric cards
    document.getElementById('metric-earnings').textContent = formatCurrency(mu);
    document.getElementById('metric-earnings-sub').textContent = `Expected value · Median ${formatCurrency(quantiles.median)}`;
    document.getElementById('metric-earnings-range').textContent =
        `P25–P75: ${formatCurrency(quantiles.p25)} – ${formatCurrency(quantiles.p75)}`;
    document.getElementById('metric-1pct').textContent = formatCurrency(expectedOnePct);
    const baseTier = offers.find(o => o.recommended);
    document.getElementById('metric-1pct-sub').textContent =
        `Fair NPV ${formatCurrency(expectedOnePct * baseTier.df)} · D ${MODEL.PRICING.durationYears[level]}y @ ${(baseTier.rReal * 100).toFixed(0)}% real`;

    document.getElementById('metric-mlb').textContent = formatPercent(probs.probMLB);
    const mlbDot = document.getElementById('mlb-dot');
    mlbDot.className = 'status-dot ' + (probs.probMLB >= 0.65 ? 'status-dot--green' : probs.probMLB >= 0.50 ? 'status-dot--amber' : 'status-dot--red');
    document.getElementById('metric-mlb-sub').textContent = probs.probMLB >= 0.65 ? 'Strong' : probs.probMLB >= 0.50 ? 'Moderate' : 'Below avg';

    document.getElementById('metric-star').textContent = formatPercent(probs.probStar);
    const starDot = document.getElementById('star-dot');
    starDot.className = 'status-dot ' + (probs.probStar >= 0.40 ? 'status-dot--green' : probs.probStar >= 0.20 ? 'status-dot--amber' : 'status-dot--red');
    document.getElementById('metric-star-sub').textContent = probs.probStar >= 0.40 ? 'High upside' : probs.probStar >= 0.20 ? 'Moderate upside' : 'Limited upside';

    // Pricing waterfall (base tier, current screening haircut)
    document.getElementById('pricing-waterfall').textContent =
        `1% EV ${formatCurrency(expectedOnePct)} → × ${baseTier.df.toFixed(3)} time ` +
        `(D ${MODEL.PRICING.durationYears[level]}y @ ${(baseTier.rReal * 100).toFixed(0)}% real) ` +
        `→ × ${(1 - haircut).toFixed(2)} screening → ÷ ${baseTier.mRes.toFixed(2)} margin ` +
        `= ${formatCurrency(baseTier.offers[0.01])} base target (${baseTier.mReq.toFixed(1)}× EV)`;

    // Offer table
    const tbody = document.getElementById('offer-tbody');
    tbody.innerHTML = '';
    offers.forEach(row => {
        const tr = document.createElement('tr');
        if (row.recommended) tr.classList.add('recommended');
        const tierTd = document.createElement('td');
        tierTd.textContent = `${row.label} — ${row.mReq.toFixed(1)}× EV`;
        tr.appendChild(tierTd);

        MODEL.STAKES.forEach(stake => {
            const td = document.createElement('td');
            td.textContent = formatCurrencyPrecise(row.offers[stake]);
            tr.appendChild(td);
        });

        const probTd = document.createElement('td');
        probTd.textContent = formatPercent(row.probBreakEven);
        probTd.className = 'offer-table__prob ' +
            (row.probBreakEven >= 0.65 ? 'prob--green' : row.probBreakEven >= 0.50 ? 'prob--amber' : 'prob--red');
        tr.appendChild(probTd);

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
    // Positions with sparse training data (must be a subset of the position dropdown)
    const rarPositions = ['CF', 'DH', 'LF'];
    if (rarPositions.includes(position)) {
        alertBanner.classList.add('visible');
        document.getElementById('alert-text').textContent =
            `Position "${position}" has limited representation in the training data. Predictions for this position carry higher uncertainty. Use additional due diligence.`;
    } else {
        alertBanner.classList.remove('visible');
    }

    // Offer sandbox — recompute against the new player profile
    sandboxState = { mu, level };
    updateSandbox();

    // Show results
    const section = document.getElementById('results-section');
    section.classList.add('visible');
    if (scrollToResults) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}


// ============================================================
// PROSPECT LOOKUP (FanGraphs Top 100)
// ============================================================
let loadedPlayer = null;

function getMatchingLoadedPlayer(rank, position, age, level) {
    if (!loadedPlayer) return null;
    const p = loadedPlayer;
    return (p.rank === rank && p.pos === position && p.age === age && p.level === level) ? p : null;
}

const Lookup = (() => {
    const input = document.getElementById('input-player');
    const list = document.getElementById('lookup-list');
    let matches = [];
    let activeIndex = -1;

    const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    function search(query) {
        const q = normalize(query.trim());
        if (!q) return [];
        return TOP100.filter(p =>
            normalize(p.name).includes(q) || normalize(p.team) === q
        ).slice(0, 8);
    }

    function render() {
        list.innerHTML = '';
        matches.forEach((p, i) => {
            const li = document.createElement('li');
            li.className = 'lookup__item' + (i === activeIndex ? ' lookup__item--active' : '');
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');
            li.id = `lookup-option-${i}`;

            const rankSpan = document.createElement('span');
            rankSpan.className = 'lookup__rank';
            rankSpan.textContent = `#${p.rank}`;
            const nameSpan = document.createElement('span');
            nameSpan.className = 'lookup__name';
            nameSpan.textContent = p.name;
            const metaSpan = document.createElement('span');
            metaSpan.className = 'lookup__meta';
            metaSpan.textContent = `${p.pos} · ${p.team} · ${getLevelLabel(p.level)} · Age ${p.age}`;

            li.append(rankSpan, nameSpan, metaSpan);
            li.addEventListener('mousedown', e => {
                e.preventDefault();   // Keep focus so blur doesn't close the list before select
                select(p);
            });
            list.appendChild(li);
        });
        const open = matches.length > 0;
        list.classList.toggle('visible', open);
        input.setAttribute('aria-expanded', String(open));
    }

    function close() {
        matches = [];
        activeIndex = -1;
        render();
    }

    function select(p) {
        loadedPlayer = p;
        input.value = `${p.name} (${p.team})`;
        document.getElementById('input-rank').value = p.rank;
        document.getElementById('input-position').value = p.pos;
        document.getElementById('input-age').value = p.age;
        document.getElementById('input-level').value = p.level;
        close();
        validateAndCalculate();
    }

    input.addEventListener('input', () => {
        loadedPlayer = null;
        matches = search(input.value);
        activeIndex = matches.length ? 0 : -1;
        render();
    });

    input.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (!matches.length) return;
            e.preventDefault();
            const dir = e.key === 'ArrowDown' ? 1 : -1;
            activeIndex = (activeIndex + dir + matches.length) % matches.length;
            render();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex >= 0 && matches[activeIndex]) select(matches[activeIndex]);
            else validateAndCalculate();
        } else if (e.key === 'Escape') {
            close();
        }
    });

    input.addEventListener('blur', close);

    return { close };
})();


// ============================================================
// SCREENING TIER (adverse-selection haircut)
// ============================================================
let screeningTier = 'base';

document.querySelectorAll('.screen-toggle__btn').forEach(btn => {
    btn.addEventListener('click', () => {
        screeningTier = btn.dataset.haircut;
        document.querySelectorAll('.screen-toggle__btn').forEach(b =>
            b.classList.toggle('screen-toggle__btn--active', b === btn));
        validateAndCalculate(false);
    });
});


// ============================================================
// OFFER SANDBOX — custom deal structuring
// ============================================================
let sandboxState = null;   // { mu, level } from the last render

const Sandbox = (() => {
    const offerEl = document.getElementById('sandbox-offer');
    const stakeEl = document.getElementById('sandbox-stake');

    function tierQuote(mu, level, haircut, stake) {
        // Same math as calculateOffers, for an arbitrary stake
        return calculateOffers(mu, level, haircut).map(t => ({
            key: t.key, label: t.label, quote: (mu * stake) / t.mReq, df: t.df, mReq: t.mReq,
            recommended: t.recommended,
        }));
    }

    function update() {
        if (!sandboxState) return;
        const { mu, level } = sandboxState;
        const offer = parseInt(offerEl.value, 10);
        const stake = parseFloat(stakeEl.value) / 100;
        const haircut = MODEL.PRICING.haircuts[screeningTier];
        const scale = mu * MODEL.phi;
        const D = MODEL.PRICING.durationYears[level];

        document.getElementById('sandbox-offer-value').textContent = formatCurrencyPrecise(offer);
        document.getElementById('sandbox-stake-value').textContent = (stake * 100).toFixed(1) + '%';

        // Price per 1% vs the base-tier model quote
        const perPct = offer / (stake * 100);
        const quotes = tierQuote(mu, level, haircut, stake);
        const base = quotes.find(q => q.recommended);
        const cons = quotes.find(q => q.key === 'conservative');
        const agg = quotes.find(q => q.key === 'aggressive');
        const vsBase = (perPct / (base.quote / (stake * 100)) - 1) * 100;
        document.getElementById('sandbox-per-pct').textContent = formatCurrencyPrecise(perPct);
        document.getElementById('sandbox-per-pct-sub').textContent =
            `Model base quote ${formatCurrencyPrecise(base.quote / (stake * 100))} · ` +
            (vsBase >= 0 ? `${vsBase.toFixed(0)}% above` : `${(-vsBase).toFixed(0)}% below`);

        // Expected multiple (undiscounted) and its IRR over the level duration
        const expMult = (mu * stake) / offer;
        const multEl = document.getElementById('sandbox-multiple');
        multEl.textContent = expMult.toFixed(2) + 'x';
        multEl.className = 'sandbox__stat-value ' + (expMult >= base.mReq ? 'stat--green' : expMult >= agg.mReq ? 'stat--amber' : 'stat--red');
        const impliedIrr = (Math.pow(expMult, 1 / D) - 1) * 100;
        document.getElementById('sandbox-multiple-sub').textContent =
            `~${impliedIrr.toFixed(1)}% real IRR over ${D}y if earnings hit the mean`;

        // NPV multiple at the base tier's discounting
        const npvMult = expMult * base.df;
        const npvEl = document.getElementById('sandbox-npv');
        npvEl.textContent = npvMult.toFixed(2) + 'x';
        npvEl.className = 'sandbox__stat-value ' + (npvMult >= 1.75 ? 'stat--green' : npvMult >= 1 ? 'stat--amber' : 'stat--red');
        document.getElementById('sandbox-npv-sub').textContent =
            `PV of expected payout ÷ cash out · DF ${base.df.toFixed(3)} @ 12% real`;

        // Break-even career earnings and its probability
        const breakEven = offer / stake;
        document.getElementById('sandbox-breakeven').textContent = formatCurrency(breakEven);
        document.getElementById('sandbox-breakeven-sub').textContent =
            `Career earnings where payout = ${formatCurrencyPrecise(offer)}`;
        const pPayback = GammaMath.survivalFunction(breakEven, MODEL.shape, scale);
        const payEl = document.getElementById('sandbox-payback');
        payEl.textContent = formatPercent(pPayback);
        payEl.className = 'sandbox__stat-value ' + (pPayback >= 0.60 ? 'stat--green' : pPayback >= 0.45 ? 'stat--amber' : 'stat--red');
        // NPV break-even: payout arrives at duration D, so PV covers the offer only if
        // earnings reach breakEven / DF — a materially higher bar than cash-on-cash.
        const pNpvBreakEven = GammaMath.survivalFunction(breakEven / base.df, MODEL.shape, scale);
        document.getElementById('sandbox-payback-sub').textContent =
            `P(NPV ≥ 0 @ 12% real): ${formatPercent(pNpvBreakEven)} — the discounted bar`;

        // Payout quantiles on this stake
        const q25 = GammaMath.quantile(0.25, MODEL.shape, scale) * stake;
        const q50 = GammaMath.quantile(0.50, MODEL.shape, scale) * stake;
        const q75 = GammaMath.quantile(0.75, MODEL.shape, scale) * stake;
        document.getElementById('sandbox-range').textContent =
            `${formatCurrency(q25)} – ${formatCurrency(q75)}`;
        document.getElementById('sandbox-range-sub').textContent =
            `P25–P75 · median ${formatCurrency(q50)} · mean ${formatCurrency(mu * stake)}`;

        // Verdict pill vs tier quotes (aggressive pays most, conservative least)
        const verdict = document.getElementById('sandbox-verdict');
        let cls, text;
        if (offer <= cons.quote) {
            cls = 'green'; text = `RICH MARGIN — ${((1 - offer / cons.quote) * 100).toFixed(0)}% below the conservative quote`;
        } else if (offer <= base.quote) {
            cls = 'green'; text = 'ON TARGET — between conservative and base quotes';
        } else if (offer <= agg.quote) {
            cls = 'amber'; text = 'THIN MARGIN — between base and aggressive quotes';
        } else {
            cls = 'red'; text = `ABOVE FAIR VALUE — ${((offer / agg.quote - 1) * 100).toFixed(0)}% over the aggressive quote`;
        }
        verdict.className = 'sandbox__verdict sandbox__verdict--' + cls;
        verdict.textContent = text;

        // Summary line
        document.getElementById('sandbox-summary').textContent =
            `${formatCurrencyPrecise(offer)} for ${(stake * 100).toFixed(1)}% → needs ${ (offer / (mu * stake) * 100).toFixed(0)}% of expected earnings to land · ` +
            `model would pay ${formatCurrencyPrecise(cons.quote)} (conservative) / ${formatCurrencyPrecise(base.quote)} (base) / ${formatCurrencyPrecise(agg.quote)} (aggressive) for this stake`;
    }

    offerEl.addEventListener('input', update);
    stakeEl.addEventListener('input', update);

    return { update };
})();

function updateSandbox() { Sandbox.update(); }


// ============================================================
// INPUT VALIDATION & EVENT HANDLING
// ============================================================
function validateAndCalculate(scrollToResults = true) {
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

    renderResults(rank, position, age, level, scrollToResults);
}

// Button click
document.getElementById('btn-calculate').addEventListener('click', validateAndCalculate);

// Enter key on any input (the lookup field handles its own Enter key)
document.querySelectorAll('.field__input, .field__select').forEach(el => {
    if (el.id === 'input-player') return;
    el.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            validateAndCalculate();
        }
    });
});

// Initial calculation on page load (no scroll — keep the input form in view)
document.addEventListener('DOMContentLoaded', () => {
    validateAndCalculate(false);
});
