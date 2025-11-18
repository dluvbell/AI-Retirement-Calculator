// --- simulation.js ---

// ★★★ [추가] LIRA/LIF 잔액을 포함하도록 getTotalAssets 함수 재정의 ★★★
const getTotalAssets = (balances) => {
    return balances.rrsp + balances.tfsa + balances.nonReg + balances.lira + balances.lif + balances.checking;
};
// ★★★ [추가] 끝 ★★★

// ★★★ [삭제] getRrifMinWithdrawal 로컬 함수는 strategy.js의 getMinWithdrawal로 대체됩니다. ★★★

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
    // accounts 객체는 advancedSettings의 구조를 따르지만, LIRA/LIF은 holdings가 없습니다.
    let accounts = deepCopy(scenario.settings.advancedSettings);
    
    // ★★★ [수정] balances 초기화 시 LIRA/LIF 추가 ★★★
    let balances = {
        checking: scenario.settings.initialBalances.checking,
        rrsp: 0,
        tfsa: 0,
        nonReg: 0,
        lira: scenario.settings.initialBalances.lira || 0,
        lif: scenario.settings.initialBalances.lif || 0
    };
    
    // ★★★ [추가] LIRA/LIF 홀딩스 초기화 ★★★
    // LIRA/LIF 홀딩스 구조 추가 (advancedSettings에는 없으므로 여기서 생성)
    accounts.lira = { holdings: {}, acb: {} };
    accounts.lif = { holdings: {}, acb: {} };

    if (scenario.settings.portfolio.useSimpleMode) {
        // --- 단순 모드 ---
        // initialBalances의 총액을 사용
        balances.rrsp = scenario.settings.initialBalances.rrsp;
        balances.tfsa = scenario.settings.initialBalances.tfsa;
        balances.nonReg = scenario.settings.initialBalances.nonReg;
        
        const simpleComposition = scenario.settings.portfolio.startComposition;
        ['rrsp', 'tfsa', 'nonReg', 'lira', 'lif'].forEach(acctKey => { // ★★★ [수정] LIRA/LIF 추가 ★★★
            const totalValue = balances[acctKey]; 
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
            } else if (acctKey === 'lira' || acctKey === 'lif') {
                 // LIRA/LIF는 ACB가 0
                 accounts[acctKey].acb = {};
            }
        });
    } else {
        // --- 고급 모드 ---
        // advancedSettings의 holdings 총액을 사용
        balances.rrsp = getAccountTotal(accounts.rrsp.holdings);
        balances.tfsa = getAccountTotal(accounts.tfsa.holdings);
        balances.nonReg = getAccountTotal(accounts.nonReg.holdings);
        
        // ★★★ [수정] LIRA/LIF은 initialBalances 값을 그대로 사용하며, holdings도 초기화 (고급 모드에서는 initialBalances가 우선) ★★★
        const totalLira = balances.lira;
        const totalLif = balances.lif;
        const totalHoldings = totalLira + totalLif;
        const liraComp = totalHoldings > 0 ? totalLira / totalHoldings : 0;
        const lifComp = totalHoldings > 0 ? totalLif / totalHoldings : 0;

        const assetKeys = Object.keys(accounts.rrsp.holdings); // RRSP에서 자산 목록 가져오기
        if (assetKeys.length > 0) {
            const tempComp = getAccountComposition(accounts.rrsp.holdings); // RRSP 구성을 기준으로 LIRA/LIF 배분
            
            accounts.lira.holdings = {};
            accounts.lif.holdings = {};

            for (const assetKey in tempComp) {
                const ratio = tempComp[assetKey] / 100;
                accounts.lira.holdings[assetKey] = totalLira * ratio;
                accounts.lif.holdings[assetKey] = totalLif * ratio;
            }
        }
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
        
        // ★★★ [수정] totalAvailableFunds 계산에 LIRA/LIF 포함 ★★★
        const totalAvailableFunds = startBalances.rrsp + startBalances.tfsa + startBalances.nonReg + startBalances.lira + startBalances.lif + startBalances.checking + annualIncomes + oneTimeIncome;
        const totalRequiredSpending = annualExpenses + oneTimeExpense + taxBillFromLastYear;

        if (totalAvailableFunds < totalRequiredSpending) {
            fundDepletionYear = currentYear;
            break;
        }
        
        // ★★★ [추가] LIRA -> LIF 전환 로직 (만 71세에 자동 전환) ★★★
        const conversionAge = scenario.settings.lockedIn.conversionAge || 71;
        const unlockingPercent = (scenario.settings.lockedIn.unlockingPercent || 0) / 100.0;
        
        if (age === conversionAge && startBalances.lira > 0) {
            const totalLira = startBalances.lira;
            const unlockingAmount = totalLira * unlockingPercent;
            const lifAmount = totalLira - unlockingAmount;
            
            // Unlocking (LIRA -> RRSP/TFSA/NonReg 등 유연한 계좌로 이동. RRSP로 이동한다고 가정)
            if (unlockingAmount > 0) {
                 accounts.rrsp.holdings = transferHoldings(accounts.lira.holdings, accounts.rrsp.holdings, unlockingAmount);
                 balances.rrsp += unlockingAmount;
            }
            
            // Conversion (LIRA -> LIF)
            if (lifAmount > 0) {
                accounts.lif.holdings = transferHoldings(accounts.lira.holdings, accounts.lif.holdings, lifAmount);
                balances.lif += lifAmount;
            }
            
            // LIRA 잔액 0으로 업데이트
            accounts.lira.holdings = {};
            balances.lira = 0;
            
            decisionLog.liraConversion = { 
                unlockedToRRSP: unlockingAmount, 
                convertedToLIF: lifAmount,
                totalLiraStart: totalLira
            };
        }
        // ★★★ [추가] 끝 ★★★
        
        tfsaContributionRoom += tfsaWithdrawalsLastYear;
        // [수정] 100으로 나누기
        const annualTfsaLimit = (scenario.settings.annualTfsaContribution || 0) * getInflationFactor(currentYear, startYear, scenario.settings.taxInflationRate / 100.0);
        tfsaContributionRoom += annualTfsaLimit;
        
        const totalCashInflow = startBalances.checking + annualIncomes + oneTimeIncome;
        const totalCashOutflow = totalRequiredSpending;
        const cashShortfall = totalCashOutflow - totalCashInflow;
        const baseWithdrawalTarget = Math.max(0, cashShortfall);
        
        // ★★★ [수정] 최소 인출액 계산 시 getMinWithdrawal 함수 사용 ★★★
        const rrifMin = getMinWithdrawal(age, startBalances.rrsp, 'rrsp');
        const lifMin = getMinWithdrawal(age, startBalances.lif, 'lif');
        const mandatoryWithdrawal = rrifMin + lifMin;
        
        const finalWithdrawalTarget = Math.max(baseWithdrawalTarget, mandatoryWithdrawal);
        // ★★★ [수정] 끝 ★★★

        // ★★★ [수정] totalAssets 계산에 LIRA/LIF 포함 ★★★
        const totalAssets = startBalances.rrsp + startBalances.tfsa + startBalances.nonReg + startBalances.lira + startBalances.lif;
        const rrspRatio = totalAssets > 0 ? startBalances.rrsp / totalAssets : 0;
        // [수정] 100으로 나누기
        const { rrspBonus, tfsaPenalty } = determineStrategicParameters(age, totalAssets, rrspRatio, scenario.settings.monteCarlo.riskProfile / 100.0, scenario.settings.expertMode);
        
        // [수정] 100으로 나누기
        const taxParametersForYear = getTaxParametersForYear(currentYear, scenario.settings.taxInflationRate / 100.0, scenario.settings.province);
        const baseIncomeBreakdown = { otherIncome: annualIncomes };
        const yearContext = { scenario, age, startYear: currentYear, incomeBreakdown: baseIncomeBreakdown, taxParameters: taxParametersForYear };
        yearContext.scenario.settings.rrspWithdrawalBonus = rrspBonus;
        yearContext.scenario.settings.tfsaWithdrawalPenalty = tfsaPenalty;
        
        // --- 1. 최소 인출 처리 ---
        let totalWithdrawalsThisYear = { rrsp: 0, tfsa: 0, nonReg: 0, lira: 0, lif: 0 }; // ★★★ [수정] LIRA/LIF 추가 ★★★
        
        // RRIF/LIF 최소 인출을 먼저 처리 (현금 인출로 가정)
        if (rrifMin > 0) {
             accounts.rrsp.holdings = withdrawProportionally(accounts.rrsp.holdings, rrifMin);
             balances.checking += rrifMin;
             totalWithdrawalsThisYear.rrsp += rrifMin;
        }
        if (lifMin > 0) {
             accounts.lif.holdings = withdrawProportionally(accounts.lif.holdings, lifMin);
             balances.checking += lifMin;
             totalWithdrawalsThisYear.lif += lifMin;
        }

        // --- 2. 추가 인출 최적화 (Target: finalWithdrawalTarget - mandatoryWithdrawal) ---
        const additionalWithdrawalTarget = finalWithdrawalTarget - mandatoryWithdrawal;
        
        if (additionalWithdrawalTarget > 0) {
            const decision = findOptimalAnnualStrategy(additionalWithdrawalTarget, startBalances, yearContext);
            decisionLog = decision.log;
            
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
                        for (const assetKey in account.holdings) {
                            account.holdings[assetKey] -= account.holdings[assetKey] * ratio;
                        }
                    } else if (acctKey === 'rrsp') {
                         for (const assetKey in account.holdings) {
                            account.holdings[assetKey] -= account.holdings[assetKey] * ratio;
                         }
                    } else if (acctKey === 'tfsa') {
                         for (const assetKey in account.holdings) {
                            account.holdings[assetKey] -= account.holdings[assetKey] * ratio;
                         }
                    }
                }
                balances.checking += amount;
                totalWithdrawalsThisYear[acctKey] += amount;
            }
            tfsaWithdrawalsLastYear = totalWithdrawalsThisYear.tfsa; // TFSA 인출액 업데이트
        } else {
             tfsaWithdrawalsLastYear = 0;
        }

        // 현금 흐름 정리 (Min Withdrawal, Additional Withdrawal, Income/Expense, Tax)
        balances.checking += annualIncomes + oneTimeIncome;
        balances.checking -= (annualExpenses + oneTimeExpense + taxBillFromLastYear);

        let dividendIncomeThisYear = 0;
        const crashEvent = scenario.marketCrashes.find(crash => currentYear >= crash.startYear && currentYear < crash.startYear + crash.duration);
        
        // ★★★ [수정] LIRA/LIF 계좌를 포함하여 자산 성장/배당금 계산 ★★★
        ['rrsp', 'tfsa', 'nonReg', 'lira', 'lif'].forEach(acctKey => { 
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
                            // RRSP, TFSA, LIRA, LIF 모두 세금 이연
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
        if (scenario.settings.portfolio.useSimpleMode) {
            const targetComposition = calculateCurrentComposition(scenario, currentYear);
            // ★★★ [수정] LIRA/LIF 리밸런싱 추가 ★★★
            ['rrsp', 'tfsa', 'nonReg', 'lira', 'lif'].forEach(acctKey => rebalanceAccount(acctKey, targetComposition));
        } else {
            // ★★★ [수정] LIRA/LIF 리밸런싱 추가 ★★★
            ['rrsp', 'tfsa', 'nonReg', 'lira', 'lif'].forEach(acctKey => {
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
        
        // ★★★ [수정] 세금 계산 시 LIF 인출액도 RRSP 인출액에 포함 ★★★
        const totalTaxableWithdrawal = totalWithdrawalsThisYear.rrsp + totalWithdrawalsThisYear.lif;
        
        const taxResult = calculateTaxWithClawback({
            incomeBreakdown: {
                otherIncome: taxableOtherIncome,
                rrspWithdrawal: totalTaxableWithdrawal,
                canadianDividend: dividendIncomeThisYear,
                capitalGains: taxableCapitalGains
            },
            netIncomeForClawback: taxableOtherIncome + totalTaxableWithdrawal + taxableCapitalGains + dividendIncomeThisYear * 1.38 + oasIncome,
            oasIncome: oasIncome,
            age: age,
            // [수정] 100으로 나누기
            taxParameters: getTaxParametersForYear(currentYear, scenario.settings.taxInflationRate / 100.0, scenario.settings.province),
            province: scenario.settings.province
        });
        taxBillFromLastYear = taxResult.totalTax;

        balances.checking += dividendIncomeThisYear;
        const temporaryMaxBalance = checkingMaxBalance + taxBillFromLastYear;

        // --- 잉여금 투자 ---
        if (balances.checking > temporaryMaxBalance) {
            let surplus = balances.checking - temporaryMaxBalance;
            const toTfsa = Math.min(surplus, tfsaContributionRoom);
            const targetComp = calculateCurrentComposition(scenario, currentYear);
            
            if (toTfsa > 0) {
                // TFSA 투자
                const comp = getAccountComposition(accounts.tfsa.holdings);
                const compToUse = Object.keys(comp).length > 0 ? comp : targetComp;
                
                for (const assetKey in compToUse) { 
                    accounts.tfsa.holdings[assetKey] = (accounts.tfsa.holdings[assetKey] || 0) + toTfsa * (compToUse[assetKey] / 100); 
                }
                surplus -= toTfsa;
                tfsaContributionRoom -= toTfsa;
            }
            if (surplus > 0) {
                // Non-Reg 투자
                const comp = getAccountComposition(accounts.nonReg.holdings);
                const compToUse = Object.keys(comp).length > 0 ? comp : targetComp;
                
                for (const assetKey in compToUse) {
                    const amountToAdd = surplus * (compToUse[assetKey] / 100);
                    accounts.nonReg.holdings[assetKey] = (accounts.nonReg.holdings[assetKey] || 0) + amountToAdd;
                    accounts.nonReg.acb[assetKey] = (accounts.nonReg.acb[assetKey] || 0) + amountToAdd;
                }
            }
            balances.checking = temporaryMaxBalance;
        }

        // --- 연말 잔액 업데이트 ---
        balances.rrsp = getAccountTotal(accounts.rrsp.holdings);
        balances.tfsa = getAccountTotal(accounts.tfsa.holdings);
        balances.nonReg = getAccountTotal(accounts.nonReg.holdings);
        // ★★★ [수정] LIRA/LIF 잔액 업데이트 ★★★
        balances.lira = getAccountTotal(accounts.lira.holdings);
        balances.lif = getAccountTotal(accounts.lif.holdings);
        // ★★★ [수정] 끝 ★★★
        
        yearlyData.push({
            year: currentYear,
            age: age,
            // ★★★ [수정] totalBalance 계산 시 LIRA/LIF 포함 ★★★
            startTotalBalance: getTotalAssets(startBalances),
            endTotalBalance: getTotalAssets(balances),
            startBalances: startBalances,
            endBalances: deepCopy(balances),
            startAccounts: startAccounts,
            endAccounts: deepCopy(accounts),
            // ★★★ [수정] 끝 ★★★
            taxDetails: taxResult.details,
            taxableIncomeForYear: taxResult.details.taxableIncome,
            taxableRegularIncome: taxableOtherIncome,
            totalIncome: annualIncomes + oneTimeIncome,
            totalExpense: annualExpenses + oneTimeExpense,
            taxPayable: taxBillFromLastYear,
            rrifMin: rrifMin,
            lifMin: lifMin, // ★★★ [추가] LIF 최소 인출액 로그 ★★★
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

// ★★★ [유틸리티 함수 추가] 계좌 홀딩스 간 자산 이동 ★★★
// LIRA -> LIF/RRSP 전환 시 사용
const transferHoldings = (sourceHoldings, destinationHoldings, totalAmountToTransfer) => {
    if (totalAmountToTransfer <= 0) return destinationHoldings;

    const sourceTotal = getAccountTotal(sourceHoldings);
    if (sourceTotal <= 0) return destinationHoldings;

    const ratio = totalAmountToTransfer / sourceTotal;
    const newDestinationHoldings = deepCopy(destinationHoldings);
    const assetsToRemove = [];

    for (const assetKey in sourceHoldings) {
        const amountToTransfer = sourceHoldings[assetKey] * ratio;
        
        // 목적지 계좌에 자산 추가
        newDestinationHoldings[assetKey] = (newDestinationHoldings[assetKey] || 0) + amountToTransfer;
        
        // 원천 계좌에서 자산 제거 (나머지는 LIRA에 남아 있음, 하지만 LIRA 잔액은 0으로 설정될 것)
        sourceHoldings[assetKey] -= amountToTransfer; 
        if (sourceHoldings[assetKey] < 1) assetsToRemove.push(assetKey); // 1 CAD 미만은 제거

    }
    // 원천 계좌에서 0이 된 자산 제거
    assetsToRemove.forEach(assetKey => delete sourceHoldings[assetKey]);

    return newDestinationHoldings;
};

// ★★★ [유틸리티 함수 추가] 비율에 따라 홀딩스 인출 (Min Withdrawal 전용) ★★★
const withdrawProportionally = (holdings, amountToWithdraw) => {
     const totalBefore = getAccountTotal(holdings);
     if (totalBefore <= 0 || amountToWithdraw <= 0) return holdings;
     
     const withdrawalRatio = amountToWithdraw / totalBefore;
     const newHoldings = deepCopy(holdings);
     
     for (const assetKey in newHoldings) {
          newHoldings[assetKey] -= newHoldings[assetKey] * withdrawalRatio;
     }
     return newHoldings;
};
