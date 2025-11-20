// --- engine/simulation.js ---

// ★★★ [수정] LIRA/LIF 및 배우자 계좌 잔액을 모두 포함하도록 재정의 ★★★
const getTotalAssets = (balances) => {
    let total = balances.rrsp + balances.tfsa + balances.nonReg + balances.lira + balances.lif + balances.checking;
    // 배우자 계좌 합산
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
    
    // ★★★ [수정] 배우자 설정 확인 ★★★
    const spouseData = scenario.settings.spouseSettings || { enabled: false };
    const hasSpouse = spouseData.enabled;
    const spouseBirthYear = spouseData.birthYear || birthYear;

    let accounts = deepCopy(scenario.settings.advancedSettings);
    
    // 기본 잔액 초기화 (Client)
    let balances = {
        checking: scenario.settings.initialBalances.checking,
        rrsp: 0, tfsa: 0, nonReg: 0, lira: scenario.settings.initialBalances.lira || 0, lif: scenario.settings.initialBalances.lif || 0,
        // Spouse (초기값 0, 아래에서 채움)
        spouse_rrsp: 0, spouse_tfsa: 0, spouse_nonReg: 0, spouse_lira: 0, spouse_lif: 0
    };

    // 계좌 목록 정의
    const clientKeys = ['rrsp', 'tfsa', 'nonReg', 'lira', 'lif'];
    const spouseKeys = hasSpouse ? ['spouse_rrsp', 'spouse_tfsa', 'spouse_nonReg', 'spouse_lira', 'spouse_lif'] : [];
    const allAccountKeys = [...clientKeys, ...spouseKeys];

    if (scenario.settings.portfolio.useSimpleMode) {
        // --- 단순 모드: initialBalances에서 값 가져오기 ---
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
        
        // 모든 계좌에 동일한 포트폴리오 적용
        allAccountKeys.forEach(acctKey => {
            const totalValue = balances[acctKey];
            const newHoldings = {};
            for (const assetKey in simpleComposition) {
                newHoldings[assetKey] = totalValue * (simpleComposition[assetKey] / 100);
            }
            
            // accounts 객체에 해당 키가 없으면 생성 (Spouse용)
            if (!accounts[acctKey]) accounts[acctKey] = {};
            
            accounts[acctKey].holdings = newHoldings;
            
            if (acctKey === 'nonReg' || acctKey === 'spouse_nonReg') {
                // ACB 계산 (단순 모드 비율 적용)
                const acbRatio = scenario.settings.initialBalances.nonRegAcbRatio / 100;
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
        // --- 고급 모드: advancedSettings의 holdings 합산 ---
        allAccountKeys.forEach(acctKey => {
            if (accounts[acctKey] && accounts[acctKey].holdings) {
                balances[acctKey] = getAccountTotal(accounts[acctKey].holdings);
            } else {
                // 데이터가 없으면 초기화
                balances[acctKey] = 0;
                if (!accounts[acctKey]) accounts[acctKey] = { holdings: {} };
            }
        });
        
        // LIRA/LIF 예외 처리 (Simple Mode에서 넘어왔을 때 값이 비어있을 수 있음)
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

    // LIRA/LIF 설정
    const lockedInSettings = scenario.settings.lockedIn || {};
    const conversionAge = lockedInSettings.conversionAge || 71;
    const unlockingPercent = (lockedInSettings.unlockingPercent || 0) / 100.0;
    const cansimRate = (lockedInSettings.cansimRate || 3.5) / 100.0;
    const jurisdiction = scenario.settings.province || 'ON';

    // --- B. 연간 시뮬레이션 루프 ---
    for (let currentYear = startYear; currentYear <= endYear; currentYear++) {
        const age = currentYear - birthYear;
        const spouseAge = currentYear - spouseBirthYear; // 배우자 나이 계산

        const startBalances = deepCopy(balances);
        const startAccounts = deepCopy(accounts);
        let decisionLog = {};

        // Inflation 적용
        const annualExpenses = simulationScenario.settings.expenses.reduce((acc, exp) => (currentYear >= exp.startYear && currentYear <= (exp.endYear || endYear) ? acc + exp.amount * getInflationFactor(currentYear, exp.startYear, (exp.growthRate || 0) / 100.0) : acc), 0);
        const annualIncomes = simulationScenario.settings.incomes.reduce((acc, inc) => (currentYear >= inc.startYear && currentYear <= (inc.endYear || endYear) ? acc + inc.amount * getInflationFactor(currentYear, inc.startYear, (inc.growthRate || 0) / 100.0) : acc), 0);
        
        // 배우자 고정 소득 (CPP/OAS/Base) - Inflation 적용
        let spouseAnnualIncome = 0;
        let spouseOasIncome = 0;
        if (hasSpouse) {
            const inflationFactor = getInflationFactor(currentYear, startYear, (scenario.settings.generalInflation || 0) / 100.0);
            const s_cpp = (spouseData.cppAmount || 0) * inflationFactor;
            const s_base = (spouseData.baseIncome || 0) * inflationFactor;
            spouseAnnualIncome = s_cpp + s_base;

            if (spouseAge >= 65) {
                spouseOasIncome = (spouseData.oasAmount || 0) * inflationFactor;
                spouseAnnualIncome += spouseOasIncome; // OAS도 일단 소득에 합산 (나중에 Clawback 고려)
            }
        }

        const oneTimeEventsThisYear = scenario.settings.oneTimeEvents.filter(e => e.year === currentYear);
        const oneTimeIncome = oneTimeEventsThisYear.reduce((acc, e) => e.type === 'income' ? acc + e.amount : acc, 0);
        const oneTimeExpense = oneTimeEventsThisYear.reduce((acc, e) => e.type === 'expense' ? acc + e.amount : acc, 0);
        
        // 가용 자금 계산 (배우자 소득 포함)
        const totalAvailableFunds = getTotalAssets(startBalances) + annualIncomes + oneTimeIncome + spouseAnnualIncome;
        const totalRequiredSpending = annualExpenses + oneTimeExpense + taxBillFromLastYear;

        if (totalAvailableFunds < totalRequiredSpending) {
            fundDepletionYear = currentYear;
            break;
        }
        
        // --- 1. LIRA -> LIF 전환 (Client & Spouse) ---
        const handleLiraConversion = (liraKey, rrspKey, lifKey, currentAge) => {
            if (currentAge === conversionAge && startBalances[liraKey] > 0) {
                const totalLira = startBalances[liraKey];
                const unlockingAmount = totalLira * unlockingPercent;
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
                
                // 전환 후 잔액 업데이트
                startBalances[liraKey] = 0;
                startBalances[rrspKey] += unlockingAmount;
                startBalances[lifKey] += lifAmount;
            }
        };
        
        handleLiraConversion('lira', 'rrsp', 'lif', age);
        if (hasSpouse) handleLiraConversion('spouse_lira', 'spouse_rrsp', 'spouse_lif', spouseAge);
        
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

        // 의무 인출 실행 (자산 차감 및 Chequing 입금)
        const executeWithdrawal = (acctKey, amount) => {
            if (amount > 0 && accounts[acctKey]) {
                accounts[acctKey].holdings = withdrawProportionally(accounts[acctKey].holdings, amount);
                balances[acctKey] -= amount; // 잔액 감소
                balances.checking += amount; // 현금 증가
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

        // --- 5. 나머지 부족분 인출 (Client TFSA -> NonReg -> RRSP 순서: Baseline) ---
        // (JS 시뮬레이터는 Baseline 로직만 따릅니다. 배우자 자산 추가 인출은 복잡하여 생략)
        if (remainingShortfall > 0) {
            // TFSA
            if (balances.tfsa > 0) {
                const take = Math.min(remainingShortfall, balances.tfsa);
                executeWithdrawal('tfsa', take);
                totalWithdrawalsThisYear.tfsa += take;
                remainingShortfall -= take;
            }
            // Non-Reg
            if (remainingShortfall > 0 && balances.nonReg > 0) {
                const take = Math.min(remainingShortfall, balances.nonReg);
                
                // ACB 업데이트 (비례적 감소)
                if (accounts.nonReg.acb) {
                    const gainResult = calculateProportionalCapitalGains(take, accounts.nonReg.holdings, accounts.nonReg.acb);
                    accounts.nonReg.acb = gainResult.newAcb;
                    // JS 미리보기에서는 자본이득세 계산을 약식으로 처리
                }
                
                executeWithdrawal('nonReg', take);
                totalWithdrawalsThisYear.nonReg += take;
                remainingShortfall -= take;
            }
            // RRSP
            if (remainingShortfall > 0 && balances.rrsp > 0) {
                const take = Math.min(remainingShortfall, balances.rrsp);
                executeWithdrawal('rrsp', take);
                totalWithdrawalsThisYear.rrsp += take;
                remainingShortfall -= take;
            }
        }
        
        tfsaWithdrawalsLastYear = totalWithdrawalsThisYear.tfsa; 

        // 지출 처리
        balances.checking -= totalRequiredSpending;
        
        // 만약 그래도 부족하면? (파산) -> fundDepletionYear는 위에서 체크했으므로 여기선 잔액 마이너스 허용 or 0

        // --- 6. 자산 성장 (Asset Growth & Dividends) ---
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
                        
                        // 성장률 적용
                        if (crashEvent && crashEvent.impact) {
                            // ... (Crash 로직 생략 - 기존과 동일)
                        } else {
                            let appreciationReturn = assetProfile.growth / 100.0;
                            if (isMonteCarloRun) {
                                appreciationReturn = generateTDistributionRandom(assetProfile.growth, assetProfile.volatility, 30, prng) / 100.0;
                            }
                            capitalChange = account.holdings[assetKey] * appreciationReturn;
                        }
                        
                        // 배당금 및 성장 반영
                        if (acctKey === 'nonReg') {
                            dividendIncomeThisYear += dividendAmount;
                            balances.checking += dividendAmount; // 현금으로 들어옴
                            account.holdings[assetKey] += capitalChange;
                        } else if (acctKey === 'spouse_nonReg') {
                            spouseDividendIncome += dividendAmount;
                            balances.checking += dividendAmount; // 부부 통합 계좌로 입금
                            account.holdings[assetKey] += capitalChange;
                        } else {
                            // 등록 계좌는 재투자
                            account.holdings[assetKey] += capitalChange + dividendAmount;
                        }
                    }
                }
            }
            balances[acctKey] = getAccountTotal(account.holdings);
        });

        // --- 7. 리밸런싱 (Rebalancing) ---
        // (JS 미리보기에서는 복잡성 때문에 생략하거나 약식으로 처리. 여기서는 생략)

        // --- 8. 세금 계산 (간이 Income Splitting) ---
        let clientTaxableIncome = annualIncomes + totalWithdrawalsThisYear.rrsp + totalWithdrawalsThisYear.lif;
        // (Capital Gain 등은 약식으로 생략)

        let spouseTaxableIncome = spouseAnnualIncome + totalWithdrawalsThisYear.spouse_rrsp + totalWithdrawalsThisYear.spouse_lif;

        // [간이 Income Splitting] 
        // 둘 다 65세 이상이면, RRIF/LIF 인출액의 50%를 더 소득이 적은 쪽으로 이동 시도
        if (hasSpouse && age >= 65 && spouseAge >= 65) {
            const clientPension = totalWithdrawalsThisYear.rrsp + totalWithdrawalsThisYear.lif;
            const splitAmount = clientPension * 0.5;
            
            // 아주 단순한 로직: 무조건 50% 넘겨서 세금 계산 (정확한 최적화는 백엔드에서)
            // 실제로는 한계세율 비교가 필요하지만, JS에서는 시각적 근사치만 제공
            clientTaxableIncome -= splitAmount;
            spouseTaxableIncome += splitAmount;
        }

        // 세금 계산 (Client)
        const clientTaxParams = getTaxParametersForYear(currentYear, scenario.settings.taxInflationRate / 100.0, scenario.settings.province);
        const clientTaxResult = calculateTaxWithClawback({
            incomeBreakdown: { otherIncome: clientTaxableIncome },
            netIncomeForClawback: clientTaxableIncome, // 근사치
            oasIncome: 0, // OAS 로직은 복잡해서 제외하거나 별도 처리 필요
            age: age,
            taxParameters: clientTaxParams,
            province: scenario.settings.province
        });
        
        // 세금 계산 (Spouse) - 배우자 세금도 합산
        let spouseTaxBill = 0;
        if (hasSpouse) {
            const spouseTaxResult = calculateTaxWithClawback({
                incomeBreakdown: { otherIncome: spouseTaxableIncome },
                netIncomeForClawback: spouseTaxableIncome,
                oasIncome: 0,
                age: spouseAge,
                taxParameters: clientTaxParams, // 동일한 파라미터 사용
                province: scenario.settings.province
            });
            spouseTaxBill = spouseTaxResult.totalTax;
        }

        taxBillFromLastYear = clientTaxResult.totalTax + spouseTaxBill;

        // --- 9. 잉여금 재투자 (Surplus) ---
        const temporaryMaxBalance = checkingMaxBalance + taxBillFromLastYear;
        if (balances.checking > temporaryMaxBalance) {
            let surplus = balances.checking - temporaryMaxBalance;
            // TFSA 우선 채우기
            const toTfsa = Math.min(surplus, tfsaContributionRoom);
            if (toTfsa > 0) {
                // 비율대로 매수 (구현 생략, 잔액만 증가)
                balances.tfsa += toTfsa;
                surplus -= toTfsa;
                tfsaContributionRoom -= toTfsa;
            }
            // 남은 돈 Non-Reg로
            if (surplus > 0) {
                balances.nonReg += surplus;
            }
            balances.checking = temporaryMaxBalance;
        }
        
        // --- 10. 잔액 정리 (Cleanup) ---
        allAccountKeys.forEach(acctKey => {
             if (balances[acctKey] < 1.0 && balances[acctKey] > 0) {
                 balances.checking += balances[acctKey];
                 balances[acctKey] = 0;
                 if(accounts[acctKey]) accounts[acctKey].holdings = {};
             }
        });

        // 데이터 기록
        yearlyData.push({
            year: currentYear,
            age: age,
            endTotalBalance: getTotalAssets(balances), // 부부 합산 순자산
            taxPayable: taxBillFromLastYear,
            // ... 기타 로그 ...
        });
    } 

   return { status: 'SUCCESS', yearlyData, fundDepletionYear };
};

// --- Helper Functions (기존 유지) ---
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

// ... (나머지 헬퍼 함수들: calculateCurrentComposition, calculateProportionalCapitalGains, createPRNG, generateTDistributionRandom, determineStrategicParameters, transferHoldings, withdrawProportionally 등은 기존 코드 유지) ...
// [주의] 위 함수들은 이전 simulation.js 파일에서 그대로 가져와야 합니다.
// 여기서는 공간 관계상 생략했지만, 실제 파일에는 반드시 포함되어야 합니다.
// 특히 transferHoldings와 withdrawProportionally는 위 로직에서 사용됩니다.

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
