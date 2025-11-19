// --- engine/utils.js ---

/**
 * 숫자를 통화 형식 (예: $1,234.56)으로 포맷합니다.
 */
var formatCurrency = (value, decimals = 2) => {
    const num = Number(value);
    if (isNaN(num)) {
        return '$0.00';
    }
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'CAD', 
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(num);
};

/**
 * 객체나 배열을 깊은 복사(deep copy)합니다.
 */
var deepCopy = (obj, visited = new WeakMap()) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (visited.has(obj)) return visited.get(obj);
    if (obj instanceof Date) return new Date(obj.getTime());
    if (Array.isArray(obj)) {
        const arrCopy = [];
        visited.set(obj, arrCopy);
        for (let i = 0; i < obj.length; i++) arrCopy[i] = deepCopy(obj[i], visited);
        return arrCopy;
    }
    const objCopy = {};
    visited.set(obj, objCopy);
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) objCopy[key] = deepCopy(obj[key], visited);
    }
    return objCopy;
};

/**
 * 인플레이션 팩터를 계산합니다.
 */
var getInflationFactor = (currentYear, startYear, rate) => {
    if (currentYear < startYear) return 1.0;
    return Math.pow(1 + rate / 100.0, currentYear - startYear);
};

/**
 * 계좌의 총 자산 가치를 계산합니다.
 */
var getAccountTotal = (holdings) => {
    if (!holdings) return 0;
    return Object.values(holdings).reduce((sum, val) => sum + val, 0);
};

/**
 * 계좌의 자산 구성을 백분율로 반환합니다.
 */
var getAccountComposition = (holdings) => {
    const total = getAccountTotal(holdings);
    const composition = {};
    if (total === 0) return composition;
    for (const key in holdings) {
        composition[key] = (holdings[key] / total) * 100;
    }
    return composition;
};

/**
 * Glide Path에 따라 현재 연도의 목표 포트폴리오 구성을 계산합니다.
 */
var calculateCurrentComposition = (scenario, currentYear) => {
    const { startYear, endYear, portfolio } = scenario.settings;
    const { startComposition, endComposition } = portfolio;
    
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

/**
 * 몬테카를로 시뮬레이션을 위한 PRNG 생성기
 */
var createPRNG = (seed) => {
    return () => {
        seed |= 0;
        seed = (seed + 0x6D2B79F5) | 0;
        var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/**
 * T-분포 난수 생성 (변동성 적용)
 */
var generateTDistributionRandom = (mean, stdDev, df, prng) => {
    let u, v, w;
    do {
        u = 2 * prng() - 1;
        v = 2 * prng() - 1;
        w = u * u + v * v;
    } while (w >= 1 || w === 0);
    const multiplier = Math.sqrt(-2 * Math.log(w) / w);
    const z = u * multiplier; 
    
    // T-분포 근사 (df > 30이면 정규분포와 유사)
    const x = z * Math.sqrt(df / (df - 2)); 
    return mean + x * stdDev;
};

// --- [신설] JSON 파일 내보내기 ---
var exportToJSON = (data, filename) => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// --- [신설] JSON 파일 불러오기 ---
var importFromJSON = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                resolve(data);
            } catch (e) {
                reject("Invalid JSON file.");
            }
        };
        reader.onerror = () => reject("Error reading file.");
        reader.readAsText(file);
    });
};

// --- [신설] 제3자 검증용 CSV 생성 (입력값 + 결과 로그 포함) ---
var generateVerificationCSV = (scenario, resultLog, fileName) => {
    if (!resultLog || resultLog.length === 0) {
        alert("No simulation data available to export. Run the simulation first.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";

    // 1. 섹션: 시나리오 설정 정보 (Inputs)
    csvContent += "--- SCENARIO SETTINGS (INPUTS) ---\n";
    csvContent += `Scenario Name,${scenario.name}\n`;
    csvContent += `Start Year,${scenario.settings.startYear}\n`;
    csvContent += `Birth Year,${scenario.settings.birthYear}\n`;
    csvContent += `End Year,${scenario.settings.endYear}\n`;
    csvContent += `Province,${scenario.settings.province}\n`;
    
    csvContent += "\n--- INITIAL BALANCES ---\n";
    csvContent += `RRSP,${scenario.settings.initialBalances.rrsp}\n`;
    csvContent += `TFSA,${scenario.settings.initialBalances.tfsa}\n`;
    csvContent += `Non-Reg,${scenario.settings.initialBalances.nonReg}\n`;
    csvContent += `LIRA,${scenario.settings.initialBalances.lira || 0}\n`;
    csvContent += `LIF,${scenario.settings.initialBalances.lif || 0}\n`;
    csvContent += `Chequing,${scenario.settings.initialBalances.checking}\n`;

    csvContent += "\n--- LOCKED-IN SETTINGS ---\n";
    csvContent += `Conversion Age,${scenario.settings.lockedIn.conversionAge}\n`;
    csvContent += `Unlocking %,${scenario.settings.lockedIn.unlockingPercent}\n`;

    const spouse = scenario.settings.spouse || {};
    csvContent += "\n--- SPOUSE SETTINGS ---\n";
    csvContent += `Has Spouse,${spouse.hasSpouse ? 'Yes' : 'No'}\n`;
    if (spouse.hasSpouse) {
        csvContent += `Spouse Birth Year,${spouse.birthYear}\n`;
        csvContent += `Pension Income,${spouse.pensionIncome}\n`;
        csvContent += `Base Income,${spouse.baseIncome}\n`;
        csvContent += `Optimize CPP Sharing,${spouse.optimizeCppSharing ? 'Yes' : 'No'}\n`;
        csvContent += `Use Spouse Age for RRIF,${spouse.useSpouseAgeForRrif ? 'Yes' : 'No'}\n`;
    }

    // 2. 섹션: 시뮬레이션 상세 로그 (Outputs)
    csvContent += "\n\n--- SIMULATION DETAILED LOG (OUTPUTS) ---\n";
    
    const headers = [
        "Year", "Age", 
        "Start Net Worth", "End Net Worth", 
        "Total Income", "Total Expense", "Tax Paid", "OAS Clawback",
        "LIRA Balance", "LIF Balance", "RRSP Balance", "TFSA Balance", "Non-Reg Balance", "Chequing Balance",
        "LIF Withdrawal", "RRSP Withdrawal", "TFSA Withdrawal", "Non-Reg Withdrawal"
    ];
    csvContent += headers.join(",") + "\n";

    resultLog.forEach(row => {
        const bals = row.balances || {};
        const wds = row.withdrawals || {};
        
        const line = [
            row.year, row.age,
            row.start_nw, row.end_nw,
            row.total_income, row.total_expense, row.tax_paid, row.oas_clawback,
            bals.lira || 0, bals.lif || 0, bals.rrsp || 0, bals.tfsa || 0, bals.non_reg || 0, bals.chequing || 0,
            wds.lif || 0, wds.rrsp || 0, wds.tfsa || 0, wds.non_reg || 0
        ];
        csvContent += line.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// ★★★ [신설] 자산 매도 시 비례적인 양도소득(Capital Gain) 및 ACB 조정 계산 ★★★
var calculateProportionalCapitalGains = (withdrawAmount, holdings, acb) => {
    const totalValue = Object.values(holdings).reduce((sum, val) => sum + val, 0);
    if (totalValue <= 0 || withdrawAmount <= 0) {
        return { taxableGain: 0, newAcb: deepCopy(acb) };
    }

    const withdrawalRatio = withdrawAmount / totalValue;
    let totalCapitalGain = 0;
    const newAcb = deepCopy(acb);

    for (const asset in holdings) {
        const assetValue = holdings[asset];
        const assetAcb = acb[asset] || 0;
        
        // 해당 자산에서 인출되는 금액
        const assetWithdrawal = assetValue * withdrawalRatio;
        
        // 해당 자산의 ACB 감소분 (비례적)
        const acbReduction = assetAcb * withdrawalRatio;
        
        // 자본 이득 = 매도 금액 - ACB 감소분
        const capitalGain = Math.max(0, assetWithdrawal - acbReduction);
        
        totalCapitalGain += capitalGain;
        newAcb[asset] -= acbReduction;
    }

    // 과세 대상 양도소득은 50%
    return { taxableGain: totalCapitalGain * 0.5, newAcb: newAcb };
};
