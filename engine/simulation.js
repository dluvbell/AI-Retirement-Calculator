// --- engine/data.js ---

/**
 * 이 파일은 앱의 '기본 상태(Default State)'와 '데이터 변환(Data Transformation)'을 담당합니다.
 * 사용자가 '새 시나리오'를 추가할 때 사용되는 템플릿입니다.
 */

// [AI 2.0] 6개 자산군 정의 (JS 프론트엔드용 키)
const ASSET_KEYS = ['growth', 'balanced', 'dividend_can', 'dividend_us', 'bond', 'gic'];

// 1. 기본 자산 프로파일 (6개 자산군)
const DEFAULT_ASSET_PROFILES = {
    growth: { name: 'Growth Stocks', growth: 8.0, dividend: 0.5, volatility: 18.0, dividend_growth: 5.0 },
    balanced: { name: 'Balanced Stocks', growth: 5.0, dividend: 1.5, volatility: 12.0, dividend_growth: 4.0 },
    dividend_can: { name: 'CAN Dividend', growth: 3.0, dividend: 4.0, volatility: 10.0, dividend_growth: 3.0 },
    dividend_us: { name: 'US Dividend', growth: 4.0, dividend: 3.0, volatility: 11.0, dividend_growth: 3.0 },
    bond: { name: 'Bonds', growth: 1.0, dividend: 2.5, volatility: 5.0, dividend_growth: 0.0 },
    gic: { name: 'GIC/Cash', growth: 0.0, dividend: 2.0, volatility: 0.1, dividend_growth: 0.0 }
};


// 2. 기본 포트폴리오 (6개 자산군)
const DEFAULT_PORTFOLIO = {
    useSimpleMode: true,
    // 간단 모드 (글라이드패스)
    startComposition: {
        growth: 50.0,
        balanced: 10.0,
        dividend_can: 0.0,
        dividend_us: 0.0,
        bond: 40.0,
        gic: 0.0
    },
    endComposition: {
        growth: 30.0,
        balanced: 10.0,
        dividend_can: 0.0,
        dividend_us: 0.0,
        bond: 50.0,
        gic: 10.0
    }
};

// 3. 기본 고급 설정 (6개 자산군)
const DEFAULT_ADVANCED_SETTINGS = {
    tfsa: {
        override: false,
        holdings: { growth: 60000, balanced: 10000, dividend_can: 0, dividend_us: 0, bond: 30000, gic: 0 },
        acb: { growth: 0, balanced: 0, dividend_can: 0, dividend_us: 0, bond: 0, gic: 0 }
    },
    rrsp: {
        override: false,
        holdings: { growth: 120000, balanced: 20000, dividend_can: 0, dividend_us: 0, bond: 60000, gic: 0 },
        acb: { growth: 0, balanced: 0, dividend_can: 0, dividend_us: 0, bond: 0, gic: 0 }
    },
    nonReg: {
        override: false,
        holdings: { growth: 200000, balanced: 50000, dividend_can: 0, dividend_us: 0, bond: 50000, gic: 0 },
        acb: { growth: 150000, balanced: 40000, dividend_can: 0, dividend_us: 0, bond: 45000, gic: 0 }
    }
};

// 4. 기본 수입 및 지출
const DEFAULT_INCOMES = [
    { id: 1, type: 'CPP', amount: 15000, startYear: 2050, endYear: 2085, growthRate: 2.5 },
    { id: 2, type: 'OAS', amount: 8000, startYear: 2050, endYear: 2085, growthRate: 2.5 }
];

const DEFAULT_EXPENSES = [
    { id: 1, type: 'Living Expenses', amount: 50000, startYear: 2035, endYear: 2085, growthRate: 2.5 }
];

// 5. 기본 일회성 이벤트
const DEFAULT_ONE_TIME_EVENTS = [
    { 
        id: 1, 
        year: 2040, 
        amount: 250000, 
        type: 'income', 
        name: 'Inheritance',
        taxationType: 'nonTaxable', 
        acb: 0 
    },
    { 
        id: 2, 
        year: 2045, 
        amount: 50000, 
        type: 'expense', 
        name: 'Car Purchase',
        taxationType: 'n/a', 
        acb: 0 
    }
];

// 6. 몬테카를로 설정
const DEFAULT_MONTE_CARLO = {
    simulationCount: 1000
};

// LIRA/LIF 설정 기본값
const DEFAULT_LOCKED_IN_SETTINGS = {
    conversionAge: 71,       
    unlockingPercent: 50.0,  
    cansimRate: 3.5          
};

// ★★★ [신설] 배우자 설정 기본값 ★★★
const DEFAULT_SPOUSE_SETTINGS = {
    hasSpouse: false,
    birthYear: 1980,
    cppIncome: 0,
    pensionIncome: 0,
    baseIncome: 0,
    optimizeCppSharing: false,
    useSpouseAgeForRrif: false
};

/**
 * 새 시나리오 객체를 생성하는 팩토리 함수
 */
var createNewScenario = (name) => {
    const currentYear = new Date().getFullYear();
    const birthYear = 1980;
    const startYear = 2035; 
    const lifeExpectancy = 95; 
    const endYear = birthYear + lifeExpectancy;

    return {
        id: Date.now(),
        name: name,
        settings: {
            province: 'ON',
            birthYear: birthYear,
            startYear: startYear,
            endYear: endYear,

            initialBalances: {
                tfsa: 150000,
                rrsp: 200000,
                nonReg: 300000,
                checking: 20000,
                minChecking: 10000,
                maxChecking: 50000,
                lira: 0,
                lif: 0
            },
            lockedIn: deepCopy(DEFAULT_LOCKED_IN_SETTINGS),
            // ★★★ [추가] 배우자 설정 초기화 ★★★
            spouse: deepCopy(DEFAULT_SPOUSE_SETTINGS),

            portfolio: deepCopy(DEFAULT_PORTFOLIO),
            advancedSettings: deepCopy(DEFAULT_ADVANCED_SETTINGS),
            rebalanceThreshold: 0, 

            assetProfiles: deepCopy(DEFAULT_ASSET_PROFILES),
            generalInflation: 2.5,
            taxInflationRate: 2.5, 

            incomes: deepCopy(DEFAULT_INCOMES),
            expenses: deepCopy(DEFAULT_EXPENSES),
            oneTimeEvents: deepCopy(DEFAULT_ONE_TIME_EVENTS),
            
            monteCarlo: deepCopy(DEFAULT_MONTE_CARLO),
        }
    };
};

/**
 * 시나리오 객체의 유효성을 검사하는 함수
 */
var validateScenario = (scenario) => {
    const errors = [];
    const settings = scenario.settings;

    // 1. 기본 설정 검사
    if (settings.startYear <= settings.birthYear) errors.push("Retirement start year must be after birth year.");
    if (settings.endYear <= settings.startYear) errors.push("Life expectancy (end year) must be after retirement start year.");

    // 2. 자산 검사
    Object.keys(settings.initialBalances).forEach(key => {
        if (settings.initialBalances[key] < 0) errors.push(`Initial balance for ${key} cannot be negative.`);
    });
    if (settings.initialBalances.maxChecking <= settings.initialBalances.minChecking) {
        errors.push("Max checking balance must be greater than min checking balance.");
    }
    
    // 3. 포트폴리오 검사 (간단 모드)
    if (settings.portfolio.useSimpleMode) {
        const startSum = Object.values(settings.portfolio.startComposition).reduce((s, v) => s + v, 0);
        const endSum = Object.values(settings.portfolio.endComposition).reduce((s, v) => s + v, 0);
        if (Math.abs(startSum - 100.0) > 0.01) errors.push("Simple Mode 'Start Composition' percentages must add up to 100%. Current: " + startSum);
        if (Math.abs(endSum - 100.0) > 0.01) errors.push("Simple Mode 'End Composition' percentages must add up to 100%. Current: " + endSum);
    }

    // 4. 자산 프로파일 검사
    Object.keys(settings.assetProfiles).forEach(key => {
        const profile = settings.assetProfiles[key];
        if (profile.volatility < 0) errors.push(`Volatility for ${profile.name} cannot be negative.`);
        if (profile.dividend_growth < 0) errors.push(`Dividend growth for ${profile.name} cannot be negative.`);
    });

    // 5. 수입/지출/이벤트 검사
    [...settings.incomes, ...settings.expenses].forEach(item => {
        if (item.endYear < item.startYear) errors.push(`For item '${item.type}', end year cannot be before start year.`);
        if (item.amount < 0) errors.push(`Amount for '${item.type}' cannot be negative.`);
    });
    settings.oneTimeEvents.forEach(event => {
        if (event.amount < 0) errors.push(`Amount for one-time event '${event.name}' cannot be negative.`);
        if (event.type === 'income' && !event.taxationType) errors.push(`Income event '${event.name}' must have a taxation type.`);
    });

    // LIRA/LIF 유효성 검사
    if (settings.lockedIn) {
        if (settings.lockedIn.unlockingPercent < 0 || settings.lockedIn.unlockingPercent > 100) {
            errors.push("Unlocking percent must be between 0 and 100.");
        }
        if (settings.lockedIn.cansimRate < 0) {
            errors.push("CANSIM rate cannot be negative.");
        }
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
};

/**
 * 프론트엔드 시나리오 객체를 Python 백엔드 AI가 이해하는 JSON 페이로드로 변환합니다.
 */
var createApiPayload = (scenario) => {
    
    const assetProfileMap = {
        growth: 'stocks_growth',
        balanced: 'stocks_balanced',
        dividend_can: 'stocks_dividend_can',
        dividend_us: 'stocks_dividend_us',
        bond: 'bonds',
        gic: 'gic'
    };
    
    const mappedAssetProfiles = {};
    for (const key_js in scenario.settings.assetProfiles) {
        const key_py = assetProfileMap[key_js]; 
        if (key_py) {
            const profile = scenario.settings.assetProfiles[key_js];
            mappedAssetProfiles[key_py] = {
                name: profile.name,
                growth: (profile.growth || 0) / 100.0,
                dividend: (profile.dividend || 0) / 100.0,
                volatility: (profile.volatility || 0) / 100.0,
                dividend_growth_rate: (profile.dividend_growth || 0) / 100.0
            };
        }
    }

    const mappedAdvancedAssets = {};
    const advancedSettings = scenario.settings.advancedSettings;
    ['tfsa', 'rrsp', 'nonReg'].forEach(acctKey => {
        mappedAdvancedAssets[acctKey] = {};
        for (const key_js in advancedSettings[acctKey].holdings) {
            const key_py = assetProfileMap[key_js]; 
            if (key_py) {
                mappedAdvancedAssets[acctKey][key_py] = advancedSettings[acctKey].override 
                    ? advancedSettings[acctKey].holdings[key_js]
                    : 0; 
            }
        }
    });
    
    const mapGlidePath = (composition) => {
        const mapped = {};
        for (const key_js in composition) {
            const key_py = assetProfileMap[key_js]; 
            if (key_py) {
                mapped[key_py] = (composition[key_js] || 0) / 100.0; 
            }
        }
        return mapped;
    };

    const birthYear = scenario.settings.birthYear; 

    const mappedEvents = scenario.settings.oneTimeEvents.map(event => ({
        year: event.year - birthYear, 
        amount: event.amount,
        type: event.type,
        taxationType: event.taxationType || (event.type === 'income' ? 'nonTaxable' : 'n/a'),
        acb: event.acb || 0
    }));

    // ★★★ [신설] 배우자 데이터 추출 및 구조화 ★★★
    const s = scenario.settings.spouse || {};
    const spouseData = {
        hasSpouse: !!s.hasSpouse,
        birthYear: s.birthYear || birthYear,
        cppIncome: s.cppIncome || 0,
        pensionIncome: s.pensionIncome || 0,
        baseIncome: s.baseIncome || 0,
        optimizeCppSharing: !!s.optimizeCppSharing,
        useSpouseAgeForRrif: !!s.useSpouseAgeForRrif
    };

    const payload = {
        start_age: scenario.settings.startYear - scenario.settings.birthYear,
        retirement_age: scenario.settings.startYear - scenario.settings.birthYear,
        end_age: scenario.settings.endYear - scenario.settings.birthYear,
        birth_year: scenario.settings.birthYear, 

        pre_retirement_inflation: (scenario.settings.generalInflation || 0) / 100.0, 
        tax_inflation_rate: (scenario.settings.taxInflationRate || 0) / 100.0, 
        
        initial: {
            chequing: scenario.settings.initialBalances.checking,
            tfsa: scenario.settings.advancedSettings.tfsa.override ? Object.values(scenario.settings.advancedSettings.tfsa.holdings).reduce((s, v) => s + v, 0) : scenario.settings.initialBalances.tfsa,
            rrsp: scenario.settings.advancedSettings.rrsp.override ? Object.values(scenario.settings.advancedSettings.rrsp.holdings).reduce((s, v) => s + v, 0) : scenario.settings.initialBalances.rrsp,
            non_reg: scenario.settings.advancedSettings.nonReg.override ? Object.values(scenario.settings.advancedSettings.nonReg.holdings).reduce((s, v) => s + v, 0) : scenario.settings.initialBalances.nonReg,
            lira: scenario.settings.initialBalances.lira || 0,
            lif: scenario.settings.initialBalances.lif || 0
        },
        chequing_min: scenario.settings.initialBalances.minChecking,
        chequing_max: scenario.settings.initialBalances.maxChecking,

        locked_in_settings: {
            conversion_age: scenario.settings.lockedIn ? scenario.settings.lockedIn.conversionAge : 71,
            unlocking_percent: (scenario.settings.lockedIn ? scenario.settings.lockedIn.unlockingPercent : 50.0) / 100.0,
            cansim_rate: (scenario.settings.lockedIn ? scenario.settings.lockedIn.cansimRate : 3.5) / 100.0,
            jurisdiction: scenario.settings.province 
        },
        
        // ★★★ [추가] 배우자 정보 전송 ★★★
        spouse_data: spouseData,

        income_items: scenario.settings.incomes.map(item => ({
            id: item.id,
            type: item.type,
            amount: item.amount,
            start_year: item.startYear - birthYear,
            end_year: item.endYear - birthYear,    
            growth_rate: (item.growthRate || 0) / 100.0
        })),
        expense_items: scenario.settings.expenses.map(item => ({
            id: item.id,
            type: item.type,
            amount: item.amount,
            start_year: item.startYear - birthYear,
            end_year: item.endYear - birthYear,    
            growth_rate: (item.growthRate || 0) / 100.0
        })),
        one_time_events: mappedEvents,

        assets: mappedAssetProfiles,
        
        mode: scenario.settings.portfolio.useSimpleMode ? "simple" : "advanced",
        glide_path_start: mapGlidePath(scenario.settings.portfolio.startComposition),
        glide_path_end: mapGlidePath(scenario.settings.portfolio.endComposition),
        advanced_assets: mappedAdvancedAssets, 

        rebalancing: {
            enabled: scenario.settings.rebalanceThreshold === 0, 
            frequency_years: 1
        },
        runs: scenario.settings.monteCarlo.simulationCount
    };

    const mapped_non_reg_acb = {};
    if (scenario.settings.portfolio.useSimpleMode) {
        const total_non_reg_value = scenario.settings.initialBalances.nonReg || 0;
        const acb_ratio = (scenario.settings.initialBalances.nonRegAcbRatio || 0) / 100.0;
        const total_acb = total_non_reg_value * acb_ratio;
        const start_composition = scenario.settings.portfolio.startComposition;
        const total_comp_ratio = Object.values(start_composition).reduce((s, v) => s + v, 0);

        for (const key_js in start_composition) {
            const key_py = assetProfileMap[key_js];
            if (key_py) {
                if (total_comp_ratio > 0) {
                    const asset_ratio = (start_composition[key_js] || 0) / total_comp_ratio;
                    mapped_non_reg_acb[key_py] = total_acb * asset_ratio;
                } else {
                    mapped_non_reg_acb[key_py] = 0;
                }
            }
        }
        if (total_comp_ratio === 0 && total_acb > 0) {
             const first_py_key = assetProfileMap[ASSET_KEYS[0]];
             if (first_py_key) mapped_non_reg_acb[first_py_key] = total_acb;
        }

    } else {
        const acb_js = scenario.settings.advancedSettings.nonReg.acb;
        for (const key_js in acb_js) {
            const key_py = assetProfileMap[key_js]; 
            if (key_py) {
                mapped_non_reg_acb[key_py] = acb_js[key_js];
            }
        }
    }
    payload.non_reg_acb = mapped_non_reg_acb;

    return payload;
};
