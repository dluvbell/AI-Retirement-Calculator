// --- engine/simulation.js ---

const getTotalAssets = (balances) => {
    return balances.rrsp + balances.tfsa + balances.nonReg + balances.lira + balances.lif + balances.checking;
};

const runSingleSimulation = (scenario, isMonteCarloRun = false, mcRunIndex = 0) => {
    const { startYear, endYear, birthYear, checkingMaxBalance } = scenario.settings;
    const baseYearForInflation = 2025; 
    const simulationScenario = deepCopy(scenario);

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
    
    let accounts = deepCopy(scenario.settings.advancedSettings);
    let balances = {
        checking: scenario.settings.initialBalances.checking,
        rrsp: 0, tfsa: 0, nonReg: 0,
        lira: scenario.settings.initialBalances.lira || 0,
        lif: scenario.settings.initialBalances.lif || 0
    };
    accounts.lira = { holdings: {}, acb: {} };
    accounts.lif = { holdings: {}, acb: {} };

    if (scenario.settings.portfolio.useSimpleMode) {
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
            accounts[acctKey].holdings = newHoldings;
            
            if (acctKey === 'nonReg') {
                const totalAcb = totalValue * (scenario.settings.initialBalances.nonRegAcbRatio / 100);
                const newAcb = {};
                for (const assetKey in simpleComposition) {
                    newAcb[assetKey] = totalAcb * (simpleComposition[assetKey] / 100);
                }
                accounts.nonReg.acb = newAcb;
            } else if (acctKey === 'lira' || acctKey === 'lif') {
                 accounts[acctKey].acb = {};
            }
        });
    } else {
        balances.rrsp = getAccountTotal(accounts.rrsp.holdings);
        balances.tfsa = getAccountTotal(accounts.tfsa.holdings);
        balances.nonReg = getAccountTotal(accounts.nonReg.holdings);
        
        const totalLira = balances.lira;
        const totalLif = balances.lif;

        const assetKeys = Object.keys(accounts.rrsp.holdings); 
        if (assetKeys.length > 0) {
            const tempComp = getAccountComposition(accounts.rrsp.holdings); 
            accounts.lira.holdings = {};
            accounts.lif.holdings = {};
            for (const assetKey in tempComp) {
                const ratio = tempComp[assetKey] / 100;
                accounts.lira.holdings[assetKey] = totalLira * ratio;
                accounts.lif.holdings[assetKey] = totalLif * ratio;
            }
        }
    }

    const spouseSettings = scenario.settings.spouse || { hasSpouse: false };
    const hasSpouse = spouseSettings.hasSpouse;
    const spouseBirthYear = spouseSettings.birthYear || birthYear;
    const spouseCppInitial = spouseSettings.cppIncome || 0;
    const spousePensionInitial = spouseSettings.pensionIncome || 0;
    const spouseBaseInitial = spouseSettings.baseIncome || 0;
    const optimizeCppSharing = spouseSettings.optimizeCppSharing || false;

    if (getTotalAssets(balances) <= 0) {
        return { status: 'NO_INITIAL_FUNDS', yearlyData: [], fundDepletionYear: startYear };
    }

    const yearlyData = [];
    let fundDepletionYear = endYear + 1;
    let taxBillFromLastYear = 0;
    let tfsaWithdrawalsLastYear = 0;
    let tfsaContributionRoom = scenario.settings.initialTfsaRoom || 0;
    const prng = isMonteCarloRun ? createPRNG(scenario.settings.monteCarlo.simulationCount + mcRunIndex) : null;

    for (let currentYear = startYear; currentYear <= endYear; currentYear++) {
        const age = currentYear - birthYear;
        const yearsPassed = currentYear - baseYearForInflation;
        const inflationFactor = Math.pow(1 + scenario.settings.generalInflation / 100, yearsPassed);

        const startBalances = deepCopy(balances);
        const startAccounts = deepCopy(accounts);
        let decisionLog = {};

        const annualExpenses = simulationScenario.settings.expenses.reduce((acc, exp) => (currentYear >= exp.startYear && currentYear <= (exp.endYear || endYear) ? acc + exp.amount * getInflationFactor(currentYear, exp.startYear, exp.growthRate) : acc), 0);
        let annualIncomes = simulationScenario.settings.incomes.reduce((acc, inc) => (currentYear >= inc.startYear && currentYear <= (inc.endYear || endYear) ? acc + inc.amount * getInflationFactor(currentYear, inc.startYear, inc.growthRate) : acc), 0);

        let spouseCpp = 0, spousePension = 0, spouseBase = 0;
        if (hasSpouse) {
            spouseCpp = spouseCppInitial * inflationFactor;
            spousePension = spousePensionInitial * inflationFactor;
            spouseBase = spouseBaseInitial * inflationFactor;

            if (optimizeCppSharing) {
                const myCppItem = simulationScenario.settings.incomes.find(i => i.type === 'CPP');
                let myCpp = 0;
                if (myCppItem && currentYear >= myCppItem.startYear && currentYear <= (myCppItem.endYear || endYear)) {
                    myCpp = myCppItem.amount * getInflationFactor(currentYear, myCppItem.startYear, myCppItem.growthRate);
                }
                const totalCppPool = myCpp + spouseCpp;
                const sharedCpp = totalCppPool / 2;
                annualIncomes += (sharedCpp - myCpp);
                spouseCpp = sharedCpp;
            }
        }

        const oneTimeEventsThisYear = scenario.settings.oneTimeEvents.filter(e => e.year === currentYear);
        const oneTimeIncome = oneTimeEventsThisYear.reduce((acc, e) => e.type === 'income' ? acc + e.amount : acc, 0);
        const oneTimeExpense = oneTimeEventsThisYear.reduce((acc, e) => e.type === 'expense' ? acc + e.amount : acc, 0);
        const totalRequiredSpending = annualExpenses + oneTimeExpense + taxBillFromLastYear;

        const conversionAge = scenario.settings.lockedIn.conversionAge || 71;
        const unlockingPercent = (scenario.settings.lockedIn.unlockingPercent || 0) / 100.0;
        
        if (age === conversionAge && startBalances.lira > 0) {
            const totalLira = startBalances.lira;
            const unlockingAmount = totalLira * unlockingPercent;
            const lifAmount = totalLira - unlockingAmount;
            
            if (unlockingAmount > 0) {
                 accounts.rrsp.holdings = transferHoldings(accounts.lira.holdings, accounts.rrsp.holdings, unlockingAmount);
                 balances.rrsp += unlockingAmount;
            }
            if (lifAmount > 0) {
                accounts.lif.holdings = transferHoldings(accounts.lira.holdings, accounts.lif.holdings, lifAmount);
                balances.lif += lifAmount;
            }
            accounts.lira.holdings = {};
            balances.lira = 0;
            
            decisionLog.liraConversion = { unlockedToRRSP: unlockingAmount, convertedToLIF: lifAmount, totalLiraStart: totalLira };
        }
        
        tfsaContributionRoom += tfsaWithdrawalsLastYear;
        const annualTfsaLimit = (scenario.settings.annualTfsaContribution || 0) * getInflationFactor(currentYear, startYear, scenario.settings.taxInflationRate / 100.0);
        tfsaContributionRoom += annualTfsaLimit;
        
        const totalCashInflow = startBalances.checking + annualIncomes + oneTimeIncome;
        const cashShortfall = totalRequiredSpending - totalCashInflow;
        const baseWithdrawalTarget = Math.max(0, cashShortfall);
        
        let rrifCalcAge = age;
        if (hasSpouse && spouseSettings.useSpouseAgeForRrif) {
            const spouseAge = currentYear - spouseBirthYear;
            if (spouseAge < age) rrifCalcAge = spouseAge;
        }

        const rrifMin = getMinWithdrawal(rrifCalcAge, startBalances.rrsp, 'rrsp');
        const lifMin = getMinWithdrawal(rrifCalcAge, startBalances.lif, 'lif');
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

        const additionalWithdrawalTarget = finalWithdrawalTarget - mandatoryWithdrawal;
        let withdrawalCapitalGain = 0;

        if (additionalWithdrawalTarget > 0) {
            const decision = findOptimalAnnualStrategy(additionalWithdrawalTarget, startBalances, yearContext);
            decisionLog = decision.log;
            
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
                    } else {
                         for (const assetKey in account.holdings) {
                            account.holdings[assetKey] -= account.holdings[assetKey] * ratio;
                         }
                    }
                }
                balances.checking += amount;
                totalWithdrawalsThisYear[acctKey] += amount;
            }
            tfsaWithdrawalsLastYear = totalWithdrawalsThisYear.tfsa; 
        } else {
             tfsaWithdrawalsLastYear = 0;
        }

        // ★★★ Safety Net (강제 인출) ★★★
        const projectedCashBalance = balances.checking + annualIncomes + oneTimeIncome - totalRequiredSpending;
        
        if (projectedCashBalance < 0) {
            let deficit = -projectedCashBalance;
            
            if (deficit > 0 && getAccountTotal(accounts.nonReg.holdings) > 0) {
                const available = getAccountTotal(accounts.nonReg.holdings);
                const toWithdraw = Math.min(available, deficit);
                
                const gainResult = calculateProportionalCapitalGains(toWithdraw, accounts.nonReg.holdings, accounts.nonReg.acb);
                withdrawalCapitalGain += gainResult.taxableGain;
                accounts.nonReg.acb = gainResult.newAcb;
                
                accounts.nonReg.holdings = withdrawProportionally(accounts.nonReg.holdings, toWithdraw);
                balances.checking += toWithdraw;
                totalWithdrawalsThisYear.nonReg += toWithdraw;
                deficit -= toWithdraw;
            }
            
            if (deficit > 0 && getAccountTotal(accounts.tfsa.holdings) > 0) {
                const available = getAccountTotal(accounts.tfsa.holdings);
                const toWithdraw = Math.min(available, deficit);
                accounts.tfsa.holdings = withdrawProportionally(accounts.tfsa.holdings, toWithdraw);
                balances.checking += toWithdraw;
                totalWithdrawalsThisYear.tfsa += toWithdraw;
                deficit -= toWithdraw;
            }
            
            if (deficit > 0 && getAccountTotal(accounts.rrsp.holdings) > 0) {
                const available = getAccountTotal(accounts.rrsp.holdings);
                const toWithdraw = Math.min(available, deficit);
                accounts.rrsp.holdings = withdrawProportionally(accounts.rrsp.holdings, toWithdraw);
                balances.checking += toWithdraw;
                totalWithdrawalsThisYear.rrsp += toWithdraw;
                deficit -= toWithdraw;
            }
        }

        balances.checking += annualIncomes + oneTimeIncome;
        balances.checking -= totalRequiredSpending;

        if (balances.checking < 0 && getTotalAssets(balances) <= 0) {
             fundDepletionYear = currentYear;
             break;
        }

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
            
            let totalSellValue = 0;
            for (const assetKey in account.holdings) {
                 const currentValue = account.holdings[assetKey] || 0;
                 const targetValue = newHoldings[assetKey] || 0;
                 if (currentValue > targetValue) {
                     totalSellValue += (currentValue - targetValue);
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
        
        let taxableOtherIncome = annualIncomes;
        let taxableCapitalGains = withdrawalCapitalGain + rebalancingCapitalGain;

        oneTimeEventsThisYear.forEach(e => {
            if (e.type === 'income') {
                if (e.taxationType === 'regularIncome') taxableOtherIncome += e.amount;
                else if (e.taxationType === 'capitalGain' && e.amount && e.acb) taxableCapitalGains += Math.max(0, e.amount - e.acb) * 0.5;
            }
        });

        const oasIncomeData = scenario.settings.incomes.find(i => i.type === 'OAS');
        const oasIncome = oasIncomeData ? oasIncomeData.amount * getInflationFactor(currentYear, oasIncomeData.startYear, oasIncomeData.growthRate / 100.0) : 0;
        
        const totalTaxableWithdrawal = totalWithdrawalsThisYear.rrsp + totalWithdrawalsThisYear.lif;
        
        const clientIncomePkg = {
            base: taxableOtherIncome,
            rrif: totalTaxableWithdrawal,
            capitalGains: taxableCapitalGains,
            canDividend: dividendIncomeThisYear,
            usDividend: 0,
            oas: oasIncome
        };

        let spouseIncomePkg = null;
        if (hasSpouse) {
            spouseIncomePkg = {
                base: spouseBase + spouseCpp,
                rrif: spousePension,
                capitalGains: 0,
                canDividend: 0,
                usDividend: 0,
                oas: 0 
            };
        }

        const taxResult = optimizeJointTax({
            clientIncome: clientIncomePkg,
            spouseIncome: spouseIncomePkg,
            age: age,
            taxParameters: taxParametersForYear,
            province: scenario.settings.province
        });
        
        taxBillFromLastYear = taxResult.totalTax;

        balances.checking += dividendIncomeThisYear;
        const temporaryMaxBalance = checkingMaxBalance + taxBillFromLastYear;

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

        balances.rrsp = getAccountTotal(accounts.rrsp.holdings);
        balances.tfsa = getAccountTotal(accounts.tfsa.holdings);
        balances.nonReg = getAccountTotal(accounts.nonReg.holdings);
        balances.lira = getAccountTotal(accounts.lira.holdings);
        balances.lif = getAccountTotal(accounts.lif.holdings);
        
        // ★★★ [수정] yearlyData의 키 이름을 utils.js/DeveloperLogTable이 기대하는 포맷(snake_case)으로 변경 ★★★
        yearlyData.push({
            year: currentYear,
            age: age,
            start_nw: getTotalAssets(startBalances),
            end_nw: getTotalAssets(balances),
            startBalances: startBalances,
            endBalances: deepCopy(balances),
            startAccounts: startAccounts,
            endAccounts: deepCopy(accounts),
            
            taxDetails: taxResult.details,
            taxableIncomeForYear: taxResult.details.taxableIncome,
            taxableRegularIncome: taxableOtherIncome,
            
            total_income: annualIncomes + oneTimeIncome,
            total_expense: annualExpenses + oneTimeExpense,
            
            // ★ [중요] 이 이름이 utils.js의 generateVerificationCSV와 일치해야 함
            tax_paid: taxBillFromLastYear,
            
            rrifMin: rrifMin,
            lifMin: lifMin, 
            oneTimeIncome: oneTimeIncome, 
            oneTimeExpense: oneTimeExpense, 
            
            // ★ [중요] utils.js는 'withdrawals'라는 이름의 객체를 찾음
            withdrawals: totalWithdrawalsThisYear,
            
            withdrawalCapitalGain: withdrawalCapitalGain,
            rebalancingCapitalGain: rebalancingCapitalGain,
            dividendIncome: dividendIncomeThisYear,
            oas_clawback: taxResult.oasClawback,
            marginalRate: taxResult.marginalRate,
            tfsaContributionRoomStart: tfsaContributionRoom - annualTfsaLimit,
            tfsaContributionRoomEnd: tfsaContributionRoom,
            decisionLog: decisionLog,
            
            // UI 호환성을 위해 balances도 추가
            balances: {
                lira: balances.lira,
                lif: balances.lif,
                rrsp: balances.rrsp,
                tfsa: balances.tfsa,
                non_reg: balances.nonReg,
                chequing: balances.checking
            }
        });
    } 

   return { status: 'SUCCESS', yearlyData, fundDepletionYear };
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
