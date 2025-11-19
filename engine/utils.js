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

    // 2. 섹션: 시뮬레이션 상세 로그 (Outputs)
    csvContent += "\n\n--- SIMULATION DETAILED LOG (OUTPUTS) ---\n";
    
    // 헤더 생성
    const headers = [
        "Year", "Age", 
        "Start Net Worth", "End Net Worth", 
        "Total Income", "Total Expense", "Tax Paid", "OAS Clawback",
        "LIRA Balance", "LIF Balance", "RRSP Balance", "TFSA Balance", "Non-Reg Balance", "Chequing Balance",
        "LIF Withdrawal", "RRSP Withdrawal", "TFSA Withdrawal", "Non-Reg Withdrawal"
    ];
    csvContent += headers.join(",") + "\n";

    // 데이터 행 생성
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

    // 다운로드 트리거
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};