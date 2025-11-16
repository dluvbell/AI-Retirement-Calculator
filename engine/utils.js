// --- engine/utils.js ---

function deepCopy(obj, visited) {
    if (visited === void 0) { visited = new WeakMap(); }
    if (obj === null || typeof obj !== 'object')
        return obj;
    if (visited.has(obj))
        return visited.get(obj);
    if (obj instanceof Date)
        return new Date(obj.getTime());
    if (Array.isArray(obj)) {
        var arrCopy = [];
        visited.set(obj, arrCopy);
        for (var i = 0; i < obj.length; i++)
            arrCopy[i] = deepCopy(obj[i], visited);
        return arrCopy;
    }
    var objCopy = {};
    visited.set(obj, objCopy);
    for (var key in obj) {
        if (obj.hasOwnProperty(key))
            objCopy[key] = deepCopy(obj[key], visited);
    }
    return objCopy;
}
function formatCurrency(amount, digits) {
    if (digits === void 0) { digits = 0; }
    if (amount === null || amount === undefined || isNaN(amount))
        return 'N/A';
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
}
function getInflationFactor(currentYear, startYear, inflationRate) {
    if (currentYear <= startYear)
        return 1;
    return Math.pow(1 + inflationRate / 100, currentYear - startYear);
}
function getTotalAssets(balances) {
    return (balances.rrsp || 0) + (balances.tfsa || 0) + (balances.nonReg || 0) + (balances.checking || 0);
}
function createPRNG(seed) {
    var s = seed % 2147483647;
    if (s <= 0)
        s += 2147483646;
    return function () {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}
function generateNormalRandom(mean, stddev, prng) {
    var u1 = 0, u2 = 0;
    while (u1 === 0)
        u1 = prng();
    while (u2 === 0)
        u2 = prng();
    var z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stddev + mean;
}
function generateChiSquaredRandom(degreesOfFreedom, prng) {
    var sum = 0;
    for (var i = 0; i < degreesOfFreedom; i++) {
        sum += Math.pow(generateNormalRandom(0, 1, prng), 2);
    }
    return sum;
}
function generateTDistributionRandom(mean, volatility, degreesOfFreedom, prng) {
    var z = generateNormalRandom(0, 1, prng);
    if (degreesOfFreedom <= 2) {
        var result_ = mean + z * volatility;
        if (isNaN(result_) || !isFinite(result_)) { return mean; }
        return result_;
    }
    var chiSquared = generateChiSquaredRandom(degreesOfFreedom, prng);
    if (chiSquared === 0) { return mean; }
    var t = z / Math.sqrt(chiSquared / degreesOfFreedom);
    var scale = Math.sqrt((degreesOfFreedom - 2) / degreesOfFreedom);
    var result = mean + (t * scale * volatility);
    if (isNaN(result) || !isFinite(result)) { return mean; }
    return result;
}
function calculateCurrentComposition(scenario, currentYear) {
    var startComposition = scenario.settings.portfolio.startComposition;
    var endComposition = scenario.settings.portfolio.endComposition;
    var startYear = scenario.settings.startYear;
    var endYear = scenario.settings.endYear;
    var duration = endYear - startYear;
    var progress = duration > 0 ? Math.min(1, (currentYear - startYear) / duration) : 1;
    var currentComposition = {};
    for (var asset in startComposition) {
        currentComposition[asset] = startComposition[asset] + (endComposition[asset] - startComposition[asset]) * progress;
    }
    return currentComposition;
}
function exportToCSV(data, scenarioName) {
    // [5번 요구사항] CSV 다운로드 기능 구현
    if (!data || data.length === 0) {
        console.error("No data to export.");
        return;
    }
    const headers = Object.keys(data[0]).map(key => {
        if (typeof data[0][key] === 'object' && data[0][key] !== null) {
            return Object.keys(data[0][key]).map(subKey => `${key}_${subKey}`);
        }
        return key;
    }).flat();

    const rows = data.map(row => {
        const rowData = Object.values(row).map(value => {
            if (typeof value === 'object' && value !== null) {
                return Object.values(value).join(',');
            }
            return value;
        }).flat();
        return rowData.join(',');
    });

    var csvContent = "data:text/csv;charset=utf-8," + [headers.join(',')].concat(rows).join('\n');
    var encodedUri = encodeURI(csvContent);
    var link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `results_${scenarioName.replace(/ /g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
function exportScenarioToJSON(scenario) {
    // [5번 요구사항] Export 기능 구현
    const scenarioToExport = deepCopy(scenario);
    delete scenarioToExport.id; // ID는 내보내지 않음
    var jsonString = JSON.stringify(scenarioToExport, null, 2);
    var blob = new Blob([jsonString], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    var fileName = scenario.name ? scenario.name.replace(/ /g, "_") : "scenario";
    link.download = `${fileName}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
function importScenarioFromJSON(file, onScenarioLoaded) {
    // [5번 요구사항] Import 기능 구현
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (event) {
        try {
            var importedData = JSON.parse(event.target.result);
            // 기본 시나리오 구조와 병합하여 누락된 필드를 채웁니다.
            const defaultScenario = createNewScenario("Imported");
            const mergedSettings = { ...defaultScenario.settings, ...importedData.settings };
            const finalScenario = { ...defaultScenario, ...importedData, settings: mergedSettings };
            onScenarioLoaded(finalScenario, null);
        }
        catch (error) {
            onScenarioLoaded(null, "Error parsing JSON file. Please ensure it is a valid scenario file.");
        }
    };
    reader.readAsText(file);
}
function getAccountTotal(holdings) {
    if (!holdings || typeof holdings !== 'object')
        return 0;
    return Object.values(holdings).reduce(function (sum, value) { return sum + (parseFloat(value) || 0); }, 0);
}
function getAccountComposition(holdings) {
    var total = getAccountTotal(holdings);
    if (total === 0)
        return {};
    var composition = {};
    for (var asset in holdings) {
        composition[asset] = (holdings[asset] / total) * 100;
    }
    return composition;
}
function validateScenario(scenario) {
    var errors = [];
    var s = scenario.settings;
    if (!s || !s.startYear || !s.endYear || s.startYear >= s.endYear) {
        errors.push('Simulation start/end years are invalid.');
    }
    return { isValid: errors.length === 0, errors: errors };
}

const createApiPayload = (activeScenario) => {
    const { settings } = activeScenario;

    const currentYear = new Date().getFullYear();
    const currentAge = currentYear - settings.birthYear;
    const retirementAge = settings.startYear - settings.birthYear;
    const endAge = settings.endYear - settings.birthYear;

    const assetProfiles = {};
    // ★★★ 6개 자산군을 서버 키로 매핑
    const keyMap = { 
        growth: 'stocks_growth', 
        balanced: 'stocks_balanced', 
        dividend_can: 'stocks_dividend_can', 
        dividend_us: 'stocks_dividend_us', 
        bond: 'bonds', 
        gic: 'gic' 
    };
    for (const key in settings.assetProfiles) {
        const pythonKey = keyMap[key] || key;
        assetProfiles[pythonKey] = {
            growth: (settings.assetProfiles[key].appreciation || 0) / 100.0,
            dividend: (settings.assetProfiles[key].dividendYield || 0) / 100.0,
            volatility: (settings.assetProfiles[key].volatility || 0) / 100.0
        };
    }
    
    const advanced_assets = {};
    const accountKeys = ['rrsp', 'tfsa', 'nonReg'];
    
    accountKeys.forEach(acctKey => {
        let compositionSource = {};
        if (settings.useSimpleMode) {
            compositionSource = settings.portfolio.startComposition;
        } else {
            const total = getAccountTotal(settings[acctKey].holdings);
            if (total > 0) {
                for (const assetKey in settings[acctKey].holdings) {
                    compositionSource[assetKey] = (settings[acctKey].holdings[assetKey] / total) * 100;
                }
            } else {
                 // [AI 2.0] 6개 자산군으로 수정
                 compositionSource = { growth: 100, balanced: 0, dividend_can: 0, dividend_us: 0, bond: 0, gic: 0 };
            }
        }
        
        // ★★★ 6개 자산군 비중을 API 페이로드에 맞게 수정
        advanced_assets[acctKey === 'nonReg' ? 'non_reg' : acctKey] = {
            stocks_growth: (compositionSource.growth || 0) / 100.0,
            stocks_balanced: (compositionSource.balanced || 0) / 100.0,
            stocks_dividend_can: (compositionSource.dividend_can || 0) / 100.0,
            stocks_dividend_us: (compositionSource.dividend_us || 0) / 100.0,
            bonds: (compositionSource.bond || 0) / 100.0,
            gic: (compositionSource.gic || 0) / 100.0,
        };
    });

    // ★★★ 수정된 부분: taxationType과 acb를 포함하도록 수정 ★★★
    const one_time_events = (activeScenario.oneTimeEvents || []).map(event => ({
        year: event.year - settings.birthYear,
        amount: event.amount,
        type: event.type,
        taxation_type: event.taxationType, // 서버 키 이름(snake_case)으로 전송
        acb: event.acb || 0 // acb가 없는 경우 0으로 전송
    }));

    const payload = {
        start_age: currentAge,
        retirement_age: retirementAge,
        end_age: endAge,
        
        pre_retirement_inflation: (settings.taxInflationRate || 2.5) / 100.0,
        scenario: {
            inflation: (settings.taxInflationRate || 2.0) / 100.0,
            volatility: 0.07,
            growth: 0.05
        },
        initial: {
            chequing: settings.checkingBalance,
            tfsa: getAccountTotal(settings.tfsa.holdings),
            rrsp: getAccountTotal(settings.rrsp.holdings),
            non_reg: getAccountTotal(settings.nonReg.holdings)
        },
        income_items: (activeScenario.incomes || []).map(item => ({
            type: item.customName || item.type,
            amount: item.amount,
            start_year: item.startYear - settings.birthYear,
            end_year: item.endYear - settings.birthYear,
            growth_rate: (item.growthRate || 0) / 100.0
        })),
        expense_items: (activeScenario.expenses || []).map(item => ({
            type: item.name || item.type,
            amount: item.amount,
            start_year: item.startYear - settings.birthYear,
            end_year: item.endYear - settings.birthYear,
            growth_rate: (item.growthRate || 0) / 100.0
        })),
        
        one_time_events: one_time_events,
        advanced_assets: advanced_assets,
        assets: assetProfiles,
        rebalancing: { enabled: true, frequency_years: 1 },
        runs: settings.monteCarlo.simulationCount || 1000
    };

    return payload;
};