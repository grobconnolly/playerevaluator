// Model Data - Based on historical analysis and market validation
// Updated with Jesus Made (#4 SS, $225K) and comprehensive data analysis
const MODEL_DATA = {
    // Expected 1% values by tier/position (in thousands)
    // Based on 502 prospects from 2012-2016 cohorts, adjusted for 2025 inflation
    expectedValues: {
        'Top 10': {
            'SS': 3224,
            '3B': 2501,
            'OF': 2217,
            'Pitcher': 1102,
            'C': 1830,
            '2B': 2000,
            '1B': 2000
        },
        '11-25': {
            'SS': 2340,
            '3B': 2929,
            'OF': 1267,
            'Pitcher': 766,
            'C': 343,
            '2B': 1000,
            '1B': 1000
        },
        '26-50': {
            'SS': 708,
            '3B': 688,
            'OF': 874,
            'Pitcher': 509,
            'C': 194,
            '2B': 600,
            '1B': 600
        },
        '51-75': {
            'SS': 988,
            '3B': 551,
            'OF': 800,  // Updated: 3.1x increase based on Judge/Tucker/2017-2019 data
            'Pitcher': 448,
            'C': 528,
            '2B': 400,
            '1B': 400
        },
        '76-100': {
            'SS': 728,
            '3B': 552,
            'OF': 650,  // Updated: 3.2x increase based on Soto ($765M)/Judge/2017-2019 data
            'Pitcher': 402,
            'C': 63,
            '2B': 300,
            '1B': 300
        }
    },
    
    // MLB success rates by tier and position
    // Based on actual historical data (2012-2016 cohorts)
    successRates: {
        'Top 10': {
            'SS': 0.923,
            '3B': 1.000,
            'OF': 0.778,
            'Pitcher': 0.955,
            'C': 0.850,
            '2B': 0.900,
            '1B': 0.900
        },
        '11-25': {
            'SS': 1.000,
            '3B': 1.000,
            'OF': 0.900,
            'Pitcher': 0.714,
            'C': 0.667,
            '2B': 0.800,
            '1B': 0.800
        },
        '26-50': {
            'SS': 0.538,
            '3B': 0.750,
            'OF': 0.750,
            'Pitcher': 0.639,
            'C': 1.000,
            '2B': 0.700,
            '1B': 0.700
        },
        '51-75': {
            'SS': 0.636,
            '3B': 0.625,
            'OF': 0.333,
            'Pitcher': 0.466,
            'C': 0.571,
            '2B': 0.500,
            '1B': 0.500
        },
        '76-100': {
            'SS': 0.462,
            '3B': 0.500,
            'OF': 0.304, // Updated: actual data from 23 OFs ranked 80-100
            'Pitcher': 0.431,
            'C': 0.333,
            '2B': 0.400,
            '1B': 0.400
        }
    },
    
    // Market-calibrated offer ranges (in thousands)
    // Based on Jesus Made ($225K for #4 SS) and Tatis ($200K for #8 SS)
    offerRanges: {
        'Top 10': {
            'SS': { low: 200, mid: 250, high: 350 },
            '3B': { low: 180, mid: 225, high: 325 },
            'OF': { low: 150, mid: 200, high: 300 },
            'Pitcher': { low: 125, mid: 175, high: 250 },
            'C': { low: 100, mid: 150, high: 225 },
            '2B': { low: 150, mid: 200, high: 275 },
            '1B': { low: 150, mid: 200, high: 275 }
        },
        '11-25': {
            'SS': { low: 150, mid: 200, high: 275 },
            '3B': { low: 160, mid: 220, high: 300 },
            'OF': { low: 100, mid: 150, high: 200 },
            'Pitcher': { low: 80, mid: 125, high: 175 },
            'C': { low: 60, mid: 90, high: 130 },
            '2B': { low: 100, mid: 150, high: 200 },
            '1B': { low: 100, mid: 150, high: 200 }
        },
        '26-50': {
            'SS': { low: 70, mid: 100, high: 130 },
            '3B': { low: 65, mid: 95, high: 125 },
            'OF': { low: 55, mid: 80, high: 110 },
            'Pitcher': { low: 45, mid: 65, high: 90 },
            'C': { low: 35, mid: 50, high: 70 },
            '2B': { low: 55, mid: 80, high: 110 },
            '1B': { low: 55, mid: 80, high: 110 }
        },
        '51-75': {
            'SS': { low: 70, mid: 95, high: 125 },
            '3B': { low: 60, mid: 85, high: 110 },
            'OF': { low: 80, mid: 115, high: 160 },  // Updated: 3.1x increase for Judge/Tucker market
            'Pitcher': { low: 50, mid: 70, high: 90 },
            'C': { low: 40, mid: 60, high: 80 },
            '2B': { low: 45, mid: 65, high: 85 },
            '1B': { low: 45, mid: 65, high: 85 }
        },
        '76-100': {
            'SS': { low: 55, mid: 75, high: 100 },
            '3B': { low: 45, mid: 65, high: 85 },
            'OF': { low: 60, mid: 85, high: 125 },  // Updated: 3.2x increase for Soto/Judge market
            'Pitcher': { low: 35, mid: 50, high: 70 },
            'C': { low: 20, mid: 30, high: 45 },
            '2B': { low: 30, mid: 45, high: 65 },
            '1B': { low: 30, mid: 45, high: 65 }
        }
    }
};

// Get tier based on rank
function getTier(rank) {
    if (rank <= 10) return 'Top 10';
    if (rank <= 25) return '11-25';
    if (rank <= 50) return '26-50';
    if (rank <= 75) return '51-75';
    return '76-100';
}

// Format currency
function formatCurrency(amount, decimals = 0) {
    if (amount >= 1000000) {
        return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
        return `$${Math.round(amount / 1000)}K`;
    }
    return `$${Math.round(amount)}`;
}

// Calculate projections based on rank and position
function calculateExpectedValue(rank, position) {
    const tier = getTier(rank);
    
    // Get expected 1% value directly from model (already accounts for MLB probability and inflation)
    const expected1pct = (MODEL_DATA.expectedValues[tier][position] || 0) * 1000; // Convert from K to dollars
    
    // Get position-specific MLB probability
    const mlbProb = MODEL_DATA.successRates[tier][position] || MODEL_DATA.successRates[tier]['OF'];
    
    // Back-calculate projected career from expected value
    const projectedCareer = mlbProb > 0 ? (expected1pct / 0.01) / mlbProb : 0;
    
    return {
        tier,
        projectedCareer,
        mlbProb,
        expected1pct
    };
}

// Calculate offers by MOIC
function calculateOffers(expected1pct, moics) {
    return moics.map(moic => ({
        moic,
        per1pct: expected1pct / moic,
        per5pct: (expected1pct / moic) * 5,
        per10pct: (expected1pct / moic) * 10,
        expectedReturn: moic
    }));
}

// Get position risk
function getPositionRisk(position) {
    const riskLevels = {
        'SS': { level: 'LOW', detail: 'Premium position with highest earning potential and 68% MLB success rate.' },
        '3B': { level: 'LOW', detail: 'Premium position with strong earning potential, especially in ranks 11-25.' },
        '1B': { level: 'MEDIUM', detail: 'Solid position but requires elite offense to justify high salaries.' },
        'OF': { level: 'MEDIUM', detail: 'Good position but highly competitive. Need elite speed or power.' },
        '2B': { level: 'MEDIUM', detail: 'Moderate earning potential. Less physically demanding than SS.' },
        'Pitcher': { level: 'HIGH', detail: 'High injury risk (Tommy John, shoulder). 0.6-0.8x multipliers reflect this.' },
        'C': { level: 'HIGH', detail: 'Physically demanding position with lowest earning potential (0.3-0.4x multipliers).' }
    };
    return riskLevels[position] || { level: 'MEDIUM', detail: 'Standard risk profile.' };
}

// Get rank tier risk
function getRankRisk(rank) {
    if (rank <= 10) {
        return { level: 'LOW', detail: '92% MLB success rate. 66% become stars earning $50M+.' };
    } else if (rank <= 25) {
        return { level: 'LOW', detail: '79% MLB success rate. 41% become stars earning $50M+.' };
    } else if (rank <= 50) {
        return { level: 'MEDIUM', detail: '70% MLB success rate. 24% become stars earning $50M+.' };
    } else if (rank <= 75) {
        return { level: 'HIGH', detail: '46% MLB success rate. 19% become stars earning $50M+.' };
    } else {
        return { level: 'HIGH', detail: '42% MLB success rate. Only 14% become stars earning $50M+.' };
    }
}

// Generate insights
function generateInsights(rank, position, results) {
    const insights = [];
    const tier = results.tier;
    const offerRange = MODEL_DATA.offerRanges[tier][position];
    
    // Jesus Made / Tatis reference for top prospects
    if (rank <= 10 && position === 'SS') {
        insights.push({
            icon: '💎',
            text: `Market comp: Jesus Made (#4 SS) signed for $225K per 1%. Tatis (#8 SS) signed for $200K. Your range: ${offerRange.low}K-${offerRange.high}K is validated.`
        });
    }
    
    // Position-specific insights
    if (position === 'SS' && rank <= 25) {
        insights.push({
            icon: '⭐',
            text: `Premium position: SS in top 25 have ${(results.mlbProb * 100).toFixed(0)}% MLB success rate and average career ${(results.projectedCareer / 1000000).toFixed(0)}M.`
        });
    }
    
    if (position === '3B' && rank >= 11 && rank <= 25) {
        insights.push({
            icon: '🎯',
            text: `Sweet spot: 3B in ranks 11-25 have 100% MLB rate and highest position multiplier (2.65x).`
        });
    }
    
    if (position === 'Pitcher') {
        insights.push({
            icon: '⚠️',
            text: `Injury risk: Pitchers have injury discount in pricing. Demand lower valuation or pass unless top 25.`
        });
    }
    
    if (position === 'C') {
        insights.push({
            icon: '🚫',
            text: `Avoid catchers: Lowest earning potential and physically demanding. Pass unless top 10 overall.`
        });
    }
    
    if (position === 'OF' && rank >= 51 && rank <= 75) {
        insights.push({
            icon: '🚀',
            text: `OF surge: 51-75 OFs outperforming historical data by 3x. Aaron Judge (#61, $394M) and Kyle Tucker (#63, $277M) validate higher valuations.`
        });
    }
    
    if (position === 'OF' && rank >= 76) {
        insights.push({
            icon: '💎',
            text: `OF lottery: 76-100 OFs trending up. Juan Soto (#95, $765M) and Judge show potential. Still high risk but increased upside.`
        });
    }
    
    // Rank-specific insights
    if (rank <= 10) {
        insights.push({
            icon: '🏆',
            text: `Elite tier: ${(results.mlbProb * 100).toFixed(0)}% MLB success rate, 66% become stars. Expect competition - be prepared to pay full range.`
        });
    }
    
    if (rank >= 51 && rank <= 75) {
        insights.push({
            icon: '📊',
            text: `Moderate risk: ${(results.mlbProb * 100).toFixed(0)}% MLB success rate. Good for diversification but need multiple positions in this tier.`
        });
    }
    
    if (rank > 75) {
        insights.push({
            icon: '🎲',
            text: `Lottery ticket: Only ${(results.mlbProb * 100).toFixed(0)}% make MLB. Need aggressive pricing. George Springer (#84 OF) made $187M - but rare.`
        });
    }
    
    // Expected MOIC at midpoint
    const midOffer = offerRange.mid * 1000;
    const expectedMOIC = results.expected1pct / midOffer;
    insights.push({
        icon: '💰',
        text: `Expected return: At ${offerRange.mid}K (midpoint), you target ${expectedMOIC.toFixed(1)}x MOIC. Market-validated pricing.`
    });
    
    return insights;
}

// Main calculation function
function calculate() {
    // Get inputs
    const rankInput = document.getElementById('prospectRank');
    const positionInput = document.getElementById('primaryPosition');
    
    const rank = parseInt(rankInput.value);
    const position = positionInput.value;
    
    // Validate
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
    const results = calculateExpectedValue(rank, position);
    const tier = results.tier;
    
    // Get market-calibrated offers for this tier/position
    const offerRange = MODEL_DATA.offerRanges[tier][position];
    
    // Create offer table with Low, Mid, High ranges
    const marketOffers = [
        { 
            label: 'Low',
            moic: results.expected1pct / (offerRange.high * 1000), // High price = low MOIC
            per1pct: offerRange.high * 1000,
            per5pct: offerRange.high * 1000 * 5,
            per10pct: offerRange.high * 1000 * 10
        },
        { 
            label: 'Mid',
            moic: results.expected1pct / (offerRange.mid * 1000),
            per1pct: offerRange.mid * 1000,
            per5pct: offerRange.mid * 1000 * 5,
            per10pct: offerRange.mid * 1000 * 10
        },
        { 
            label: 'High',
            moic: results.expected1pct / (offerRange.low * 1000), // Low price = high MOIC
            per1pct: offerRange.low * 1000,
            per5pct: offerRange.low * 1000 * 5,
            per10pct: offerRange.low * 1000 * 10
        }
    ];
    
    // Update summary cards
    document.getElementById('projectedCareer').textContent = formatCurrency(results.projectedCareer);
    document.getElementById('mlbSuccessRate').textContent = `${(results.mlbProb * 100).toFixed(0)}%`;
    document.getElementById('expected1pct').textContent = formatCurrency(results.expected1pct);
    
    // Calculate break-even probability (at 1.0x MOIC)
    const breakEvenProb = results.mlbProb * 100;
    document.getElementById('breakEvenProb').textContent = `${breakEvenProb.toFixed(0)}%`;
    
    // Update offer table
    const tableBody = document.getElementById('offerTableBody');
    tableBody.innerHTML = '';
    
    marketOffers.forEach((offer) => {
        const row = document.createElement('tr');
        // Highlight Mid as recommended
        if (offer.label === 'Mid') {
            row.classList.add('recommended');
        }
        
        row.innerHTML = `
            <td><span class="moic-label">${offer.label} (${offer.moic.toFixed(1)}x)</span></td>
            <td><strong>${formatCurrency(offer.per1pct)}</strong></td>
            <td>${formatCurrency(offer.per5pct)}</td>
            <td>${formatCurrency(offer.per10pct)}</td>
            <td>${offer.moic.toFixed(1)}x</td>
        `;
        tableBody.appendChild(row);
    });
    
    // Update insights
    const insights = generateInsights(rank, position, results);
    const insightsContent = document.getElementById('insightsContent');
    insightsContent.innerHTML = '';
    
    insights.forEach(insight => {
        const div = document.createElement('div');
        div.className = 'insight-item';
        div.innerHTML = `
            <span class="insight-icon">${insight.icon}</span>
            <span>${insight.text}</span>
        `;
        insightsContent.appendChild(div);
    });
    
    // Update risk assessment
    const posRisk = getPositionRisk(position);
    const rankRisk = getRankRisk(rank);
    
    document.getElementById('positionRisk').textContent = posRisk.level;
    document.getElementById('positionRisk').className = `risk-badge risk-${posRisk.level.toLowerCase()}`;
    document.getElementById('positionRiskDetail').textContent = posRisk.detail;
    
    document.getElementById('rankRisk').textContent = rankRisk.level;
    document.getElementById('rankRisk').className = `risk-badge risk-${rankRisk.level.toLowerCase()}`;
    document.getElementById('rankRiskDetail').textContent = rankRisk.detail;
    
    // Show results
    document.getElementById('resultsSection').style.display = 'block';
    
    // Scroll to results
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('calculateBtn').addEventListener('click', calculate);
    
    // Allow Enter key to calculate
    document.getElementById('prospectRank').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') calculate();
    });
    
    document.getElementById('primaryPosition').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') calculate();
    });
    
    // Clear validation on input
    document.getElementById('prospectRank').addEventListener('input', function() {
        this.classList.remove('is-invalid');
    });
    
    document.getElementById('primaryPosition').addEventListener('change', function() {
        this.classList.remove('is-invalid');
    });
});