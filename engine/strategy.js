// --- engine/strategy.js ---

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

var RRIF_LIF_WITHDRAWAL_RATES = {
    71: 0.0528, 72: 0.0540, 73: 0.0553, 74: 0.0567, 75: 0.0582,
    76: 0.0598, 77: 0.0617, 78: 0.0636, 79: 0.0658, 80: 0.0682,
    81: 0.0708, 82: 0.0738, 83: 0.0771, 84: 0.0808, 85: 0.0851,
    86: 0.0899, 87: 0.0955, 88: 0.1021, 89: 0.1099, 90: 0.1192,
    91: 0.1306, 92: 0.1449, 93: 0.1634, 94: 0.1879, 95: 0.2000
};

var getMinWithdrawal = function(age, balance, accountType) {
    if (balance <= 0) return 0;

    var rate = 0;
    if (accountType === 'rrsp') {
        if (age < 71) return 0;
        rate = age >= 95 ? 0.20 : (RRIF_LIF_WITHDRAWAL_RATES[age] || 0);
    } else if (accountType === 'lif') {
        if (age < 55) return 0;
        if (age < 71) {
            rate = 1 / Math.max(1, 90 - age);
        } else {
            rate = age >= 95 ? 0.20 : (RRIF_LIF_WITHDRAWAL_RATES[age] || 0);
        }
    } else {
        return 0;
    }

    return balance * rate;
};

var findOptimalAnnualStrategy = function(amountNeeded, balances, yearContext) {
    var scenario = yearContext.scenario;
    var age = yearContext.age;
    var startYear = yearContext.startYear;
    var taxParameters = yearContext.taxParameters;
    var initialIncomeBreakdown = yearContext.incomeBreakdown;

    // ★★★ [신설] Solver 내부에서 배우자 소득 추산 (Simulation.js와 로직 동기화) ★★★
    var spouseSettings = scenario.settings.spouse || { hasSpouse: false };
    var hasSpouse = spouseSettings.hasSpouse;
    var spouseIncomePkg = null;

    if (hasSpouse) {
        // 인플레이션 팩터 계산
        var yearsPassed = startYear - 2025;
        var inflationFactor = Math.pow(1 + (scenario.settings.generalInflation || 0) / 100, yearsPassed);
        
        // 배우자 기초 소득 계산
        var sCpp = (spouseSettings.cppIncome || 0) * inflationFactor;
        var sPension = (spouseSettings.pensionIncome || 0) * inflationFactor;
        var sBase = (spouseSettings.baseIncome || 0) * inflationFactor;
        
        // CPP Sharing 로직 적용
        if (spouseSettings.optimizeCppSharing) {
             var myCppItem = scenario.settings.incomes.find(function(i) { return i.type === 'CPP'; });
             var myCpp = 0;
             if (myCppItem && startYear >= myCppItem.startYear && startYear <= (myCppItem.endYear || scenario.settings.endYear)) {
                 myCpp = myCppItem.amount * getInflationFactor(startYear, myCppItem.startYear, myCppItem.growthRate);
             }
             var totalCpp = myCpp + sCpp;
             sCpp = totalCpp / 2;
             // 주의: 내 CPP는 아래 'currentBaseIncome' 계산 시 자동 반영되지 않으므로 오차가 있을 수 있으나, 
             // Solver는 '한계세율'과 '비용'만 추정하면 되므로 배우자 소득 총액만 정확하면 됨.
        }

        spouseIncomePkg = {
            base: sBase + sCpp,
            rrif: sPension,
            capitalGains: 0,
            canDividend: 0,
            usDividend: 0,
            oas: 0 
        };
    }
    // ★★★ [신설] 끝 ★★★

    var MAX_ITERATIONS = 3;
    var currentWithdrawalPlan = { rrsp: 0, tfsa: 0, nonReg: 0 };
    var finalTaxResult = { totalTax: 0 }; // [수정] tax -> totalTax 속성명 통일
    var logMessage = "Plan A: Iterative solver started.";
    var result;

    for (var i = 0; i < MAX_ITERATIONS; i++) {
        var capitalGainRatio = balances.nonReg > 0 ? (balances.nonReg - (balances.nonRegACB || 0)) / balances.nonReg : 0;

        var tempIncomeBreakdown = {
            otherIncome: initialIncomeBreakdown.otherIncome || 0,
            rrspWithdrawal: currentWithdrawalPlan.rrsp,
            capitalGains: Math.max(0, capitalGainRatio) * currentWithdrawalPlan.nonReg
        };

        var oasIncomeData = scenario.incomes.find(function(inc) { return inc.type === 'OAS'; });
        var oasIncome = (oasIncomeData && startYear >= oasIncomeData.startYear)
            ? oasIncomeData.amount * getInflationFactor(startYear, oasIncomeData.startYear, oasIncomeData.growthRate)
            : 0;

        // ★★★ [수정] optimizeJointTax 사용 (부부 합산 최적화 적용) ★★★
        var clientIncomePkg = {
            base: tempIncomeBreakdown.otherIncome,
            rrif: tempIncomeBreakdown.rrspWithdrawal,
            capitalGains: tempIncomeBreakdown.capitalGains,
            canDividend: 0, // Solver 단순화를 위해 배당 제외 (오차 미미)
            usDividend: 0,
            oas: oasIncome
        };

        var tempTaxResult = optimizeJointTax({
            clientIncome: clientIncomePkg,
            spouseIncome: spouseIncomePkg, // 배우자가 없으면 null
            age: age,
            taxParameters: taxParameters,
            province: scenario.settings.province
        });

        // optimizeJointTax는 bestResult를 반환하며, 여기서 totalTax는 '본인'의 세금임.
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
        
        // ★★★ [중요] 부부 소득 분할로 인해 한계세율(MTR)이 낮아졌다면, RRSP 인출 비용이 낮아지므로 더 많이 인출하게 됨 ★★★
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
