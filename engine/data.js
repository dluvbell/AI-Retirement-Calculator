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
    simulationScenario.incomes.forEach(item => {
        if (item.startYear > baseYearForInflation) {
            const yearsToCompound = item.startYear - baseYearForInflation;
            // [수정] JS에서는 100을 나눌 필요가 없습니다 (이미 createApiPayload에서 처리됨).
            // 단, data.js의 기본값이 소수점이므로, 이 로직을 그대로 사용합니다.
            // data.js의 기본값이 2.5로 수정된 후에는 (item.growthRate || 0) / 100 로 변경해야 합니다.
            // -> data.js가 수정되었으므로 100으로 나눕니다.
            item.amount = item.amount * Math.pow(1 + (item.growthRate || 0) / 100, yearsToCompound);
        }
    });
    simulationScenario.expenses.forEach(item => {
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

        // [수정] 미리 계산된 simulationScenario 사용
        const annualExpenses = simulationScenario.expenses.reduce((acc, exp) => (currentYear >= exp.startYear && currentYear <= (exp.endYear || endYear) ? acc + exp.amount * getInflationFactor(currentYear, exp.startYear, exp.growthRate) : acc), 0);
        const annualIncomes = simulationScenario.incomes.reduce((acc, inc) => (currentYear >= inc.startYear && currentYear <= (inc.endYear || endYear) ? acc + inc.amount * getInflationFactor(currentYear, inc.startYear, inc.growthRate) : acc), 0);
        const oneTimeEventsThisYear = scenario.oneTimeEvents.filter(e => e.year === currentYear);
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
        const yearContext = { scenario, age, startYear: currentYear, incomeBrea
