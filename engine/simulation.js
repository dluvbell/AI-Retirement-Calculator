// --- simulation.js ---

const runSingleSimulation = (scenario, isMonteCarloRun = false, mcRunIndex = 0) => {
    // --- A. 초기 설정 ---
    const { startYear, endYear, birthYear, checkingMaxBalance } = scenario.settings;
    
    // ★★★ [수정] 인플레이션 기준 연도 설정 (2025년) ★★★
    const baseYearForInflation = 2025; 
    // 시뮬레이션 로직에 영향을 주지 않기 위해 시나리오 객체를 깊은 복사합니다.
    const simulationScenario = deepCopy(scenario);

    // [수정] 은퇴 시점 가치로 변환 (사용자 요청 사항 반영)
    // 2025년에 입력한 금액이 2035년에 시작된다면, 10년치 복리 적용
    // ★★★ [JS 버그 수정] scenario.settings에서 데이터를 읽도록 수정 ★★★
    simulationScenario.settings.incomes.forEach(item => {
        if (item.startYear > baseYearForInflation) {
            const yearsToCompound = item.startYear - baseYearForInflation;
            // [수정] JS에서는 100을 나눌 필요가 없습니다 (이미 createApiPayload에서 처리됨).
            // 단, data.js의 기본값이 소수점이므로, 이 로직을 그대로 사용합니다.
            // data.js의 기본값이 2.5로 수정된 후에는 (item.growthRate || 0) / 100 로 변경해야 합니다.
            // -> data.js가 수정되었으므로 100으로 나눕니다.
            item.amount = item.amount * Math.pow(1 + (item.growthRate || 0) / 100, yearsToCompound);
        }
    });
    // ★★★ [JS 버그 수정] scenario.settings에서 데이터를 읽도록 수정 ★★★
    simulationScenario.settings.expenses.forEach(item => {
        if (item.startYear > baseYearForInflation) {
            const yearsToCompound = item.startYear - baseYearForInflation;
            item.amount = item.amount * Math.pow(1 + (item.growthRate || 0) / 100, yearsToCompound);
        }
    });
    // ★★★ [수정] 끝 ★★★
    
    // ★★★ [버그 수정] accounts가 advancedSettings를 참조하도록 수정 ★★★
    let accounts = deepCopy(scenario.settings.advancedSettings);
    
    // [버그 수정] balances가 simple/advanced 모드에 따라 올바른 초기값을 갖도록 수정
    let balances = {
        checking: scenario.settings.initialBalances.checking,
        rrsp: 0,
        tfsa: 0,
        nonReg: 0
    };

    if (scenario.settings.portfolio.useSimpleMode) {
        // --- 단순 모드 ---
        // initialBalances의 총액을 사용
        balances.rrsp = scenario.settings.initialBalances.rrsp;
        balances.tfsa = scenario.settings.initialBalances.tfsa;
        balances.nonReg = scenario.settings.initialBalances.nonReg;
        
        const simpleComposition = scenario.settings.portfolio.startComposition;
        ['rrsp', 'tfsa', 'nonReg'].forEach(acctKey => {
            const totalValue = balances[acctKey]; // (수정) initialBalances 값 사용
            const newHoldings = {};
            for (const assetKey in simpleComposition) {
                newHoldings[assetKey] = totalValue * (simpleComposition[assetKey] / 100);
            }
            accounts[acctKey].holdings = newHoldings;
            
            if (acctKey === 'nonReg') {
                // (수정) initialBalances.nonRegAcbRatio 사용
                const totalAcb = totalValue * (scenario.settings.initialBalances.nonRegAcbRatio / 100);
                const newAcb = {};
                for (const assetKey in simpleComposition) {
                    newAcb[assetKey] = totalAcb * (simpleComposition[assetKey] / 100);
                }
                accounts.nonReg.acb = newAcb;
            }
        });
    } else {
        // --- 고급 모드 ---
        // advancedSettings의 holdings 총액을 사용
        balances.rrsp = getAccountTotal(accounts.rrsp.holdings);
        balances.tfsa = getAccountTotal(accounts.tfsa.holdings);
        balances.nonReg = getAccountTotal(accounts.nonReg.holdings);
    }
    // ★★★ [버그 수정] 끝 ★★★

    if (getTotalAssets(balances) <= 0) {
        return { 
            status: 'NO_INITIAL_FUNDS',
            yearlyData: [], 
            fundDepletionYear: startYear 
        };
    }

    const yearlyData = [];
    let fundDepletionYear = endYear + 1;
    let taxBillFromLastYear = 0;
    let tfsaWithdrawalsLastYear = 0;
    let tfsaContributionRoom = scenario.settings.initialTfsaRoom || 0;
    const prng = isMonteCarloRun ? createPRNG(scenario.settings.monteCarlo.simulationCount + mcRunIndex) : null;

    // --- B. 연간 시뮬레이션 루프 ---
    for (let currentYear = startYear; currentYear <= endYear; currentYear++) {
        const age = currentYear - birthYear;
        const startBalances = deepCopy(balances);
        const startAccounts = deepCopy(accounts);
        let decisionLog = {};

        // ★★★ [JS 버그 수정] scenario.settings에서 데이터를 읽도록 수정 ★★★
        const annualExpenses = simulationScenario.settings.expenses.reduce((acc, exp) => (currentYear >= exp.startYear && currentYear <= (exp.endYear || endYear) ? acc + exp.amount * getInflationFactor(currentYear, exp.startYear, exp.growthRate) : acc), 0);
        // ★★★ [JS 버그 수정] scenario.settings에서 데이터를 읽도록 수정 ★★★
        const annualIncomes = simulationScenario.settings.incomes.reduce((acc, inc) => (currentYear >= inc.startYear && currentYear <= (inc.endYear || endYear) ? acc + inc.amount * getInflationFactor(currentYear, inc.startYear, inc.growthRate) : acc), 0);
        // ★★★ [JS 버그 수정] scenario.settings에서 데이터를 읽도록 수정 ★★★
        const oneTimeEventsThisYear = scenario.settings.oneTimeEvents.filter(e => e.year === currentYear);
        const oneTimeIncome = oneTimeEventsThisYear.reduce((acc, e) => e.type === 'income' ? acc + e.amount : acc, 0);
        const oneTimeExpense = oneTimeEventsThisYear.reduce((acc, e) => e.type === 'expense' ? acc + e.amount : acc, 0);
        const totalAvailableFunds = startBalances.rrsp + startBalances.tfsa + startBalances.nonReg + startBalances.checking + annualIncomes + oneTimeIncome;
        const totalRequiredSpending = annualExpenses + oneTimeExpense + taxBillFromLastYear;

        if (totalAvailableFunds < totalRequiredSpending) {
            fundDepletionYear = currentYear;
            break;
        }

        tfsaContributionRoom += tfsaWithdrawalsLastYear;
        // [수정] 100으로 나누기
        const annualTfsaLimit = (scenario.settings.annualTfsaContribution || 0) * getInflationFactor(currentYear, startYear, scenario.settings.taxInflationRate / 100.0);
        tfsaContributionRoom += annualTfsaLimit;
        const totalCashInflow = startBalances.checking + annualIncomes + oneTimeIncome;
        const totalCashOutflow = totalRequiredSpending;
        const cashShortfall = totalCashOutflow - totalCashInflow;
        const baseWithdrawalTarget = Math.max(0, cashShortfall);
        const rrifMin = getRrifMinWithdrawal(age, startBalances.rrsp);
        const finalWithdrawalTarget = Math.max(baseWithdrawalTarget, rrifMin);

        const totalAssets = startBalances.rrsp + startBalances.tfsa + startBalances.nonReg;
        const rrspRatio = totalAssets > 0 ? startBalances.rrsp / totalAssets : 0;
        // [수정] 100으로 나누기
        const { rrspBonus, tfsaPenalty } = determineStrategicParameters(age, totalAssets, rrspRatio, scenario.settings.monteCarlo.riskProfile / 100.0, scenario.settings.expertMode);
        
        // [수정] 100으로 나누기
        const taxParametersForYear = getTaxParametersForYear(currentYear, scenario.settings.taxInflationRate / 100.0, scenario.settings.province);
        const baseIncomeBreakdown = { otherIncome: annualIncomes };
        const yearContext = { scenario, age, startYear: currentYear, incomeBreakdown: baseIncomeBreakdown, taxParameters: taxParametersForYear };
        yearContext.scenario.settings.rrspWithdrawalBonus = rrspBonus;
        yearContext.scenario.settings.tfsaWithdrawalPenalty = tfsaPenalty;
        const decision = findOptimalAnnualStrategy(finalWithdrawalTarget, startBalances, yearContext);
        decisionLog = decision.log;
        
        let totalWithdrawalsThisYear = { rrsp: 0, tfsa: 0, nonReg: 0 };
        let withdrawalCapitalGain = 0;
        for (const acctKey in decision.withdrawals) {
            const amount = Math.min(startBalances[acctKey] || 0, decision.withdrawals[acctKey]);
            if (amount <= 0) continue;
            
            const account = accounts[acctKey];
            const totalBefore = getAccountTotal(account.holdings);
            
            if (totalBefore > 0) {
                const ratio = amount / totalBefore;
                if (acctKey === 'nonReg') {
                    const gainResult = calculateProportionalCapitalGains(amount, account.holdings, account.acb);
                    withdrawalCapitalGain += gainResult.taxableGain;
                    account.acb = gainResult.newAcb;
                }
                for (const assetKey in account.holdings) {
                    account.holdings[assetKey] -= account.holdings[assetKey] * ratio;
                }
            }
            balances.checking += amount;
            totalWithdrawalsThisYear[acctKey] = amount;
        }
        tfsaWithdrawalsLastYear = totalWithdrawalsThisYear.tfsa;
        
        balances.checking += annualIncomes + oneTimeIncome;
        balances.checking -= (annualExpenses + oneTimeExpense + taxBillFromLastYear);

        let dividendIncomeThisYear = 0;
        const crashEvent = scenario.marketCrashes.find(crash => currentYear >= crash.startYear && currentYear < crash.startYear + crash.duration);
        
        ['rrsp', 'tfsa', 'nonReg'].forEach(acctKey => {
            const account = accounts[acctKey];
            if (!account || !account.holdings) return;
            for (const assetKey in account.holdings) {
                if (account.holdings[assetKey] > 0) {
                    const assetProfile = scenario.settings.assetProfiles[assetKey];
                    if(assetProfile) {
                        // [수정] 100으로 나누기
                        const dividendAmount = account.holdings[assetKey] * (assetProfile.dividend / 100.0);
                        let capitalChange = 0;
                        if (crashEvent && crashEvent.impact) {
                            const totalDropPercent = crashEvent.impact[assetKey] || 0;
                            const totalDropDecimal = totalDropPercent / 100.0;
                            const annualLossRate = Math.pow(1 - totalDropDecimal, 1 / crashEvent.duration) - 1;
                            capitalChange = account.holdings[assetKey] * annualLossRate;
                        } else {
                            // [수정] 100으로 나누기
                            let appreciationReturn = assetProfile.growth / 100.0;
                            if (isMonteCarloRun) {
                                // [수정] 100으로 나누기
                                appreciationReturn = generateTDistributionRandom(assetProfile.growth, assetProfile.volatility, 30, prng) / 100.0;
                            }
                            capitalChange = account.holdings[assetKey] * appreciationReturn;
                        }
                        if (acctKey === 'nonReg') {
                            dividendIncomeThisYear += dividendAmount;
                            account.holdings[assetKey] += capitalChange;
                        } else {
                            account.holdings[assetKey] += capitalChange + dividendAmount;
                        }
                    }
                }
            }
        });

        let rebalancingCapitalGain = 0;
        const rebalanceAccount = (acctKey, targetComp) => {
            const account = accounts[acctKey];
            if (!account || !account.holdings) return;
            const totalValue = getAccountTotal(account.holdings);
            if (totalValue === 0 || !targetComp) return;
            const threshold = scenario.settings.rebalanceThreshold || 0;
            if (threshold > 0) {
                const currentComp = getAccountComposition(account.holdings);
                let isRebalanceNeeded = false;
                for (const assetKey in targetComp) {
                    const targetPercent = targetComp[assetKey] || 0;
                    const currentPercent = currentComp[assetKey] || 0;
                    if (Math.abs(targetPercent - currentPercent) > threshold) {
                        isRebalanceNeeded = true;
                        break;
                    }
                }
                if (!isRebalanceNeeded) return;
            }
            const holdingsToSell = {};
            let totalSellValue = 0;
            const newHoldings = {};
             for (const assetKey in targetComp) { // Use targetComp to ensure all assets are covered
                newHoldings[assetKey] = totalValue * ((targetComp[assetKey] || 0) / 100);
            }
            for (const assetKey in account.holdings) {
                const currentValue = account.holdings[assetKey] || 0;
                const targetValue = newHoldings[assetKey] || 0;
                if (currentValue > targetValue) {
                    holdingsToSell[assetKey] = currentValue - targetValue;
                    totalSellValue += holdingsToSell[assetKey];
                }
            }
            if (totalSellValue > 0 && acctKey === 'nonReg') {
                const gainResult = calculateProportionalCapitalGains(totalSellValue, account.holdings, account.acb);
                rebalancingCapitalGain += gainResult.taxableGain;
                account.acb = gainResult.newAcb;
            }
            accounts[acctKey].holdings = newHoldings;
        };
        if (scenario.settings.useSimpleMode) {
            const targetComposition = calculateCurrentComposition(scenario, currentYear);
            ['rrsp', 'tfsa', 'nonReg'].forEach(acctKey => rebalanceAccount(acctKey, targetComposition));
        } else {
            ['rrsp', 'tfsa', 'nonReg'].forEach(acctKey => {
                if (accounts[acctKey] && accounts[acctKey].endComposition) {
                     const startComp = getAccountComposition(startAccounts[acctKey].holdings);
                     const endComp = accounts[acctKey].endComposition;
                     const tempScenario = { settings: { ...scenario.settings, portfolio: { startComposition: startComp, endComposition: endComp } } };
                     const targetComposition = calculateCurrentComposition(tempScenario, currentYear);
                     rebalanceAccount(acctKey, targetComposition);
                }
            });
        }
        
        let taxableOtherIncome = annualIncomes;
        let taxableCapitalGains = withdrawalCapitalGain + rebalancingCapitalGain;

        oneTimeEventsThisYear.forEach(e => {
            if (e.type === 'income') {
                if (e.taxationType === 'regularIncome') taxableOtherIncome += e.amount;
                else if (e.taxationType === 'capitalGain' && e.amount && e.acb) taxableCapitalGains += Math.max(0, e.amount - e.acb) * 0.5;
            }
        });

        // [수정] 100으로 나누기
        // ★★★ [JS 버그 수정] scenario.settings에서 데이터를 읽도록 수정 ★★★
        const oasIncomeData = scenario.settings.incomes.find(i => i.type === 'OAS');
        const oasIncome = oasIncomeData ? oasIncomeData.amount * getInflationFactor(currentYear, oasIncomeData.startYear, oasIncomeData.growthRate / 100.0) : 0;
        
        const taxResult = calculateTaxWithClawback({
            incomeBreakdown: {
                otherIncome: taxableOtherIncome,
                rrspWithdrawal: totalWithdrawalsThisYear.rrsp,
                canadianDividend: dividendIncomeThisYear,
                capitalGains: taxableCapitalGains
            },
            netIncomeForClawback: taxableOtherIncome + totalWithdrawalsThisYear.rrsp + taxableCapitalGains + dividendIncomeThisYear * 1.38 + oasIncome,
            oasIncome: oasIncome,
            age: age,
            // [수정] 100으로 나누기
            taxParameters: getTaxParametersForYear(currentYear, scenario.settings.taxInflationRate / 100.0, scenario.settings.province),
            province: scenario.settings.province
        });
        taxBillFromLastYear = taxResult.totalTax;

        balances.checking += dividendIncomeThisYear;
        const temporaryMaxBalance = checkingMaxBalance + taxBillFromLastYear;

        if (balances.checking > temporaryMaxBalance) {
            let surplus = balances.checking - temporaryMaxBalance;
            const toTfsa = Math.min(surplus, tfsaContributionRoom);
            if (toTfsa > 0) {
                const comp = getAccountComposition(accounts.tfsa.holdings);
                const targetComp = Object.keys(comp).length > 0 ? comp : calculateCurrentComposition(scenario, currentYear);
                for (const assetKey in targetComp) { accounts.tfsa.holdings[assetKey] = (accounts.tfsa.holdings[assetKey] || 0) + toTfsa * (targetComp[assetKey] / 100); }
                surplus -= toTfsa;
                tfsaContributionRoom -= toTfsa;
            }
            if (surplus > 0) {
                const comp = getAccountComposition(accounts.nonReg.holdings);
                const targetComp = Object.keys(comp).length > 0 ? comp : calculateCurrentComposition(scenario, currentYear);
                for (const assetKey in targetComp) {
                    const amountToAdd = surplus * (targetComp[assetKey] / 100);
                    accounts.nonReg.holdings[assetKey] = (accounts.nonReg.holdings[assetKey] || 0) + amountToAdd;
                    accounts.nonReg.acb[assetKey] = (accounts.nonReg.acb[assetKey] || 0) + amountToAdd;
                }
            }
            balances.checking = temporaryMaxBalance;
        }

        balances.rrsp = getAccountTotal(accounts.rrsp.holdings);
        balances.tfsa = getAccountTotal(accounts.tfsa.holdings);
        balances.nonReg = getAccountTotal(accounts.nonReg.holdings);
        
        yearlyData.push({
            year: currentYear,
            age: age,
            startTotalBalance: getTotalAssets(startBalances),
            endTotalBalance: getTotalAssets(balances),
            startBalances: startBalances,
            endBalances: deepCopy(balances),
            startAccounts: startAccounts,
            endAccounts: deepCopy(accounts),
            taxDetails: taxResult.details,
            taxableIncomeForYear: taxResult.details.taxableIncome,
            taxableRegularIncome: taxableOtherIncome,
            totalIncome: annualIncomes + oneTimeIncome,
            totalExpense: annualExpenses + oneTimeExpense,
            taxPayable: taxBillFromLastYear,
            rrifMin: rrifMin,
            totalWithdrawals: totalWithdrawalsThisYear,
            withdrawalCapitalGain: withdrawalCapitalGain,
            rebalancingCapitalGain: rebalancingCapitalGain,
            dividendIncome: dividendIncomeThisYear,
            oasClawback: taxResult.oasClawback,
            marginalTaxRate: taxResult.marginalRate,
            // [수정] 100으로 나누기
            tfsaContributionRoomStart: tfsaContributionRoom - annualTfsaLimit,
            tfsaContributionRoomEnd: tfsaContributionRoom,
            decisionLog: decisionLog,
        });
    } 

   return { status: 'SUCCESS', yearlyData, fundDepletionYear };
};