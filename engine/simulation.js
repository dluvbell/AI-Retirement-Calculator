// --- engine/simulation.js ---

// LIRA/LIF 및 배우자 계좌 잔액을 모두 포함하도록 재정의
const getTotalAssets = (balances) => {
    let total = balances.rrsp + balances.tfsa + balances.nonReg + balances.lira + balances.lif + balances.checking;
    if (balances.spouse_rrsp) total += balances.spouse_rrsp;
    if (balances.spouse_tfsa) total += balances.spouse_tfsa;
    if (balances.spouse_nonReg) total += balances.spouse_nonReg;
    if (balances.spouse_lira) total += balances.spouse_lira;
    if (balances.spouse_lif) total += balances.spouse_lif;
    return total;
};

const runSingleSimulation = (scenario, isMonteCarloRun = false, mcRunIndex = 0) => {
    // --- A. 초기 설정 ---
    const { startYear, endYear, birthYear, checkingMaxBalance } = scenario.settings;
    
    const baseYearForInflation = 2025; 
    const simulationScenario = deepCopy(scenario);

    // [인플레이션 적용]
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
    
    // 배우자 설정 확인
    const spouseData = scenario.settings.spouseSettings || { enabled: false };
    const hasSpouse = spouseData.enabled;
    const spouseBirthYear = spouseData.birthYear || birthYear;

    let accounts = deepCopy(scenario.settings.advancedSettings);
    
    // 기본 잔액 초기화
    let balances = {
        checking: scenario.settings.initialBalances.checking,
        rrsp: 0, tfsa: 0, nonReg: 0, lira: scenario.settings.initialBalances.lira || 0, lif: scenario.settings.initialBalances.lif || 0,
        spouse_rrsp: 0, spouse_tfsa: 0, spouse_nonReg: 0, spouse_lira: 0, spouse_lif: 0
    };

    const clientKeys = ['rrsp', 'tfsa', 'nonReg', 'lira', 'lif'];
    const spouseKeys = hasSpouse ? ['spouse_rrsp', 'spouse_tfsa', 'spouse_nonReg', 'spouse_lira', 'spouse_lif'] : [];
    const allAccountKeys = [...clientKeys, ...spouseKeys];

    if (scenario.settings.portfolio.useSimpleMode) {
        // --- 단순 모드 ---
        balances.rrsp = scenario.settings.initialBalances.rrsp;
        balances.tfsa = scenario.settings.initialBalances.tfsa;
        balances.nonReg = scenario.settings.initialBalances.nonReg;
        if(hasSpouse) {
            balances.spouse_rrsp = scenario.settings.initialBalances.spouse_rrsp || 0;
            balances.spouse_tfsa = scenario.settings.initialBalances.spouse_tfsa || 0;
            balances.spouse_nonReg = scenario.settings.initialBalances.spouse_nonReg || 0;
            balances.spouse_lira = scenario.settings.initialBalances.spouse_lira || 0;
            balances.spouse_lif = scenario.settings.initialBalances.spouse_lif || 0;
        }
        
        const simpleComposition = scenario.settings.portfolio.startComposition;
        
        allAccountKeys.forEach(acctKey => {
            const totalValue = balances[acctKey];
            const newHoldings = {};
            for (const assetKey in simpleComposition) {
                newHoldings[assetKey] = totalValue * (simpleComposition[assetKey] / 100);
            }
            
            if (!accounts[acctKey]) accounts[acctKey] = {};
            accounts[acctKey].holdings = newHoldings;
            
            // ★★★ [수정] ACB 계산 (Client vs Spouse 분리) ★★★
            if (acctKey === 'nonReg') {
                const acbRatio = (scenario.settings.initialBalances.nonRegAcbRatio || 0) / 100;
                const totalAcb = totalValue * acbRatio;
                const newAcb = {};
                for (const assetKey in simpleComposition) {
                    newAcb[assetKey] = totalAcb * (simpleComposition[assetKey] / 100);
                }
                accounts[acctKey].acb = newAcb;
            } else if (acctKey === 'spouse_nonReg') {
                // 배우자 전용 비율 사용
                const acbRatio = (scenario.settings.initialBalances.spouseNonRegAcbRatio || 0) / 100;
                const totalAcb = totalValue * acbRatio;
                const newAcb = {};
                for (const assetKey in simpleComposition) {
                    newAcb[assetKey] = totalAcb * (simpleComposition[assetKey] / 100);
                }
                accounts[acctKey].acb = newAcb;
            } else {
                accounts[acctKey].acb = {};
            }
        });

    } else {
        // --- 고급 모드 ---
        allAccountKeys.forEach(acctKey => {
            if (accounts[acctKey] && accounts[acctKey].holdings) {
                balances[acctKey] = getAccountTotal(accounts[acctKey].holdings);
            } else {
                balances[acctKey] = 0;
                if (!accounts[acctKey]) accounts[acctKey] = { holdings: {} };
            }
        });
        if (balances.lira === 0 && scenario.settings.initialBalances.lira > 0) balances.lira = scenario.settings.initialBalances.lira;
        if (balances.lif === 0 && scenario.settings.initialBalances.lif > 0) balances.lif = scenario.settings.initialBalances.lif;
    }

    if (getTotalAssets(balances) <= 0) {
        return { status: 'NO_INITIAL_FUNDS', yearlyData: [], fundDepletionYear: startYear };
    }

    const yearlyData = [];
    let fundDepletionYear = endYear + 1;
    let taxBillFromLastYear = 0;
    let tfsaWithdrawalsLastYear = 0;
    let tfsaContributionRoom = scenario.settings.initialTfsaRoom || 0;
    const prng = isMonteCarloRun ? createPRNG(scenario.settings.monteCarlo.simulationCount + mcRunIndex) : null;

    // Locked-in 설정 (Client)
    const lockedInSettings = scenario.settings.lockedIn || {};
    const conversionAge = lockedInSettings.conversionAge || 71;
    const unlockingPercent = (lockedInSettings.unlockingPercent || 0) / 100.0;
    const cansimRate = (lockedInSettings.cansimRate || 3.5) / 100.0;
    const jurisdiction = scenario.settings.province || 'ON';

    // ★★★ [신규] Locked-in 설정 (Spouse) ★★★
    const spouseLockedIn = scenario.settings.spouseLockedIn || {};
    const sConversionAge = spouseLockedIn.conversionAge || 71;
    const sUnlockingPercent = (spouseLockedIn.unlockingPercent || 0) / 100.0;

    // --- B. 연간 시뮬레이션 루프 ---
    for (let currentYear = startYear; currentYear <= endYear; currentYear++) {
        const age = currentYear - birthYear;
        const spouseAge = currentYear - spouseBirthYear;

        const startBalances = deepCopy(balances);
        
        // Inflation 적용
        const annualExpenses = simulationScenario.settings.expenses.reduce((acc, exp) => (currentYear >= exp.startYear && currentYear <= (exp.endYear || endYear) ? acc + exp.amount * getInflationFactor(currentYear, exp.startYear, (exp.growthRate || 0) / 100.0) : acc), 0);
        const annualIncomes = simulationScenario.settings.incomes.reduce((acc, inc) => (currentYear >= inc.startYear && currentYear <= (inc.endYear || endYear) ? acc + inc.amount * getInflationFactor(currentYear, inc.startYear, (inc.growthRate || 0) / 100.0) : acc), 0);
        
        // ★★★ [수정] 배우자 소득 (Timing 적용) ★★★
        let spouseAnnualIncome = 0;
        let spouseOasIncome = 0;
        if (hasSpouse) {
            const inflationFactor = getInflationFactor(currentYear, startYear, (scenario.settings.generalInflation || 0) / 100.0);
            
            // CPP (Start Age Check)
            if (spouseAge >= (spouseData.cppStartAge || 65)) {
                spouseAnnualIncome += (spouseData.cppAmount || 0) * inflationFactor;
            }
            
            // Base Income (Start/End Age Check)
            const sBaseStart = spouseData.baseIncomeStartAge || 65;
            const sBaseEnd = spouseData.baseIncomeEndAge || 95;
            if (spouseAge >= sBaseStart && spouseAge <= sBaseEnd) {
                spouseAnnualIncome += (spouseData.baseIncome || 0) * inflationFactor;
            }

            // OAS (Start Age Check)
            if (spouseAge >= (spouseData.oasStartAge || 65)) {
                spouseOasIncome = (spouseData.oasAmount || 0) * inflationFactor;
                spouseAnnualIncome += spouseOasIncome; 
            }
        }

        const oneTimeEventsThisYear = scenario.settings.oneTimeEvents.filter(e => e.year === currentYear);
        const oneTimeIncome = oneTimeEventsThisYear.reduce((acc, e) => e.type === 'income' ? acc + e.amount : acc, 0);
        const oneTimeExpense = oneTimeEventsThisYear.reduce((acc, e) => e.type === 'expense' ? acc + e.amount : acc, 0);
        
        const totalAvailableFunds = getTotalAssets(startBalances) + annualIncomes + oneTimeIncome + spouseAnnualIncome;
        const totalRequiredSpending = annualExpenses + oneTimeExpense + taxBillFromLastYear;

        if (totalAvailableFunds < totalRequiredSpending) {
            fundDepletionYear = currentYear;
            break;
        }
        
        // --- 1. LIRA -> LIF 전환 (Client) ---
        const handleLiraConversion = (liraKey, rrspKey, lifKey, currentAge, unlockPct, convAge) => {
            if (currentAge === convAge && startBalances[liraKey] > 0) {
                const totalLira = startBalances[liraKey];
                const unlockingAmount = totalLira * unlockPct;
                const lifAmount = totalLira - unlockingAmount;
                
                if (unlockingAmount > 0) {
                     accounts[rrspKey].holdings = transferHoldings(accounts[liraKey].holdings, accounts[rrspKey].holdings, unlockingAmount);
                     balances[rrspKey] += unlockingAmount;
                }
                if (lifAmount > 0) {
                    accounts[lifKey].holdings = transferHoldings(accounts[liraKey].holdings, accounts[lifKey].holdings, lifAmount);
                    balances[lifKey] += lifAmount;
                }
                accounts[liraKey].holdings = {};
                balances[liraKey] = 0;
                
                startBalances[liraKey] = 0;
                startBalances[rrspKey] += unlockingAmount;
                startBalances[lifKey] += lifAmount;
            }
        };
        
        // Client Conversion
        handleLiraConversion('lira', 'rrsp', 'lif', age, unlockingPercent, conversionAge);
        
        // ★★★ [수정] Spouse Conversion (독립 설정 사용) ★★★
        if (hasSpouse) {
            handleLiraConversion('spouse_lira', 'spouse_rrsp', 'spouse_lif', spouseAge, sUnlockingPercent, sConversionAge);
        }
        
        tfsaContributionRoom += tfsaWithdrawalsLastYear;
        const annualTfsaLimit = (scenario.settings.annualTfsaContribution || 0) * getInflationFactor(currentYear, startYear, scenario.settings.taxInflationRate / 100.0);
        tfsaContributionRoom += annualTfsaLimit;
        
        // --- 2. 의무 인출 (Mandatory) ---
        const rrifMin = getMinWithdrawal(age, startBalances.rrsp, 'rrsp');
        const lifMin = getMinWithdrawal(age, startBalances.lif, 'lif');
        
        let spouseRrifMin = 0, spouseLifMin = 0;
        if (hasSpouse) {
            spouseRrifMin = getMinWithdrawal(spouseAge, startBalances.spouse_rrsp, 'rrsp');
            spouseLifMin = getMinWithdrawal(spouseAge, startBalances.spouse_lif, 'lif');
        }

        const executeWithdrawal = (acctKey, amount) => {
            if (amount > 0 && accounts[acctKey]) {
                accounts[acctKey].holdings = withdrawProportionally(accounts[acctKey].holdings, amount);
                balances[acctKey] -= amount;
                balances.checking += amount;
                return amount;
            }
            return 0;
        };
        
        let totalWithdrawalsThisYear = { rrsp: 0, tfsa: 0, nonReg: 0, lira: 0, lif: 0, spouse_rrsp: 0, spouse_lif: 0 };

        totalWithdrawalsThisYear.rrsp += executeWithdrawal('rrsp', rrifMin);
        totalWithdrawalsThisYear.lif += executeWithdrawal('lif', lifMin);
        
        if (hasSpouse) {
            totalWithdrawalsThisYear.spouse_rrsp += executeWithdrawal('spouse_rrsp', spouseRrifMin);
            totalWithdrawalsThisYear.spouse_lif += executeWithdrawal('spouse_lif', spouseLifMin);
        }

        const totalMandatoryWithdrawal = rrifMin + lifMin + spouseRrifMin + spouseLifMin;

        // --- 3. 부족분 계산 ---
        const totalCashInflow = startBalances.checking + annualIncomes + oneTimeIncome + spouseAnnualIncome + totalMandatoryWithdrawal;
        const totalCashOutflow = totalRequiredSpending;
        const cashShortfall = Math.max(0, totalCashOutflow - totalCashInflow);
        
        let remainingShortfall = cashShortfall;

        // --- 4. 추가 인출 (Client LIF Max) ---
        if (remainingShortfall > 0 && balances.lif > 0) {
            const lifMax = getLIFMaxWithdrawal(age, startBalances.lif, cansimRate, jurisdiction);
            const lifAlreadyWithdrawn = totalWithdrawalsThisYear.lif;
            const lifRemainingRoom = Math.max(0, lifMax - lifAlreadyWithdrawn);
            
            if (lifRemainingRoom > 0) {
                const takeFromLif = Math.min(remainingShortfall, lifRemainingRoom, balances.lif);
                executeWithdrawal('lif', takeFromLif);
                totalWithdrawalsThisYear.lif += takeFromLif;
                remainingShortfall -= takeFromLif;
            }
        }

        // --- 5. 나머지 부족분 인출 (Client Only - Baseline) ---
        if (remainingShortfall > 0) {
            if (balances.tfsa > 0) {
                const take = Math.min(remainingShortfall, balances.tfsa);
                executeWithdrawal('tfsa', take);
                totalWithdrawalsThisYear.tfsa += take;
                remainingShortfall -= take;
            }
            if (remainingShortfall > 0 && balances.nonReg > 0) {
                const take = Math.min(remainingShortfall, balances.nonReg);
                if (accounts.nonReg.acb) {
                    const gainResult = calculateProportionalCapitalGains(take, accounts.nonReg.holdings, accounts.nonReg.acb);
                    accounts.nonReg.acb = gainResult.newAcb;
                }
                executeWithdrawal('nonReg', take);
                totalWithdrawalsThisYear.nonReg += take;
                remainingShortfall -= take;
            }
            if (remainingShortfall > 0 && balances.rrsp > 0) {
                const take = Math.min(remainingShortfall, balances.rrsp);
                executeWithdrawal('rrsp', take);
                totalWithdrawalsThisYear.rrsp += take;
                remainingShortfall -= take;
            }
        }
        
        tfsaWithdrawalsLastYear = totalWithdrawalsThisYear.tfsa; 
        balances.checking -= totalRequiredSpending;
        
        // --- 6. 자산 성장 ---
        let dividendIncomeThisYear = 0;
        let spouseDividendIncome = 0;
        const crashEvent = scenario.marketCrashes.find(crash => currentYear >= crash.startYear && currentYear < crash.startYear + crash.duration);
        
        allAccountKeys.forEach(acctKey => { 
            const account = accounts[acctKey];
            if (!account || !account.holdings) return;
            
            for (const assetKey in account.holdings) {
                if (account.holdings[assetKey] > 0) {
                    const assetProfile = scenario.settings.assetProfiles[assetKey];
                    if(assetProfile) {
                        const dividendAmount = account.holdings[assetKey] * (assetProfile.dividend / 100.0);
                        let capitalChange = 0;
                        
                        if (crashEvent && crashEvent.impact) {
                            // Crash Logic (Simplified for brevity)
                            const drop = (crashEvent.impact[assetKey] || 0) / 100;
                            const annualLoss = Math.pow(1 - drop, 1 / crashEvent.duration) - 1;
                            capitalChange = account.holdings[assetKey] * annualLoss;
                        } else {
                            let appreciationReturn = assetProfile.growth / 100.0;
                            if (isMonteCarloRun) {
                                appreciationReturn = generateTDistributionRandom(assetProfile.growth, assetProfile.volatility, 30, prng) / 100.0;
                            }
                            capitalChange = account.holdings[assetKey] * appreciationReturn;
                        }
                        
                        if (acctKey === 'nonReg') {
                            dividendIncomeThisYear += dividendAmount;
                            balances.checking += dividendAmount;
                            account.holdings[assetKey] += capitalChange;
                        } else if (acctKey === 'spouse_nonReg') {
                            spouseDividendIncome += dividendAmount;
                            balances.checking += dividendAmount;
                            account.holdings[assetKey] += capitalChange;
                        } else {
                            account.holdings[assetKey] += capitalChange + dividendAmount;
                        }
                    }
                }
            }
            balances[acctKey] = getAccountTotal(account.holdings);
        });

        // --- 8. 세금 계산 (간이 Income Splitting) ---
        let clientTaxableIncome = annualIncomes + totalWithdrawalsThisYear.rrsp + totalWithdrawalsThisYear.lif;
        let spouseTaxableIncome = spouseAnnualIncome + totalWithdrawalsThisYear.spouse_rrsp + totalWithdrawalsThisYear.spouse_lif;

        if (hasSpouse && age >= 65 && spouseAge >= 65) {
            const clientPension = totalWithdrawalsThisYear.rrsp + totalWithdrawalsThisYear.lif;
            // 미리보기용 단순 50% 분할
            const splitAmount = clientPension * 0.5;
            clientTaxableIncome -= splitAmount;
            spouseTaxableIncome += splitAmount;
        }

        const clientTaxParams = getTaxParametersForYear(currentYear, scenario.settings.taxInflationRate / 100.0, scenario.settings.province);
        const clientTaxResult = calculateTaxWithClawback({
            incomeBreakdown: { otherIncome: clientTaxableIncome },
            netIncomeForClawback: clientTaxableIncome,
            oasIncome: 0,
            age: age,
            taxParameters: clientTaxParams,
            province: scenario.settings.province
        });
        
        let spouseTaxBill = 0;
        if (hasSpouse) {
            const spouseTaxResult = calculateTaxWithClawback({
                incomeBreakdown: { otherIncome: spouseTaxableIncome },
                netIncomeForClawback: spouseTaxableIncome,
                oasIncome: 0,
                age: spouseAge,
                taxParameters: clientTaxParams,
                province: scenario.settings.province
            });
            spouseTaxBill = spouseTaxResult.totalTax;
        }

        taxBillFromLastYear = clientTaxResult.totalTax + spouseTaxBill;

        // --- 9. 잉여금 재투자 ---
        const temporaryMaxBalance = checkingMaxBalance + taxBillFromLastYear;
        if (balances.checking > temporaryMaxBalance) {
            let surplus = balances.checking - temporaryMaxBalance;
            const toTfsa = Math.min(surplus, tfsaContributionRoom);
            if (toTfsa > 0) {
                balances.tfsa += toTfsa;
                surplus -= toTfsa;
                tfsaContributionRoom -= toTfsa;
            }
            if (surplus > 0) {
                balances.nonReg += surplus;
            }
            balances.checking = temporaryMaxBalance;
        }
        
        // --- 10. 잔액 정리 ---
        allAccountKeys.forEach(acctKey => {
             if (balances[acctKey] < 1.0 && balances[acctKey] > 0) {
                 balances.checking += balances[acctKey];
                 balances[acctKey] = 0;
                 if(accounts[acctKey]) accounts[acctKey].holdings = {};
             }
        });

        yearlyData.push({
            year: currentYear,
            age: age,
            endTotalBalance: getTotalAssets(balances),
            taxPayable: taxBillFromLastYear,
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

// Helper: calculateProportionalCapitalGains (Simplification for preview)
const calculateProportionalCapitalGains = (amountToWithdraw, holdings, acb) => {
    const totalValue = getAccountTotal(holdings);
    if (totalValue <= 0 || amountToWithdraw <= 0) return { taxableGain: 0, newAcb: acb };
    const withdrawalRatio = amountToWithdraw / totalValue;
    const newAcb = deepCopy(acb);
    for (const asset in newAcb) {
         newAcb[asset] -= (newAcb[asset] || 0) * withdrawalRatio;
    }
    return { taxableGain: 0, newAcb }; 
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
