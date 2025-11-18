// --- strategy.js ---

var lookAheadAndAdvise = function(currentAge, currentYear, rrspBalance, currentBaseIncome, scenario) {
    var expertParams = scenario.settings.expertMode && scenario.settings.expertMode.params;
    var lookAheadPeriod = (scenario.settings.expertMode && scenario.settings.expertMode.enabled && expertParams && expertParams.lookAheadYears)
        ? expertParams.lookAheadYears
        : 7;
    var futureIncomes = [];
    var futureRrspBalance = rrspBalance; 

    for (var i = 1; i <= lookAheadPeriod; i++) {
        var futureYear = currentYear + i;
        var futureAge = currentAge + i;

        var futureAnnualIncomes = scenario.incomes.reduce(function(acc, inc) {
            if (futureYear >= inc.startYear && futureYear <= (inc.endYear || scenario.settings.endYear)) {
                return acc + inc.amount * getInflationFactor(futureYear, inc.startYear, inc.growthRate);
            }
            return acc;
        }, 0);

        var futureRrifMin = getRrifMinWithdrawal(futureAge, futureRrspBalance);
        var totalFutureBaseIncome = futureAnnualIncomes + futureRrifMin;
        futureIncomes.push(totalFutureBaseIncome);
    }

    var averageFutureIncome = futureIncomes.reduce(function(a, b) { return a + b; }, 0) / futureIncomes.length;
    
    if (averageFutureIncome > currentBaseIncome * 1.30) {
        return -0.05;
    } 
    else if (averageFutureIncome > currentBaseIncome * 1.15) {
        return -0.02;
    }

    return 0;
};

var getRrifMinWithdrawal = function(age, rrspBalance) {
    if (age < 71 || rrspBalance <= 0) return 0;
    var withdrawalRates = {
        71: 0.0528, 72: 0.0540, 73: 0.0553, 74: 0.0567, 75: 0.0582,
        76: 0.0598, 77: 0.0617, 78: 0.0636, 79: 0.0658, 80: 0.0682,
        81: 0.0708, 82: 0.0738, 83: 0.0771, 84: 0.0808, 85: 0.0851,
        86: 0.0899, 87: 0.0955, 88: 0.1021, 89: 0.1099, 90: 0.1192,
        91: 0.1306, 92: 0.1449, 93: 0.1634, 94: 0.1879, 95: 0.2000
    };
    var rate = age >= 95 ? 0.20 : (withdrawalRates[age] || 0);
    return rrspBalance * rate;
};

var findOptimalAnnualStrategy = function(amountNeeded, balances, yearContext) {
    var scenario = yearContext.scenario;
    var age = yearContext.age;
    var startYear = yearContext.startYear;
    var taxParameters = yearContext.taxParameters;
    var initialIncomeBreakdown = yearContext.incomeBreakdown;

    var MAX_ITERATIONS = 3;
    var currentWithdrawalPlan = { rrsp: 0, tfsa: 0, nonReg: 0 };
    var finalTaxResult = { tax: 0 };
    var logMessage = "Plan A: Iterative solver started.";
    var result;

    for (var i = 0; i < MAX_ITERATIONS; i++) {
        var capitalGainRatio = balances.nonReg > 0 ? (balances.nonReg - (balances.nonRegACB || 0)) / balances.nonReg : 0;

// Correctly create the income breakdown for tax estimation
var tempIncomeBreakdown = {
    otherIncome: initialIncomeBreakdown.otherIncome || 0,
    rrspWithdrawal: currentWithdrawalPlan.rrsp,
    capitalGains: Math.max(0, capitalGainRatio) * currentWithdrawalPlan.nonReg
};

var oasIncomeData = scenario.incomes.find(function(inc) { return inc.type === 'OAS'; });
var oasIncome = (oasIncomeData && startYear >= oasIncomeData.startYear)
    ? oasIncomeData.amount * getInflationFactor(startYear, oasIncomeData.startYear, oasIncomeData.growthRate)
    : 0;

var netIncomeForClawback = (tempIncomeBreakdown.otherIncome || 0) + tempIncomeBreakdown.rrspWithdrawal + tempIncomeBreakdown.capitalGains + oasIncome;

var tempTaxResult = calculateTaxWithClawback({
    incomeBreakdown: tempIncomeBreakdown,
    netIncomeForClawback: netIncomeForClawback,
    oasIncome: oasIncome,
    age: age,
    taxParameters: taxParameters,
    province: scenario.settings.province
});

// Fix the property name from .tax to .totalTax
var estimatedTax = tempTaxResult.totalTax;
        var totalAmountNeeded = amountNeeded + estimatedTax;

        var totalAssets = balances.rrsp + balances.tfsa + balances.nonReg;
        var rrspRatio = totalAssets > 0 ? balances.rrsp / totalAssets : 0;
        var strategicParams = determineStrategicParameters(age, totalAssets, rrspRatio, scenario.settings.monteCarlo.riskProfile, scenario.settings.expertMode);
        var rrspBonus = strategicParams.rrspBonus;
        var tfsaPenalty = strategicParams.tfsaPenalty;

        var currentBaseIncome = scenario.incomes.reduce(function(acc, inc) {
            return (startYear >= inc.startYear && startYear <= (inc.endYear || scenario.settings.endYear) ? acc + inc.amount : acc);
        }, 0);
        var rrspCostAdjustment = lookAheadAndAdvise(age, startYear, balances.rrsp, currentBaseIncome, scenario);
        
        var estimatedMTR = tempTaxResult.marginalRate;
        var taxableGainPerDollar = Math.max(0, capitalGainRatio) * 0.5;
        
        var rrspCost = estimatedMTR - rrspBonus + rrspCostAdjustment;
        var nonRegCost = estimatedMTR * taxableGainPerDollar;
        var tfsaCost = tfsaPenalty;

        var model = {
            optimize: "cost",
            opType: "min",
            constraints: {
                needed: { min: totalAmountNeeded },
                rrspMax: { max: balances.rrsp },
                tfsaMax: { max: balances.tfsa },
                nonRegMax: { max: balances.nonReg }
            },
            variables: {
                rrsp: { cost: rrspCost, needed: 1, rrspMax: 1 },
                tfsa: { cost: tfsaCost, needed: 1, tfsaMax: 1 },
                nonReg: { cost: nonRegCost, needed: 1, nonRegMax: 1 }
            },
        };
        result = solver.Solve(model);
        
        var newPlan = {
            rrsp: result.feasible ? Math.max(0, Math.round(result.rrsp || 0)) : 0,
            tfsa: result.feasible ? Math.max(0, Math.round(result.tfsa || 0)) : 0,
            nonReg: result.feasible ? Math.max(0, Math.round(result.nonReg || 0)) : 0,
        };

        if (newPlan.rrsp === currentWithdrawalPlan.rrsp && newPlan.tfsa === currentWithdrawalPlan.tfsa && newPlan.nonReg === currentWithdrawalPlan.nonReg) {
            logMessage = "Plan A: Iterative solver found a stable solution after " + (i + 1) + " iteration(s).";
            finalTaxResult = tempTaxResult;
            currentWithdrawalPlan = newPlan;
            break;
        }
        
        currentWithdrawalPlan = newPlan;
        finalTaxResult = tempTaxResult;
        if (i === MAX_ITERATIONS - 1) {
            logMessage = "WARNING: Plan A (Solver) did not stabilize after " + MAX_ITERATIONS + " iterations. Using last result.";
        }
    }

    var currentTotal = currentWithdrawalPlan.rrsp + currentWithdrawalPlan.tfsa + currentWithdrawalPlan.nonReg;
    var finalTotalNeeded = amountNeeded + finalTaxResult.totalTax;
    if (currentTotal < finalTotalNeeded) {
        var shortfall = finalTotalNeeded - currentTotal;
        if (balances.tfsa >= currentWithdrawalPlan.tfsa + shortfall) {
            currentWithdrawalPlan.tfsa += shortfall;
        } else if (balances.nonReg >= currentWithdrawalPlan.nonReg + shortfall) {
            currentWithdrawalPlan.nonReg += shortfall;
        } else if (balances.rrsp >= currentWithdrawalPlan.rrsp + shortfall) {
            currentWithdrawalPlan.rrsp += shortfall;
        }
    }

    return {
        withdrawals: currentWithdrawalPlan,
        log: { reason: logMessage, solverSuccess: true, solverResult: result }
    };
};