// FRONT ROW CAPITAL PARTNERS - Prospect Valuation Model v5.0
// Professional Fund Director Decision Tool
// Updated: January 2026 - DEDUPLICATED DATA

/*
 * METHODOLOGY v5.0 - DEDUPLICATED DATASET:
 * - Used "last year ranking" rule for player deduplication
 * - 495 unique players (down from 800 prospect-years)
 * - Each player counted only once at their most recent ranking
 * - Expected values recalculated from actual unique player earnings
 * 
 * Example: Ian Happ
 *   2016: Rank 41 (26-50 tier)
 *   2017: Rank 51 (51-75 tier) ← Used this ranking
 * 
 * Major changes from v4.0:
 * - Sample sizes reduced by ~38% (removed duplicates)
 * - Expected values adjusted to reflect unique players only
 * - More accurate representation of historical performance
 */

const MODEL_DATA = {
    // Expected 1% values by tier/position (in thousands)
    // Based on 495 unique prospects with last-year rankings
    // Pitchers = LHP + RHP combined
    expectedValues: {
        "Top 10": {
                "SS": 1652,
                "3B": 2238,
                "OF": 1877,
                "Pitcher": 848,
                "C": 552,
                "2B": 0,
                "1B": 5721
        },
        "11-25": {
                "SS": 1508,
                "3B": 2219,
                "OF": 528,
                "Pitcher": 448,
                "C": 268,
                "2B": 185,
                "1B": 981
        },
        "26-50": {
                "SS": 395,
                "3B": 695,
                "OF": 425,
                "Pitcher": 309,
                "C": 244,
                "2B": 238,
                "1B": 799
        },
        "51-75": {
                "SS": 462,
                "3B": 317,
                "OF": 230,
                "Pitcher": 269,
                "C": 274,
                "2B": 276,
                "1B": 628
        },
        "76-100": {
                "SS": 247,
                "3B": 52,
                "OF": 66,
                "Pitcher": 190,
                "C": 236,
                "2B": 52,
                "1B": 218
        }
},
    
    // MLB Success Rates (earned $5M+)
    mlbSuccessRates: {
        "Top 10": {
                "SS": 0.929,
                "3B": 1.0,
                "OF": 0.833,
                "Pitcher": 0.9,
                "C": 1.0,
                "2B": 0,
                "1B": 1.0
        },
        "11-25": {
                "SS": 0.75,
                "3B": 1.0,
                "OF": 0.833,
                "Pitcher": 0.667,
                "C": 0.667,
                "2B": 0.8,
                "1B": 0.667
        },
        "26-50": {
                "SS": 0.5,
                "3B": 0.75,
                "OF": 0.571,
                "Pitcher": 0.619,
                "C": 1.0,
                "2B": 0.833,
                "1B": 1.0
        },
        "51-75": {
                "SS": 0.727,
                "3B": 0.8,
                "OF": 0.375,
                "Pitcher": 0.443,
                "C": 0.5,
                "2B": 0.5,
                "1B": 0.667
        },
        "76-100": {
                "SS": 0.364,
                "3B": 0.3,
                "OF": 0.25,
                "Pitcher": 0.421,
                "C": 0.6,
                "2B": 0.25,
                "1B": 0.5
        }
},
    
    // MLB Star Rates (earned $50M+)
    mlbStarRates: {
        "Top 10": {
                "SS": 0.643,
                "3B": 0.625,
                "OF": 0.833,
                "Pitcher": 0.5,
                "C": 1.0,
                "2B": 0,
                "1B": 1.0
        },
        "11-25": {
                "SS": 0.75,
                "3B": 0.667,
                "OF": 0.167,
                "Pitcher": 0.37,
                "C": 0.167,
                "2B": 0.0,
                "1B": 0.333
        },
        "26-50": {
                "SS": 0.25,
                "3B": 0.25,
                "OF": 0.357,
                "Pitcher": 0.175,
                "C": 0.143,
                "2B": 0.0,
                "1B": 0.5
        },
        "51-75": {
                "SS": 0.364,
                "3B": 0.2,
                "OF": 0.125,
                "Pitcher": 0.197,
                "C": 0.2,
                "2B": 0.333,
                "1B": 0.333
        },
        "76-100": {
                "SS": 0.182,
                "3B": 0.0,
                "OF": 0.0,
                "Pitcher": 0.105,
                "C": 0.1,
                "2B": 0.0,
                "1B": 0.167
        }
},
    
    // Sample sizes (unique players per tier/position)
    sampleSizes: {
        "Top 10": {
                "SS": 14,
                "3B": 8,
                "OF": 6,
                "Pitcher": 10,
                "C": 1,
                "2B": 0,
                "1B": 1
        },
        "11-25": {
                "SS": 4,
                "3B": 6,
                "OF": 6,
                "Pitcher": 27,
                "C": 6,
                "2B": 5,
                "1B": 3
        },
        "26-50": {
                "SS": 8,
                "3B": 8,
                "OF": 14,
                "Pitcher": 63,
                "C": 7,
                "2B": 6,
                "1B": 6
        },
        "51-75": {
                "SS": 11,
                "3B": 10,
                "OF": 16,
                "Pitcher": 61,
                "C": 10,
                "2B": 6,
                "1B": 3
        },
        "76-100": {
                "SS": 11,
                "3B": 10,
                "OF": 28,
                "Pitcher": 57,
                "C": 10,
                "2B": 4,
                "1B": 6
        }
},
    
    // Standardized MOIC targets for offers
    moicTargets: {
        "Top 10": [
                3.5,
                5.0,
                7.5,
                10.0,
                15.0,
                20.0
        ],
        "11-25": [
                3.5,
                5.0,
                7.5,
                10.0,
                15.0,
                20.0
        ],
        "26-50": [
                3.5,
                5.0,
                7.5,
                10.0,
                15.0,
                20.0
        ],
        "51-75": [
                3.5,
                5.0,
                7.5,
                10.0,
                15.0,
                20.0
        ],
        "76-100": [
                3.5,
                5.0,
                7.5,
                10.0,
                15.0,
                20.0
        ]
}
};

// Helper functions
function formatCurrency(value) {
    if (value >= 1000000) {
        return '$' + (value / 1000000).toFixed(2) + 'M';
    } else if (value >= 1000) {
        return '$' + Math.round(value / 1000) + 'K';
    } else {
        return '$' + Math.round(value);
    }
}

function getTier(rank) {
    if (rank <= 10) return 'Top 10';
    if (rank <= 25) return '11-25';
    if (rank <= 50) return '26-50';
    if (rank <= 75) return '51-75';
    return '76-100';
}

function calculateValuation(rank, position) {
    const tier = getTier(rank);
    
    // Get expected 1% value (in thousands)
    const expected1pctK = MODEL_DATA.expectedValues[tier][position] || 0;
    const expected1pct = expected1pctK * 1000;
    
    // Get rates
    const mlbProb = MODEL_DATA.mlbSuccessRates[tier][position] || 0;
    const starProb = MODEL_DATA.mlbStarRates[tier][position] || 0;
    
    return {
        expected1pct: expected1pct,
        mlbProb: mlbProb,
        starProb: starProb,
        tier: tier
    };
}

function generateOffers(expected1pct) {
    const moicTargets = [3.5, 5.0, 7.5, 10.0, 15.0, 20.0];
    const offers = [];
    
    moicTargets.forEach(moic => {
        const per1pct = expected1pct / moic;
        const per5pct = per1pct * 5;
        const per10pct = per1pct * 10;
        
        offers.push({
            moic: moic,
            per1pct: per1pct,
            per5pct: per5pct,
            per10pct: per10pct
        });
    });
    
    return offers;
}

function generateInsights(rank, position, results) {
    const insights = [];
    const tier = results.tier;
    
    // MLB Success insight
    if (results.mlbProb >= 0.80) {
        insights.push({
            icon: '✅',
            text: `High success rate: ${(results.mlbProb * 100).toFixed(0)}% of ${tier} ${position} prospects made MLB (earned $5M+). Strong probability of reaching the majors.`
        });
    } else if (results.mlbProb >= 0.60) {
        insights.push({
            icon: '📊',
            text: `Moderate success rate: ${(results.mlbProb * 100).toFixed(0)}% MLB rate for ${tier} ${position}. Balanced risk/reward tier.`
        });
    } else if (results.mlbProb >= 0.40) {
        insights.push({
            icon: '⚠️',
            text: `Lower success rate: ${(results.mlbProb * 100).toFixed(0)}% MLB rate. Higher risk but can offer better MOIC targets for portfolio diversity.`
        });
    } else {
        insights.push({
            icon: '🎲',
            text: `Lottery ticket: Only ${(results.mlbProb * 100).toFixed(0)}% reach MLB. Very high risk - requires 15-20x MOIC targets and portfolio diversification.`
        });
    }
    
    // Star potential insight
    if (results.starProb >= 0.50) {
        insights.push({
            icon: '⭐',
            text: `Exceptional star potential: ${(results.starProb * 100).toFixed(0)}% became MLB stars ($50M+). Elite prospects with franchise player upside.`
        });
    } else if (results.starProb >= 0.25) {
        insights.push({
            icon: '🌟',
            text: `Good star potential: ${(results.starProb * 100).toFixed(0)}% reached $50M+ earnings. Solid chance at All-Star caliber returns.`
        });
    } else if (results.starProb > 0) {
        insights.push({
            icon: '💫',
            text: `Star potential: ${(results.starProb * 100).toFixed(0)}% became stars. Some upside exists but most returns will come from solid MLB careers.`
        });
    }
    
    // Rank-specific insights
    if (rank <= 10) {
        insights.push({
            icon: '🏆',
            text: `Elite tier: Top 10 prospects are "base hits" - target 5-10x MOICs for high-probability returns with star upside.`
        });
    }
    
    if (rank >= 26 && rank <= 50) {
        insights.push({
            icon: '📊',
            text: `Sweet spot: Balanced risk/return tier. Target 7.5-10x MOIC. Excellent for portfolio diversification across positions.`
        });
    }
    
    if (rank > 75) {
        insights.push({
            icon: '🎰',
            text: `Lottery tickets: Require 15-20x MOICs. Need 10+ positions at this tier to offset risk through portfolio approach.`
        });
    }
    
    // Fund director guidance
    const offer_at_7_5x = results.expected1pct / (7.5 * 1000);
    const offer_at_10x = results.expected1pct / (10.0 * 1000);
    
    insights.push({
        icon: '💼',
        text: `Fund guidance: Sweet spot ${formatCurrency(offer_at_7_5x)} (7.5x MOIC) to ${formatCurrency(offer_at_10x)} (10x MOIC). Model v5.0 with deduplicated data.`
    });
    
    return insights;
}

function calculate() {
    // Get inputs
    const rankInput = document.getElementById('prospectRank');
    const positionInput = document.getElementById('position');
    
    const rank = parseInt(rankInput.value);
    const position = positionInput.value;
    
    // Validation
    let isValid = true;
    
    if (!rank || rank < 1 || rank > 100) {
        rankInput.classList.add('is-invalid');
        isValid = false;
    } else {
        rankInput.classList.remove('is-invalid');
    }
    
    if (!position) {
        positionInput.classList.add('is-invalid');
        isValid = false;
    } else {
        positionInput.classList.remove('is-invalid');
    }
    
    if (!isValid) return;
    
    // Calculate
    const results = calculateValuation(rank, position);
    const tier = results.tier;
    
    // Check if we have data for this combination
    const sampleSize = MODEL_DATA.sampleSizes[tier][position] || 0;
    if (sampleSize === 0) {
        alert(`No historical data available for ${tier} ${position} prospects. Please try a different combination.`);
        return;
    }
    
    // Update summary cards
    document.getElementById('mlbSuccessRate').textContent = `${(results.mlbProb * 100).toFixed(1)}%`;
    document.getElementById('mlbStarRate').textContent = `${(results.starProb * 100).toFixed(1)}%`;
    document.getElementById('expected1pct').textContent = formatCurrency(results.expected1pct);
    document.getElementById('riskTier').textContent = tier;
    
    // Display record count
    document.getElementById('recordCount').textContent = sampleSize;
    
    // Update offer table
    const offers = generateOffers(results.expected1pct);
    const tableBody = document.getElementById('offerTableBody');
    tableBody.innerHTML = '';
    
    offers.forEach((offer, index) => {
        const row = document.createElement('tr');
        // Highlight 7.5x and 10x (indices 2-3) as recommended sweet spot
        if (index === 2 || index === 3) {
            row.classList.add('recommended');
        }
        
        row.innerHTML = `
            <td><span class="moic-label">${offer.moic}x</span></td>
            <td>${formatCurrency(offer.per1pct)}</td>
            <td>${formatCurrency(offer.per5pct)}</td>
            <td>${formatCurrency(offer.per10pct)}</td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Update insights
    const insights = generateInsights(rank, position, results);
    const insightsContainer = document.getElementById('insightsContent');
    insightsContainer.innerHTML = '';
    
    insights.forEach(insight => {
        const div = document.createElement('div');
        div.className = 'insight-item';
        div.textContent = `${insight.icon} ${insight.text}`;
        insightsContainer.appendChild(div);
    });
    
    // Show results
    document.getElementById('results').style.display = 'block';
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Bootstrap tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl)
    });
    
    document.getElementById('calculateBtn').addEventListener('click', calculate);
    
    // Allow Enter key to calculate
    document.getElementById('prospectRank').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') calculate();
    });
});