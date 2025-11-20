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

        var futureRrifMin = getMinWithdrawal(futureAge, futureRrspBalance, 'rrsp');
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

// RRIF 최소 인출률 (71세 이상용, 기존 유지)
var RRIF_LIF_WITHDRAWAL_RATES = {
    71: 0.0528, 72: 0.0540, 73: 0.0553, 74: 0.0567, 75: 0.0582,
    76: 0.0598, 77: 0.0617, 78: 0.0636, 79: 0.0658, 80: 0.0682,
    81: 0.0708, 82: 0.0738, 83: 0.0771, 84: 0.0808, 85: 0.0851,
    86: 0.0899, 87: 0.0955, 88: 0.1021, 89: 0.1099, 90: 0.1192,
    91: 0.1306, 92: 0.1449, 93: 0.1634, 94: 0.1879, 95: 0.2000
};

/**
 * LIF와 RRIF의 최소 인출액을 계산합니다.
 * LIF는 data.js의 테이블을 참조하여 50세부터 정확한 비율을 적용합니다.
 */
var getMinWithdrawal = function(age, balance, accountType) {
    if (balance <= 0) return 0;

    var rate = 0;
    if (accountType === 'rrsp') {
        // RRIF는 71세부터 최소 인출 (기존 로직 유지)
        if (age < 71) return 0;
        rate = age >= 95 ? 0.20 : (RRIF_LIF_WITHDRAWAL_RATES[age] || 0);
    } else if (accountType === 'lif') {
        // ★★★ [수정] 공식 제거 및 테이블 참조 (LIF_MIN_WITHDRAWAL_RATES는 data.js에 정의됨) ★★★
        // 95세 이상은 20% 고정
        if (age >= 95) {
            rate = 0.20;
        } else {
            // data.js에 정의된 테이블에서 조회 (없으면 0)
            rate = (typeof LIF_MIN_WITHDRAWAL_RATES !== 'undefined' && LIF_MIN_WITHDRAWAL_RATES[age]) 
                   ? LIF_MIN_WITHDRAWAL_RATES[age] 
                   : 0;
        }
    } else {
        return 0;
    }

    return balance * rate;
};

/**
 * ★★★ [신설] LIF 최대 인출액 계산 (CANSIM Rate 연동) ★★★
 * @param {number} age - 현재 나이
 * @param {number} balance - LIF 잔액
 * @param {number} cansimRate - data.js에서 넘어온 CANSIM 금리 (decimal, e.g., 0.035)
 * @param {string} jurisdiction - 관할 구역 (e.g., 'ON', 'BC', 'FED')
 */
var getLIFMaxWithdrawal = function(age, balance, cansimRate, jurisdiction) {
    if (balance <= 0) return 0;
    
    // 1. [안전장치 & 규정] 90세 이상은 최대 한도 없음 (100% 인출 가능)
    // 수학적 오류(0으로 나누기) 방지 목적 포함
    if (age >= 90) {
        return balance;
    }
    
    // 2. 금리 결정 (Reference Rate)
    // ON, BC, AB 등 대부분의 주는 'CANSIM과 6.00% 중 큰 값'을 사용
    var i = cansimRate;
    var provsWithFloor = ['ON', 'BC', 'AB', 'SK', 'MB', 'NB', 'NS', 'NL'];
    if (!jurisdiction || provsWithFloor.includes(jurisdiction)) {
        i = Math.max(cansimRate, 0.06);
    }

    // 3. 연금 계수(Factor) 계산: F = (1 - (1 + i)^-(90 - age)) / i
    var T = 90 - age;
    var factor = (1 - Math.pow(1 + i, -T)) / i;

    // 4. 최대 인출액 = 잔액 / 계수
    if (factor <= 0) return balance; // 안전장치
    return balance / factor;
};


var findOptimalAnnualStrategy = function(amountNeeded, balances, yearContext) {
    var scenario = yearContext.scenario;
    var age = yearContext.age;
    var startYear = yearContext.startYear;
    var taxParameters = yearContext.taxParameters;
    var initialIncomeBreakdown = yearContext.incomeBreakdown;

    var MAX_ITERATIONS = 3;
    var currentWithdrawalPlan = { rrsp: 0, tfsa: 0, nonReg: 0 };
    var finalTaxResult = { totalTax: 0 }; // Fix initialized prop
    var logMessage = "Plan A: Iterative solver started.";
    var result;

    for (var i = 0; i < MAX_ITERATIONS; i++) {
        var capitalGainRatio = balances.nonReg > 0 ? (balances.nonReg - (balances.nonRegACB || 0)) / balances.nonReg : 0;

        var tempIncomeBreakdown = {
            otherIncome: initialIncomeBreakdown.otherIncome || 0,
            rrspWithdrawal: currentWithdrawalPlan.rrsp,
            canadianDividend: initialIncomeBreakdown.canadianDividend || 0, // Add dividend preservation
            capitalGains: Math.max(0, capitalGainRatio) * currentWithdrawalPlan.nonReg + (initialIncomeBreakdown.capitalGains || 0)
        };

        var oasIncomeData = scenario.incomes.find(function(inc) { return inc.type === 'OAS'; });
        var oasIncome = (oasIncomeData && startYear >= oasIncomeData.startYear)
            ? oasIncomeData.amount * getInflationFactor(startYear, oasIncomeData.startYear, oasIncomeData.growthRate)
            : 0;

        var netIncomeForClawback = (tempIncomeBreakdown.otherIncome || 0) + tempIncomeBreakdown.rrspWithdrawal + tempIncomeBreakdown.capitalGains + (tempIncomeBreakdown.canadianDividend * 1.38) + oasIncome;

        var tempTaxResult = calculateTaxWithClawback({
            incomeBreakdown: tempIncomeBreakdown,
            netIncomeForClawback: netIncomeForClawback,
            oasIncome: oasIncome,
            age: age,
            taxParameters: taxParameters,
            province: scenario.settings.province
        });

        var estimatedTax = tempTaxResult.totalTax;
        var totalAmountNeeded = amountNeeded + estimatedTax;

        var totalAssets = balances.rrsp + balances.tfsa + balances.nonReg;
        var rrspRatio = totalAssets > 0 ? balances.rrsp / totalAssets : 0;
        var strategicParams = determineStrategicParameters(age, totalAssets, rrspRatio, scenario.settings.monteCarlo.riskProfile, scenario.settings.expertMode);
        var rrspBonus = strategicParams.rrspBonus;
        var tfsaPenalty = strategicParams.tfsaPenalty;

        var currentBaseIncome = scenario.incomes.reduce(function(acc, inc) {
            return (startYear >= inc.startYear && startYear <= (inc.endYear || scenario.settings.endYear ? inc.endYear : 2100) ? acc + inc.amount : acc);
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
