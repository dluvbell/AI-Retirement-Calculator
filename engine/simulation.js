// --- engine/simulation.js ---

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
    
    // ★★★ [버그 수정] accounts가 advancedSettings를 참조하도록 수정 ★★★
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
    accounts.lira = { holdings: {}, acb: {} };
    accounts.lif = { holdings: {}, acb: {} };

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
        // --- 고급 모드 ---
        balances.rrsp = getAccountTotal(accounts.rrsp.holdings);
        balances.tfsa = getAccountTotal(accounts.tfsa.holdings);
        balances.nonReg = getAccountTotal(accounts.nonReg.holdings);
        
        const totalLira = balances.lira;
        const totalLif = balances.lif;
        const totalHoldings = totalLira + totalLif;

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

    // ★★★ [신설] 배우자 설정 데이터 추출 ★★★
    const spouseSettings = scenario.settings.spouse || { hasSpouse: false };
    const hasSpouse = spouseSettings.hasSpouse;
    const spouseBirthYear = spouseSettings.birthYear || birthYear;
    // 배우자 초기 소득 (Base Year 기준)
    const spouseCppInitial = spouseSettings.cppIncome || 0;
    const spousePensionInitial = spouseSettings.pensionIncome || 0;
    const spouseBaseInitial = spouseSettings.baseIncome || 0;
    const optimizeCppSharing = spouseSettings.optimizeCppSharing || false;

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
        const yearsPassed = currentYear - baseYearForInflation; // 2025년 기준 경과 년수
        const inflationFactor = Math.pow(1 + scenario.settings.generalInflation / 100, yearsPassed);

        const startBalances = deepCopy(balances);
        const startAccounts = deepCopy(accounts);
        let decisionLog = {};

        // 1. 지출 계산 (인플레이션 적용)
        const annualExpenses = simulationScenario.settings.expenses.reduce((acc, exp) => (currentYear >= exp.startYear && currentYear <= (exp.endYear || endYear) ? acc + exp.amount * getInflationFactor(currentYear, exp.startYear, exp.growthRate) : acc), 0);
        
        // 2. 수입 계산 (CPP Sharing 적용 전 기본값)
        // [수정] reduce 안에서 CPP 항목을 별도로 식별할 수 있어야 하므로 일단 전체 합계를 구하고 나중에 보정합니다.
        let annualIncomes = simulationScenario.settings.incomes.reduce((acc, inc) => (currentYear >= inc.startYear && currentYear <= (inc.endYear || endYear) ? acc + inc.amount * getInflationFactor(currentYear, inc.startYear, inc.growthRate) : acc), 0);

        // ★★★ [신설] 배우자 소득 및 CPP Sharing 로직 ★★★
        let spouseCpp = 0;
        let spousePension = 0;
        let spouseBase = 0;

        if (hasSpouse) {
            // 배우자 소득 인플레이션 적용
            spouseCpp = spouseCppInitial * inflationFactor;
            spousePension = spousePensionInitial * inflationFactor;
            spouseBase = spouseBaseInitial * inflationFactor;

            if (optimizeCppSharing) {
                // 내 CPP 찾기
                const myCppItem = simulationScenario.settings.incomes.find(i => i.type === 'CPP');
                let myCpp = 0;
                if (myCppItem && currentYear >= myCppItem.startYear && currentYear <= (myCppItem.endYear || endYear)) {
                    myCpp = myCppItem.amount * getInflationFactor(currentYear, myCppItem.startYear, myCppItem.growthRate);
                }

                // Sharing 계산
                const totalCppPool = myCpp + spouseCpp;
                const sharedCpp = totalCppPool / 2;

                // 내 소득 보정: (공유 후 내 CPP) - (공유 전 내 CPP) 만큼 annualIncomes에 더함 (음수일 수 있음)
                annualIncomes += (sharedCpp - myCpp);
                
                // 배우자 CPP 업데이트
                spouseCpp = sharedCpp;
            }
        }
        // ★★★ [신설] 끝 ★★★

        const oneTimeEventsThisYear = scenario.settings.oneTimeEvents.filter(e => e.year === currentYear);
        const oneTimeIncome = oneTimeEventsThisYear.reduce((acc, e) => e.type === 'income' ? acc + e.amount : acc, 0);
        const oneTimeExpense = oneTimeEventsThisYear.reduce((acc, e) => e.type === 'expense' ? acc + e.amount : acc, 0);
        
        const totalAvailableFunds = startBalances.rrsp + startBalances.tfsa + startBalances.nonReg + startBalances.lira + startBalances.lif + startBalances.checking + annualIncomes + oneTimeIncome;
        const totalRequiredSpending = annualExpenses + oneTimeExpense + taxBillFromLastYear;

        if (totalAvailableFunds < totalRequiredSpending) {
            fundDepletionYear = currentYear;
            break;
        }
        
        // ★★★ LIRA -> LIF 전환 로직 ★★★
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
            
            decisionLog.liraConversion = { 
                unlockedToRRSP: unlockingAmount, 
                convertedToLIF: lifAmount,
                totalLiraStart: totalLira
            };
        }
        
        tfsaContributionRoom += tfsaWithdrawalsLastYear;
        const annualTfsaLimit = (scenario.settings.annualTfsaContribution || 0) * getInflationFactor(currentYear, startYear, scenario.settings.taxInflationRate / 100.0);
        tfsaContributionRoom += annualTfsaLimit;
        
        const totalCashInflow = startBalances.checking + annualIncomes + oneTimeIncome;
        const totalCashOutflow = totalRequiredSpending;
        const cashShortfall = totalCashOutflow - totalCashInflow;
        const baseWithdrawalTarget = Math.max(0, cashShortfall);
        
        // ★★★ RRIF/LIF 최소 인출 계산 (배우자 나이 옵션 적용) ★★★
        let rrifCalcAge = age;
        if (hasSpouse && spouseSettings.useSpouseAgeForRrif) {
            // 배우자 나이 계산 (대략적)
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
        
        // --- 1. 최소 인출 처리 ---
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

        // --- 2. 추가 인출 최적화 ---
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
            tfsaWithdrawalsLastYear = totalWithdrawalsThisYear.tfsa; 
        } else {
             tfsaWithdrawalsLastYear = 0;
        }

        balances.checking += annualIncomes + oneTimeIncome;
        balances.checking -= (annualExpenses + oneTimeExpense + taxBillFromLastYear);

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
            const holdingsToSell = {};
            let totalSellValue = 0;
            const newHoldings = {};
             for (const assetKey in targetComp) { 
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
        
        // ★★★ [수정] 부부 합산 세금 최적화 (optimizeJointTax) 적용 ★★★
        const clientIncomePkg = {
            base: taxableOtherIncome, // annualIncomes (CPP 포함) + 기타
            rrif: totalTaxableWithdrawal, // RRSP/RRIF/LIF 인출액 (Pension Split 대상)
            capitalGains: taxableCapitalGains,
            canDividend: dividendIncomeThisYear,
            usDividend: 0, // JS에서는 US 배당 구분 안 함 (단순화)
            oas: oasIncome
        };

        let spouseIncomePkg = null;
        if (hasSpouse) {
            spouseIncomePkg = {
                base: spouseBase + spouseCpp, // 배우자 기본 소득 + CPP
                rrif: spousePension, // 배우자 연금 소득
                capitalGains: 0,
                canDividend: 0,
                usDividend: 0,
                oas: 0 // 배우자 OAS는 로직 복잡도상 0으로 가정 (필요시 추가 가능)
            };
        }

        const taxResult = optimizeJointTax({
            clientIncome: clientIncomePkg,
            spouseIncome: spouseIncomePkg,
            age: age,
            taxParameters: taxParametersForYear,
            province: scenario.settings.province
        });
        
        // ★★★ [중요] optimizeJointTax는 bestResult를 반환함. 여기서 totalTax는 'Client'의 세금임.
        // 우리는 Client의 Checking Account에서 Client의 세금만 차감하면 됨.
        taxBillFromLastYear = taxResult.totalTax;
        // ★★★ [수정] 끝 ★★★

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
            withdrawalCapitalGain: withdrawalCapitalGain,
            rebalancingCapitalGain: rebalancingCapitalGain,
            dividendIncome: dividendIncomeThisYear,
            oasClawback: taxResult.oasClawback,
            marginalRate: taxResult.marginalRate,
            tfsaContributionRoomStart: tfsaContributionRoom - annualTfsaLimit,
            tfsaContributionRoomEnd: tfsaContributionRoom,
            decisionLog: decisionLog,
        });
    } 

   return { status: 'SUCCESS', yearlyData, fundDepletionYear };
};

// ★★★ [유틸리티 함수] 계좌 홀딩스 간 자산 이동 ★★★
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

// ★★★ [유틸리티 함수] 비율에 따라 홀딩스 인출 ★★★
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
