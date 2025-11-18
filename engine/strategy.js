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

        // [수정] RRIF 최소 인출액은 여전히 RRIF 잔액(rrspBalance)으로 계산합니다.
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

// [수정] LIF 최소 인출 계산 로직을 포함하도록 함수를 확장
var RRIF_LIF_WITHDRAWAL_RATES = {
    // RRIF/LIF 공통 연방 최소 인출률 (71세부터)
    71: 0.0528, 72: 0.0540, 73: 0.0553, 74: 0.0567, 75: 0.0582,
    76: 0.0598, 77: 0.0617, 78: 0.0636, 79: 0.0658, 80: 0.0682,
    81: 0.0708, 82: 0.0738, 83: 0.0771, 84: 0.0808, 85: 0.0851,
    86: 0.0899, 87: 0.0955, 88: 0.1021, 89: 0.1099, 90: 0.1192,
    91: 0.1306, 92: 0.1449, 93: 0.1634, 94: 0.1879, 95: 0.2000
    // 95세 이상은 20%
};

/**
 * LIF와 RRIF의 최소 인출액을 계산합니다.
 * LIF는 55세부터 최소 인출이 시작됩니다.
 * @param {number} age - 현재 나이
 * @param {number} balance - 현재 계좌 잔액
 * @param {string} accountType - 'rrsp' 또는 'lif'
 * @returns {number} - 최소 인출 금액
 */
var getMinWithdrawal = function(age, balance, accountType) {
    if (balance <= 0) return 0;

    var rate = 0;
    if (accountType === 'rrsp') {
        // RRIF는 71세부터 최소 인출
        if (age < 71) return 0;
        rate = age >= 95 ? 0.20 : (RRIF_LIF_WITHDRAWAL_RATES[age] || 0);
    } else if (accountType === 'lif') {
        // LIF는 은퇴 나이(55세)부터 최소 인출
        if (age < 55) return 0;

        // 71세 미만의 LIF 최소 인출 (T-4)
        if (age < 71) {
            // (1 / (90 - age)) 공식을 따르며, 71세의 5.28%보다 작음
            // 연방 기준: (1 / (90 - age)) * 100%
            rate = 1 / Math.max(1, 90 - age);
            // 55세: 1/35 ≈ 0.02857 (2.86%)
            // 70세: 1/20 = 0.05 (5%)
        } else {
            // 71세 이상의 LIF 최소 인출은 RRIF와 동일 (T-4)
            rate = age >= 95 ? 0.20 : (RRIF_LIF_WITHDRAWAL_RATES[age] || 0);
        }
    } else {
        return 0; // RRSP/LIF가 아닌 경우
    }

    return balance * rate;
};

// [삭제] 기존의 RRIF 전용 함수는 새 함수로 대체
// var getRrifMinWithdrawal = function(age, rrspBalance) { ... };


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
