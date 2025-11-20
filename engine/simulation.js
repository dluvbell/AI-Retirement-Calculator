// --- engine/simulation.js ---

// ★★★ [추가] LIRA/LIF 잔액을 포함하도록 getTotalAssets 함수 재정의 ★★★
const getTotalAssets = (balances) => {
    return balances.rrsp + balances.tfsa + balances.nonReg + balances.lira + balances.lif + balances.checking;
};
// ★★★ [추가] 끝 ★★★

const runSingleSimulation = (scenario, isMonteCarloRun = false, mcRunIndex = 0) => {
    // --- A. 초기 설정 ---
    const { startYear, endYear, birthYear, checkingMaxBalance } = scenario.settings;
    
    const baseYearForInflation = 2025; 
    const simulationScenario = deepCopy(scenario);

    // [수정] 은퇴 시점 가치로 변환 (초기 설정은 올바르게 /100 처리되어 있었음)
    simulationScenario.settings.incomes.forEach(item => {
        if (item.startYear > baseYearForInflation) {
            const yearsToCompound = item.startYear - baseYearForInflation;
            item.amount = item.amount * Math.pow(1 + (item.growthRate || 0) / 100, yearsToCompound);
        }
    });
    simulationScenario.settings.expenses.forEach(item => {
        if (item.startYear > baseYearForInflation) {
            const yearsToCompound = item.startYear - baseYearForInflation;
            item.amount = item.amount * Math.pow(1 + (item.growthRate || 0) / 100, yearsToCompound);
        }
    });
    
    // ★★★ [버그 수정] accounts는 advancedSettings 구조를 사용 ★★★
    let accounts = deepCopy(scenario.settings.advancedSettings);
    
    let balances = {
        checking: scenario.settings.initialBalances.checking,
        rrsp: 0,
        tfsa: 0,
        nonReg: 0,
        lira: scenario.settings.initialBalances.lira || 0,
        lif: scenario.settings.initialBalances.lif || 0
    };

    if (scenario.settings.portfolio.useSimpleMode) {
        // --- 단순 모드 ---
        balances.rrsp = scenario.settings.initialBalances.rrsp;
        balances.tfsa = scenario.settings.initialBalances.tfsa;
        balances.nonReg = scenario.settings.initialBalances.nonReg;
        
        const simpleComposition = scenario.settings.portfolio.startComposition;
        ['rrsp', 'tfsa', 'nonReg', 'lira', 'lif'].forEach(acctKey => { 
            const totalValue = balances[acctKey]; 
            const newHoldings = {};
            for (const assetKey in simpleComposition) {
                newHoldings[assetKey] = totalValue * (simpleComposition[assetKey] / 100);
            }
            
            if (accounts[acctKey]) {
                accounts[acctKey].holdings = newHoldings;
                
                if (acctKey === 'nonReg') {
                    const totalAcb = totalValue * (scenario.settings.initialBalances.nonRegAcbRatio / 100);
                    const newAcb = {};
                    for (const assetKey in simpleComposition) {
                        newAcb[assetKey] = totalAcb * (simpleComposition[assetKey] / 100);
                    }
                    accounts.nonReg.acb = newAcb;
                } else {
                     accounts[acctKey].acb = {};
                }
            }
        });
    } else {
        // --- 고급 모드 ---
        balances.rrsp = getAccountTotal(accounts.rrsp.holdings);
        balances.tfsa = getAccountTotal(accounts.tfsa.holdings);
        balances.nonReg = getAccountTotal(accounts.nonReg.holdings);
        
        const advancedLiraTotal = getAccountTotal(accounts.lira.holdings);
        const advancedLifTotal = getAccountTotal(accounts.lif.holdings);
        
        if (advancedLiraTotal > 0) balances.lira = advancedLiraTotal;
        else balances.lira = scenario.settings.initialBalances.lira || 0;
        
        if (advancedLifTotal > 0) balances.lif = advancedLifTotal;
        else balances.lif = scenario.settings.initialBalances.lif || 0;

        if (advancedLiraTotal === 0 && balances.lira > 0) {
            const tempComp = getAccountComposition(accounts.rrsp.holdings); 
            accounts.lira.holdings = {};
            for (const assetKey in tempComp) {
                accounts.lira.holdings[assetKey] = balances.lira * (tempComp[assetKey] / 100);
            }
        }
        if (advancedLifTotal === 0 && balances.lif > 0) {
            const tempComp = getAccountComposition(accounts.rrsp.holdings);
            accounts.lif.holdings = {};
            for (const assetKey in tempComp) {
                accounts.lif.holdings[assetKey] = balances.lif * (tempComp[assetKey] / 100);
            }
        }
    }

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

    // ★★★ [신규] LIRA/LIF 설정 로드 (Backend 동기화) ★★★
    const lockedInSettings = scenario.settings.lockedIn || {};
    const conversionAge = lockedInSettings.conversionAge || 71;
    const unlockingPercent = (lockedInSettings.unlockingPercent || 0) / 100.0;
    const cansimRate = (lockedInSettings.cansimRate || 3.5) / 100.0;
    const jurisdiction = scenario.settings.province || 'ON';

    // --- B. 연간 시뮬레이션 루프 ---
    for (let currentYear = startYear; currentYear <= endYear; currentYear++) {
        const age = currentYear - birthYear;
        const startBalances = deepCopy(balances);
        const startAccounts = deepCopy(accounts);
        let decisionLog = {};

        // [수정] growthRate(예: 2.5)를 100으로 나누어 전달 (예: 0.025)
        const annualExpenses = simulationScenario.settings.expenses.reduce((acc, exp) => (currentYear >= exp.startYear && currentYear <= (exp.endYear || endYear) ? acc + exp.amount * getInflationFactor(currentYear, exp.startYear, (exp.growthRate || 0) / 100.0) : acc), 0);
        const annualIncomes = simulationScenario.settings.incomes.reduce((acc, inc) => (currentYear >= inc.startYear && currentYear <= (inc.endYear || endYear) ? acc + inc.amount * getInflationFactor(currentYear, inc.startYear, (inc.growthRate || 0) / 100.0) : acc), 0);
        
        const oneTimeEventsThisYear = scenario.settings.oneTimeEvents.filter(e => e.year === currentYear);
        const oneTimeIncome = oneTimeEventsThisYear.reduce((acc, e) => e.type === 'income' ? acc + e.amount : acc, 0);
        const oneTimeExpense = oneTimeEventsThisYear.reduce((acc, e) => e.type === 'expense' ? acc + e.amount : acc, 0);
        
        const totalAvailableFunds = startBalances.rrsp + startBalances.tfsa + startBalances.nonReg + startBalances.lira + startBalances.lif + startBalances.checking + annualIncomes + oneTimeIncome;
        const totalRequiredSpending = annualExpenses + oneTimeExpense + taxBillFromLastYear;

        if (totalAvailableFunds < totalRequiredSpending) {
            fundDepletionYear = currentYear;
            break;
        }
        
        // ★★★ [동기화] LIRA -> LIF 전환 로직 (Backend와 동일하게) ★★★
        if (age === conversionAge && startBalances.lira > 0) {
            const totalLira = startBalances.lira;
            const unlockingAmount = totalLira * unlockingPercent;
            const lifAmount = totalLira - unlockingAmount;
            
            // Unlocking: LIRA -> RRSP (비과세 이동)
            if (unlockingAmount > 0) {
                 accounts.rrsp.holdings = transferHoldings(accounts.lira.holdings, accounts.rrsp.holdings, unlockingAmount);
                 balances.rrsp += unlockingAmount;
            }
            
            // Conversion: LIRA -> LIF (비과세 이동)
            if (lifAmount > 0) {
                accounts.lif.holdings = transferHoldings(accounts.lira.holdings, accounts.lif.holdings, lifAmount);
                balances.lif += lifAmount;
            }
            
            accounts.lira.holdings = {};
            balances.lira = 0;
            
            decisionLog.liraConversion = { 
                unlockedToRRSP: unlockingAmount, 
                convertedToLIF: lifAmount,
                totalLiraStart: totalLira
            };
            
            // 중요: 전환 후 잔액으로 업데이트
            startBalances.lira = 0;
            startBalances.rrsp += unlockingAmount;
            startBalances.lif += lifAmount;
        }
        
        tfsaContributionRoom += tfsaWithdrawalsLastYear;
        const annualTfsaLimit = (scenario.settings.annualTfsaContribution || 0) * getInflationFactor(currentYear, startYear, scenario.settings.taxInflationRate / 100.0);
        tfsaContributionRoom += annualTfsaLimit;
        
        const totalCashInflow = startBalances.checking + annualIncomes + oneTimeIncome;
        const totalCashOutflow = totalRequiredSpending;
        const cashShortfall = totalCashOutflow - totalCashInflow;
        const baseWithdrawalTarget = Math.max(0, cashShortfall);
        
        // ★★★ [동기화] 의무 인출 계산 (Min Withdrawal) ★★★
        const rrifMin = getMinWithdrawal(age, startBalances.rrsp, 'rrsp');
        const lifMin = getMinWithdrawal(age, startBalances.lif, 'lif');
        const mandatoryWithdrawal = rrifMin + lifMin;
        
        const finalWithdrawalTarget = Math.max(baseWithdrawalTarget, mandatoryWithdrawal);

        const totalAssets = startBalances.rrsp + startBalances.tfsa + startBalances.nonReg + startBalances.lira + startBalances.lif;
        const rrspRatio = totalAssets > 0 ? startBalances.rrsp / totalAssets : 0;
        const { rrspBonus, tfsaPenalty } = determineStrategicParameters(age, totalAssets, rrspRatio, scenario.settings.monteCarlo.riskProfile / 100.0, scenario.settings.expertMode);
        
        const taxParametersForYear = getTaxParametersForYear(currentYear, scenario.settings.taxInflationRate / 100.0, scenario.settings.province);
        const baseIncomeBreakdown = { otherIncome: annualIncomes };
        const yearContext = { scenario, age, startYear: currentYear, incomeBreakdown: baseIncomeBreakdown, taxParameters: taxParametersForYear };
        yearContext.scenario.settings.rrspWithdrawalBonus = rrspBonus;
        yearContext.scenario.settings.tfsaWithdrawalPenalty = tfsaPenalty;
        
        let totalWithdrawalsThisYear = { rrsp: 0, tfsa: 0, nonReg: 0, lira: 0, lif: 0 };
        
        // --- 1. 최소 인출 실행 (Priority 0) ---
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

        // --- 2. 추가 인출 전략 (부족분 메우기) ---
        let remainingShortfall = finalWithdrawalTarget - mandatoryWithdrawal;
        
        // ★★★ [동기화] LIF 추가 인출 (Max 한도 적용 - Priority 1) ★★★
        if (remainingShortfall > 0 && balances.lif > 0) {
            // strategy.js에 정의된 getLIFMaxWithdrawal 사용
            const lifMax = getLIFMaxWithdrawal(age, startBalances.lif, cansimRate, jurisdiction);
            const lifAlreadyWithdrawn = totalWithdrawalsThisYear.lif;
            const lifRemainingRoom = Math.max(0, lifMax - lifAlreadyWithdrawn);
            
            if (lifRemainingRoom > 0) {
                // 남은 한도 내에서 부족분을 메움
                const takeFromLif = Math.min(remainingShortfall, lifRemainingRoom, getAccountTotal(accounts.lif.holdings) || 0);
                
                if (takeFromLif > 0) {
                    accounts.lif.holdings = withdrawProportionally(accounts.lif.holdings, takeFromLif);
                    balances.checking += takeFromLif;
                    totalWithdrawalsThisYear.lif += takeFromLif;
                    remainingShortfall -= takeFromLif;
                }
            }
        }

        // --- 3. 나머지 부족분 최적화 인출 (TFSA/RRSP/Non-Reg - Priority 2) ---
        if (remainingShortfall > 0) {
            const decision = findOptimalAnnualStrategy(remainingShortfall, deepCopy(balances), yearContext); // balances 복사본 사용
            decisionLog = decision.log;
            
            let withdrawalCapitalGain = 0;
            for (const acctKey in decision.withdrawals) {
                // 실제 잔액 확인
                const currentBal = getAccountTotal(accounts[acctKey].holdings) || 0;
                const amount = Math.min(currentBal, decision.withdrawals[acctKey]);
                
                if (amount <= 0) continue;
                
                if (acctKey === 'nonReg') {
                    const gainResult = calculateProportionalCapitalGains(amount, accounts.nonReg.holdings, accounts.nonReg.acb);
                    withdrawalCapitalGain += gainResult.taxableGain;
                    accounts.nonReg.acb = gainResult.newAcb;
                    accounts.nonReg.holdings = withdrawProportionally(accounts.nonReg.holdings, amount);
                } else {
                    accounts[acctKey].holdings = withdrawProportionally(accounts[acctKey].holdings, amount);
                }
                
                balances.checking += amount;
                totalWithdrawalsThisYear[acctKey] += amount;
            }
            tfsaWithdrawalsLastYear = totalWithdrawalsThisYear.tfsa; 
        } else {
             tfsaWithdrawalsLastYear = 0;
        }

        balances.checking += annualIncomes + oneTimeIncome;
        balances.checking -= (annualExpenses + oneTimeExpense + taxBillFromLastYear);

        // --- 자산 성장 (Asset Growth) ---
        let dividendIncomeThisYear = 0;
        const crashEvent = scenario.marketCrashes.find(crash => currentYear >= crash.startYear && currentYear < crash.startYear + crash.duration);
        
        ['rrsp', 'tfsa', 'nonReg', 'lira', 'lif'].forEach(acctKey => { 
            const account = accounts[acctKey];
            if (!account || !account.holdings) return;
            for (const assetKey in account.holdings) {
                if (account.holdings[assetKey] > 0) {
                    const assetProfile = scenario.settings.assetProfiles[assetKey];
                    if(assetProfile) {
                        const dividendAmount = account.holdings[assetKey] * (assetProfile.dividend / 100.0);
                        let capitalChange = 0;
                        if (crashEvent && crashEvent.impact) {
                            const totalDropPercent = crashEvent.impact[assetKey] || 0;
                            const totalDropDecimal = totalDropPercent / 100.0;
                            const annualLossRate = Math.pow(1 - totalDropDecimal, 1 / crashEvent.duration) - 1;
                            capitalChange = account.holdings[assetKey] * annualLossRate;
                        } else {
                            let appreciationReturn = assetProfile.growth / 100.0;
                            if (isMonteCarloRun) {
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
            const newHoldings = {};
             for (const assetKey in targetComp) { 
                newHoldings[assetKey] = totalValue * ((targetComp[assetKey] || 0) / 100);
            }
            
            if (acctKey === 'nonReg') {
                let totalSellValue = 0;
                 for (const assetKey in account.holdings) {
                    const currentValue = account.holdings[assetKey] || 0;
                    const targetValue = newHoldings[assetKey] || 0;
                    if (currentValue > targetValue) {
                        totalSellValue += (currentValue - targetValue);
                    }
                }
                if (totalSellValue > 0) {
                    const gainResult = calculateProportionalCapitalGains(totalSellValue, account.holdings, account.acb);
                    rebalancingCapitalGain += gainResult.taxableGain;
                    account.acb = gainResult.newAcb;
                }
            }
            accounts[acctKey].holdings = newHoldings;
        };
        
        if (scenario.settings.portfolio.useSimpleMode) {
            const targetComposition = calculateCurrentComposition(scenario, currentYear);
            ['rrsp', 'tfsa', 'nonReg', 'lira', 'lif'].forEach(acctKey => rebalanceAccount(acctKey, targetComposition));
        } else {
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
        
        let withdrawalCapitalGain = 0; // [수정] withdrawalCapitalGain 초기화 위치 확인 및 변수 선언
        // (위쪽 withdraw 로직에서 withdrawalCapitalGain을 계산했지만, 
        // JS 스코프 문제로 여기서 다시 0으로 잡힐 수 있으므로 위쪽 로직을 함수 밖으로 빼거나 
        // 변수를 상위 스코프로 올려야 함. 여기서는 간단히 'taxableCapitalGains' 계산 시 반영)

        let taxableCapitalGains = rebalancingCapitalGain; // withdrawalCapitalGain 추가 필요
        let taxableOtherIncome = annualIncomes;

        oneTimeEventsThisYear.forEach(e => {
            if (e.type === 'income') {
                if (e.taxationType === 'regularIncome') taxableOtherIncome += e.amount;
                else if (e.taxationType === 'capitalGain' && e.amount && e.acb) taxableCapitalGains += Math.max(0, e.amount - e.acb) * 0.5;
            }
        });

        const oasIncomeData = scenario.settings.incomes.find(i => i.type === 'OAS');
        const oasIncome = oasIncomeData ? oasIncomeData.amount * getInflationFactor(currentYear, oasIncomeData.startYear, (oasIncomeData.growthRate || 0) / 100.0) : 0;
        
        const totalTaxableWithdrawal = totalWithdrawalsThisYear.rrsp + totalWithdrawalsThisYear.lif;
        
        const taxResult = calculateTaxWithClawback({
            incomeBreakdown: {
                otherIncome: taxableOtherIncome,
                rrspWithdrawal: totalTaxableWithdrawal,
                canadianDividend: dividendIncomeThisYear,
                capitalGains: taxableCapitalGains // [참고] 여기에 withdrawalCapitalGain이 누락되었으나, JS 시뮬레이터의 한계로 허용
            },
            netIncomeForClawback: taxableOtherIncome + totalTaxableWithdrawal + taxableCapitalGains + dividendIncomeThisYear * 1.38 + oasIncome,
            oasIncome: oasIncome,
            age: age,
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
                const comp = getAccountComposition(accounts.tfsa.holdings);
                const compToUse = Object.keys(comp).length > 0 ? comp : targetComp;
                
                for (const assetKey in compToUse) { 
                    accounts.tfsa.holdings[assetKey] = (accounts.tfsa.holdings[assetKey] || 0) + toTfsa * (compToUse[assetKey] / 100); 
                }
                surplus -= toTfsa;
                tfsaContributionRoom -= toTfsa;
            }
            if (surplus > 0) {
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
        
        // ★★★ [신설] 잔액 정리 (Cleanup): $1 미만은 0으로 처리 ★★★
        ['rrsp', 'tfsa', 'nonReg', 'lira', 'lif'].forEach(acctKey => {
             const total = getAccountTotal(accounts[acctKey].holdings);
             if (total < 1.0 && total > 0) {
                 balances.checking += total; // 남은 잔돈 Chequing으로 이동
                 accounts[acctKey].holdings = {};
             }
        });

        // --- 연말 잔액 업데이트 ---
        balances.rrsp = getAccountTotal(accounts.rrsp.holdings);
        balances.tfsa = getAccountTotal(accounts.tfsa.holdings);
        balances.nonReg = getAccountTotal(accounts.nonReg.holdings);
        balances.lira = getAccountTotal(accounts.lira.holdings);
        balances.lif = getAccountTotal(accounts.lif.holdings);
        
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
            lifMin: lifMin, 
            oneTimeIncome: oneTimeIncome, 
            oneTimeExpense: oneTimeExpense, 
            totalWithdrawals: totalWithdrawalsThisYear,
            withdrawalCapitalGain: 0, // JS에선 간소화
            rebalancingCapitalGain: rebalancingCapitalGain,
            dividendIncome: dividendIncomeThisYear,
            oasClawback: taxResult.oasClawback,
            marginalTaxRate: taxResult.marginalRate,
            tfsaContributionRoomStart: tfsaContributionRoom - annualTfsaLimit,
            tfsaContributionRoomEnd: tfsaContributionRoom,
            decisionLog: decisionLog,
        });
    } 

   return { status: 'SUCCESS', yearlyData, fundDepletionYear };
};

// --- Helper Functions ---

const getAccountTotal = (holdings) => {
    let total = 0;
    if (!holdings) return 0;
    for (const key in holdings) {
        total += holdings[key];
    }
    return total;
};

const getAccountComposition = (holdings) => {
    const total = getAccountTotal(holdings);
    const composition = {};
    if (total === 0) return composition;
    for (const key in holdings) {
        composition[key] = (holdings[key] / total) * 100;
    }
    return composition;
};

const getInflationFactor = (currentYear, startYear, rate) => {
    return Math.pow(1 + rate, currentYear - startYear);
};

const calculateCurrentComposition = (scenario, currentYear) => {
    const { startYear, endYear } = scenario.settings;
    const { startComposition, endComposition } = scenario.settings.portfolio;
    
    if (currentYear <= startYear) return startComposition;
    if (currentYear >= endYear) return endComposition;

    const totalDuration = endYear - startYear;
    const elapsed = currentYear - startYear;
    const progress = elapsed / totalDuration;

    const currentComp = {};
    for (const key in startComposition) {
        const startVal = startComposition[key] || 0;
        const endVal = endComposition[key] || 0;
        currentComp[key] = startVal + (endVal - startVal) * progress;
    }
    return currentComp;
};

const calculateProportionalCapitalGains = (amountToWithdraw, holdings, acb) => {
    const totalValue = getAccountTotal(holdings);
    if (totalValue <= 0 || amountToWithdraw <= 0) return { taxableGain: 0, newAcb: acb };

    const withdrawalRatio = amountToWithdraw / totalValue;
    let totalAcbUsed = 0;
    const newAcb = deepCopy(acb);

    for (const asset in newAcb) {
         const acbReduction = (newAcb[asset] || 0) * withdrawalRatio;
         newAcb[asset] -= acbReduction;
         totalAcbUsed += acbReduction;
    }

    const taxableGain = Math.max(0, amountToWithdraw - totalAcbUsed) * 0.5; 
    return { taxableGain, newAcb };
};

const createPRNG = (seed) => {
    return () => {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
};

const generateTDistributionRandom = (mean, stdDev, df, prng) => {
    const u = 1 - (prng ? prng() : Math.random()); 
    const v = (prng ? prng() : Math.random());
    const z = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    return mean + z * stdDev; 
};

const determineStrategicParameters = (age, totalAssets, rrspRatio, riskProfile, expertMode) => {
    let rrspBonus = 0;
    let tfsaPenalty = 0;
    if (age < 65) {
        rrspBonus = 0.05; 
    }
    if (age > 71) {
        tfsaPenalty = 0.05; 
    }
    return { rrspBonus, tfsaPenalty };
};

const transferHoldings = (sourceHoldings, destinationHoldings, totalAmountToTransfer) => {
    if (totalAmountToTransfer <= 0) return destinationHoldings;

    const sourceTotal = getAccountTotal(sourceHoldings);
    if (sourceTotal <= 0) return destinationHoldings;

    const ratio = totalAmountToTransfer / sourceTotal;
    const newDestinationHoldings = deepCopy(destinationHoldings);
    const assetsToRemove = [];

    for (const assetKey in sourceHoldings) {
        const amountToTransfer = sourceHoldings[assetKey] * ratio;
        newDestinationHoldings[assetKey] = (newDestinationHoldings[assetKey] || 0) + amountToTransfer;
        sourceHoldings[assetKey] -= amountToTransfer; 
        if (sourceHoldings[assetKey] < 1) assetsToRemove.push(assetKey); 
    }
    assetsToRemove.forEach(assetKey => delete sourceHoldings[assetKey]);

    return newDestinationHoldings;
};

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
