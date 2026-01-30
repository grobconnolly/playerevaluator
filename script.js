// Model Data - Based on historical analysis
const MODEL_DATA = {
    // Average career earnings by tier (2012 baseline, in millions)
    tierAverages: {
        'Top 10': 131.7,
        '11-25': 73.3,
        '26-50': 41.3,
        '51-75': 31.2,
        '76-100': 26.1
    },
    
    // MLB success rates by tier
    successRates: {
        'Top 10': 0.92,
        '11-25': 0.787,
        '26-50': 0.704,
        '51-75': 0.456,
        '76-100': 0.417
    },
    
    // Position multipliers by tier
    positionMultipliers: {
        'SS': {
            'Top 10': 1.62,
            '11-25': 2.11,
            '26-50': 1.14,
            '51-75': 1.0,
            '76-100': 1.0
        },
        '3B': {
            'Top 10': 1.26,
            '11-25': 2.65,
            '26-50': 1.11,
            '51-75': 1.0,
            '76-100': 1.0
        },
        'OF': {
            'Top 10': 1.12,
            '11-25': 1.14,
            '26-50': 1.41,
            '51-75': 1.0,
            '76-100': 1.0
        },
        'Pitcher': {
            'Top 10': 0.55,
            '11-25': 0.70,
            '26-50': 0.83,
            '51-75': 1.0,
            '76-100': 1.0
        },
        'C': {
            'Top 10': 0.42,
            '11-25': 0.32,
            '26-50': 0.31,
            '51-75': 1.0,
            '76-100': 1.0
        },
        '2B': {
            'Top 10': 1.0,
            '11-25': 1.0,
            '26-50': 1.0,
            '51-75': 1.0,
            '76-100': 1.0
        },
        '1B': {
            'Top 10': 1.0,
            '11-25': 1.0,
            '26-50': 1.0,
            '51-75': 1.0,
            '76-100': 1.0
        }
    },
    
    // Constants
    inflationMultiplier: 1.51, // 2012 to 2025 (3.5% annual)
    targetMOICs: [3.5, 5.0, 7.5, 10.0]
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

// Calculate expected value
function calculateExpectedValue(rank, position) {
    const tier = getTier(rank);
    const baseEarnings = MODEL_DATA.tierAverages[tier] * 1000000; // Convert to dollars
    const posMultiplier = MODEL_DATA.positionMultipliers[position][tier];
    const mlbProb = MODEL_DATA.successRates[tier];
    
    // Projected career earnings
    const projectedCareer = baseEarnings * posMultiplier * MODEL_DATA.inflationMultiplier;
    
    // Expected 1% value (accounting for MLB probability)
    const expected1pct = (projectedCareer * 0.01) * mlbProb;
    
    return {
        tier,
        projectedCareer,
        mlbProb,
        expected1pct,
        posMultiplier
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
    
    // Position-specific insights
    if (position === 'SS' && rank <= 25) {
        insights.push({
            icon: '⭐',
            text: `Premium opportunity: SS in top 25 have 2.1x position multiplier and average $${(results.projectedCareer / 1000000).toFixed(0)}M careers.`
        });
    }
    
    if (position === '3B' && rank >= 11 && rank <= 25) {
        insights.push({
            icon: '🎯',
            text: `Sweet spot: 3B in ranks 11-25 have highest multiplier (2.65x) of any position/tier combo.`
        });
    }
    
    if (position === 'Pitcher') {
        insights.push({
            icon: '⚠️',
            text: `Injury risk: Pitchers have 0.6-0.8x multipliers. Demand discount or pass unless top 25.`
        });
    }
    
    if (position === 'C') {
        insights.push({
            icon: '🚫',
            text: `Avoid: Catchers have lowest multipliers (0.3-0.4x) and only 14% star rate. Pass unless top 10.`
        });
    }
    
    // Rank-specific insights
    if (rank <= 10) {
        insights.push({
            icon: '💎',
            text: `Elite tier: ${(results.mlbProb * 100).toFixed(0)}% MLB success rate. These prospects are scarce - be prepared for competition.`
        });
    }
    
    if (rank > 50) {
        insights.push({
            icon: '📉',
            text: `High risk: Only ${(results.mlbProb * 100).toFixed(0)}% MLB success rate. Volume approach recommended - diversify across many prospects.`
        });
    }
    
    // MOIC guidance
    const tatis_equivalent = results.expected1pct / 254000; // Tatis got $254K (2018 adjusted)
    if (tatis_equivalent >= 8) {
        insights.push({
            icon: '💰',
            text: `Strong value: At market rates (~$200-250K), this would target ${tatis_equivalent.toFixed(1)}x MOIC. Tatis-level opportunity.`
        });
    }
    
    // Break-even probability
    const breakEvenOffer = results.expected1pct / 1.0; // 1.0x MOIC
    const breakEvenProb = results.mlbProb * 100;
    insights.push({
        icon: '📊',
        text: `Break-even: At $${formatCurrency(breakEvenOffer)} per 1%, you break even if they make MLB (${breakEvenProb.toFixed(0)}% probability).`
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
    const offers = calculateOffers(results.expected1pct, MODEL_DATA.targetMOICs);
    
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
    
    offers.forEach((offer, index) => {
        const row = document.createElement('tr');
        // Highlight 7.5x and 10x as recommended
        if (offer.moic === 7.5 || offer.moic === 10.0) {
            row.classList.add('recommended');
        }
        
        row.innerHTML = `
            <td><span class="moic-label">${offer.moic.toFixed(1)}x</span></td>
            <td><strong>${formatCurrency(offer.per1pct)}</strong></td>
            <td>${formatCurrency(offer.per5pct)}</td>
            <td>${formatCurrency(offer.per10pct)}</td>
            <td>${offer.expectedReturn.toFixed(1)}x</td>
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