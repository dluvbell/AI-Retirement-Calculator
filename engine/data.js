// --- engine/data.js ---

/**
 * 이 파일은 앱의 '기본 상태(Default State)'와 '데이터 변환(Data Transformation)'을 담당합니다.
 * 사용자가 '새 시나리오'를 추가할 때 사용되는 템플릿입니다.
 */

// [AI 2.0] 6개 자산군 정의 (JS 프론트엔드용 키)
var ASSET_KEYS = ['growth', 'balanced', 'dividend_can', 'dividend_us', 'bond', 'gic'];

// 1. 기본 자산 프로파일 (6개 자산군)
var DEFAULT_ASSET_PROFILES = {
    growth: { name: 'Growth Stocks', growth: 8.0, dividend: 0.5, volatility: 18.0, dividend_growth: 5.0 },
    balanced: { name: 'Balanced Stocks', growth: 5.0, dividend: 1.5, volatility: 12.0, dividend_growth: 4.0 },
    dividend_can: { name: 'CAN Dividend', growth: 3.0, dividend: 4.0, volatility: 10.0, dividend_growth: 3.0 },
    dividend_us: { name: 'US Dividend', growth: 4.0, dividend: 3.0, volatility: 11.0, dividend_growth: 3.0 },
    bond: { name: 'Bonds', growth: 1.0, dividend: 2.5, volatility: 5.0, dividend_growth: 0.0 },
    gic: { name: 'GIC/Cash', growth: 0.0, dividend: 2.0, volatility: 0.1, dividend_growth: 0.0 }
};


// 2. 기본 포트폴리오 (6개 자산군)
var DEFAULT_PORTFOLIO = {
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
var DEFAULT_ADVANCED_SETTINGS = {
    // --- Client Accounts ---
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
    },
    lira: {
        override: false,
        holdings: { growth: 0, balanced: 0, dividend_can: 0, dividend_us: 0, bond: 0, gic: 0 },
        acb: { growth: 0, balanced: 0, dividend_can: 0, dividend_us: 0, bond: 0, gic: 0 }
    },
    lif: {
        override: false,
        holdings: { growth: 0, balanced: 0, dividend_can: 0, dividend_us: 0, bond: 0, gic: 0 },
        acb: { growth: 0, balanced: 0, dividend_can: 0, dividend_us: 0, bond: 0, gic: 0 }
    },
    
    // --- Spouse Accounts ---
    spouse_tfsa: {
        override: false,
        holdings: { growth: 0, balanced: 0, dividend_can: 0, dividend_us: 0, bond: 0, gic: 0 },
        acb: { growth: 0, balanced: 0, dividend_can: 0, dividend_us: 0, bond: 0, gic: 0 }
    },
    spouse_rrsp: {
        override: false,
        holdings: { growth: 0, balanced: 0, dividend_can: 0, dividend_us: 0, bond: 0, gic: 0 },
        acb: { growth: 0, balanced: 0, dividend_can: 0, dividend_us: 0, bond: 0, gic: 0 }
    },
    spouse_nonReg: {
        override: false,
        holdings: { growth: 0, balanced: 0, dividend_can: 0, dividend_us: 0, bond: 0, gic: 0 },
        acb: { growth: 0, balanced: 0, dividend_can: 0, dividend_us: 0, bond: 0, gic: 0 }
    },
    spouse_lira: {
        override: false,
        holdings: { growth: 0, balanced: 0, dividend_can: 0, dividend_us: 0, bond: 0, gic: 0 },
        acb: { growth: 0, balanced: 0, dividend_can: 0, dividend_us: 0, bond: 0, gic: 0 }
    },
    spouse_lif: {
        override: false,
        holdings: { growth: 0, balanced: 0, dividend_can: 0, dividend_us: 0, bond: 0, gic: 0 },
        acb: { growth: 0, balanced: 0, dividend_can: 0, dividend_us: 0, bond: 0, gic: 0 }
    }
};

// 4. 기본 수입 및 지출
var DEFAULT_INCOMES = [
    { id: 1, type: 'CPP', amount: 15000, startYear: 2050, endYear: 2085, growthRate: 2.5 },
    { id: 2, type: 'OAS', amount: 8000, startYear: 2050, endYear: 2085, growthRate: 2.5 }
];

var DEFAULT_EXPENSES = [
    { id: 1, type: 'Living Expenses', amount: 50000, startYear: 2035, endYear: 2085, growthRate: 2.5 }
];

// 5. 기본 일회성 이벤트
var DEFAULT_ONE_TIME_EVENTS = [
    { id: 1, year: 2040, amount: 250000, type: 'income', name: 'Inheritance', taxationType: 'nonTaxable', acb: 0 },
    { id: 2, year: 2045, amount: 50000, type: 'expense', name: 'Car Purchase', taxationType: 'n/a', acb: 0 }
];

// 6. 몬테카를로 설정
var DEFAULT_MONTE_CARLO = {
    simulationCount: 1000
};

// LIRA/LIF 설정 기본값
var DEFAULT_LOCKED_IN_SETTINGS = {
    conversionAge: 71,       
    unlockingPercent: 50.0,  
    cansimRate: 3.5          
};

// LIF 최소 인출율 테이블
var LIF_MIN_WITHDRAWAL_RATES = {
    50: 0.0250, 51: 0.0256, 52: 0.0263, 53: 0.0270, 54: 0.0278,
    55: 0.0286, 56: 0.0294, 57: 0.0303, 58: 0.0313, 59: 0.0323,
    60: 0.0333, 61: 0.0345, 62: 0.0357, 63: 0.0370, 64: 0.0385,
    65: 0.0400, 66: 0.0417, 67: 0.0435, 68: 0.0455, 69: 0.0476,
    70: 0.0500,
    71: 0.0528, 72: 0.0540, 73: 0.0553, 74: 0.0567, 75: 0.0582,
    76: 0.0598, 77: 0.0617, 78: 0.0636, 79: 0.0658, 80: 0.0682,
    81: 0.0708, 82: 0.0738, 83: 0.0771, 84: 0.0808, 85: 0.0851,
    86: 0.0899, 87: 0.0955, 88: 0.1021, 89: 0.1099, 90: 0.1192,
    91: 0.1306, 92: 0.1449, 93: 0.1634, 94: 0.1879, 95: 0.2000
};

/**
 * 새 시나리오 객체를 생성하는 팩토리 함수
 */
var createNewScenario = (name) => {
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

            // ★★★ [수정] 배우자 설정 확장 (소득 타이밍 포함) ★★★
            spouseSettings: {
                enabled: false,
                birthYear: birthYear,
                cppAmount: 0,
                cppStartAge: 65, // [신규]
                oasAmount: 0,
                oasStartAge: 65, // [신규]
                baseIncome: 0,
                baseIncomeStartAge: 65, // [신규]
                baseIncomeEndAge: 95    // [신규]
            },

            // AssetsStrategy
            initialBalances: {
                tfsa: 150000,
                rrsp: 200000,
                nonReg: 300000,
                nonRegAcbRatio: 50, // Client ACB Ratio
                
                checking: 20000,
                minChecking: 10000,
                maxChecking: 50000,
                lira: 0,
                lif: 0,
                
                // ★★★ [수정] 배우자 자산 및 ACB 추가 ★★★
                spouse_tfsa: 0,
                spouse_rrsp: 0,
                spouse_nonReg: 0,
                spouseNonRegAcbRatio: 50, // [신규] Spouse ACB Ratio
                spouse_lira: 0,
                spouse_lif: 0
            },
            
            // Client Locked-in
            lockedIn: deepCopy(DEFAULT_LOCKED_IN_SETTINGS),
            
            // ★★★ [신규] Spouse Locked-in Settings ★★★
            spouseLockedIn: deepCopy(DEFAULT_LOCKED_IN_SETTINGS),

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
    if (settings.startYear <= settings.birthYear) errors.push("Retirement start year must be after birth year.");
    if (settings.endYear <= settings.startYear) errors.push("Life expectancy (end year) must be after retirement start year.");
    Object.keys(settings.initialBalances).forEach(key => {
        if (settings.initialBalances[key] < 0) errors.push(`Initial balance for ${key} cannot be negative.`);
    });
    return { isValid: errors.length === 0, errors: errors };
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
    
    const allAccountKeys = [
        'tfsa', 'rrsp', 'nonReg', 'lira', 'lif',
        'spouse_tfsa', 'spouse_rrsp', 'spouse_nonReg', 'spouse_lira', 'spouse_lif'
    ];
    
    allAccountKeys.forEach(acctKey => {
        mappedAdvancedAssets[acctKey] = {};
        if (advancedSettings[acctKey] && advancedSettings[acctKey].holdings) {
            for (const key_js in advancedSettings[acctKey].holdings) {
                const key_py = assetProfileMap[key_js];
                if (key_py) {
                    mappedAdvancedAssets[acctKey][key_py] = advancedSettings[acctKey].override 
                        ? advancedSettings[acctKey].holdings[key_js]
                        : 0; 
                }
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

    // --- Client ACB Calculation ---
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
            if (key_py) mapped_non_reg_acb[key_py] = acb_js[key_js];
        }
    }

    // ★★★ [신설] Spouse ACB Calculation ★★★
    const mapped_spouse_non_reg_acb = {};
    if (scenario.settings.spouseSettings.enabled) {
        if (scenario.settings.portfolio.useSimpleMode) {
            const total_spouse_non_reg = scenario.settings.initialBalances.spouse_nonReg || 0;
            // [수정] 배우자 전용 ACB Ratio 사용
            const spouse_acb_ratio = (scenario.settings.initialBalances.spouseNonRegAcbRatio || 0) / 100.0;
            const total_spouse_acb = total_spouse_non_reg * spouse_acb_ratio;
            const start_composition = scenario.settings.portfolio.startComposition;
            const total_comp_ratio = Object.values(start_composition).reduce((s, v) => s + v, 0);

            for (const key_js in start_composition) {
                const key_py = assetProfileMap[key_js];
                if (key_py) {
                    if (total_comp_ratio > 0) {
                        const asset_ratio = (start_composition[key_js] || 0) / total_comp_ratio;
                        mapped_spouse_non_reg_acb[key_py] = total_spouse_acb * asset_ratio;
                    } else {
                        mapped_spouse_non_reg_acb[key_py] = 0;
                    }
                }
            }
             if (total_comp_ratio === 0 && total_spouse_acb > 0) {
                 const first_py_key = assetProfileMap[ASSET_KEYS[0]];
                 if (first_py_key) mapped_spouse_non_reg_acb[first_py_key] = total_spouse_acb;
            }
        } else {
            const acb_js = scenario.settings.advancedSettings.spouse_nonReg.acb;
            for (const key_js in acb_js) {
                const key_py = assetProfileMap[key_js]; 
                if (key_py) mapped_spouse_non_reg_acb[key_py] = acb_js[key_js];
            }
        }
    }

    const payload = {
        start_age: scenario.settings.startYear - scenario.settings.birthYear,
        retirement_age: scenario.settings.startYear - scenario.settings.birthYear,
        end_age: scenario.settings.endYear - scenario.settings.birthYear,
        birth_year: scenario.settings.birthYear, 

        spouse_data: scenario.settings.spouseSettings || {},

        pre_retirement_inflation: (scenario.settings.generalInflation || 0) / 100.0, 
        tax_inflation_rate: (scenario.settings.taxInflationRate || 0) / 100.0, 
        
        initial: {
            chequing: scenario.settings.initialBalances.checking,
            tfsa: scenario.settings.advancedSettings.tfsa.override ? Object.values(scenario.settings.advancedSettings.tfsa.holdings).reduce((s, v) => s + v, 0) : scenario.settings.initialBalances.tfsa,
            rrsp: scenario.settings.advancedSettings.rrsp.override ? Object.values(scenario.settings.advancedSettings.rrsp.holdings).reduce((s, v) => s + v, 0) : scenario.settings.initialBalances.rrsp,
            non_reg: scenario.settings.advancedSettings.nonReg.override ? Object.values(scenario.settings.advancedSettings.nonReg.holdings).reduce((s, v) => s + v, 0) : scenario.settings.initialBalances.nonReg,
            lira: scenario.settings.advancedSettings.lira.override ? Object.values(scenario.settings.advancedSettings.lira.holdings).reduce((s, v) => s + v, 0) : (scenario.settings.initialBalances.lira || 0),
            lif: scenario.settings.advancedSettings.lif.override ? Object.values(scenario.settings.advancedSettings.lif.holdings).reduce((s, v) => s + v, 0) : (scenario.settings.initialBalances.lif || 0),
            
            spouse_tfsa: scenario.settings.advancedSettings.spouse_tfsa.override ? Object.values(scenario.settings.advancedSettings.spouse_tfsa.holdings).reduce((s, v) => s + v, 0) : (scenario.settings.initialBalances.spouse_tfsa || 0),
            spouse_rrsp: scenario.settings.advancedSettings.spouse_rrsp.override ? Object.values(scenario.settings.advancedSettings.spouse_rrsp.holdings).reduce((s, v) => s + v, 0) : (scenario.settings.initialBalances.spouse_rrsp || 0),
            spouse_non_reg: scenario.settings.advancedSettings.spouse_nonReg.override ? Object.values(scenario.settings.advancedSettings.spouse_nonReg.holdings).reduce((s, v) => s + v, 0) : (scenario.settings.initialBalances.spouse_nonReg || 0),
            spouse_lira: scenario.settings.advancedSettings.spouse_lira.override ? Object.values(scenario.settings.advancedSettings.spouse_lira.holdings).reduce((s, v) => s + v, 0) : (scenario.settings.initialBalances.spouse_lira || 0),
            spouse_lif: scenario.settings.advancedSettings.spouse_lif.override ? Object.values(scenario.settings.advancedSettings.spouse_lif.holdings).reduce((s, v) => s + v, 0) : (scenario.settings.initialBalances.spouse_lif || 0),
        },
        chequing_min: scenario.settings.initialBalances.minChecking,
        chequing_max: scenario.settings.initialBalances.maxChecking,

        locked_in_settings: {
            conversion_age: scenario.settings.lockedIn ? scenario.settings.lockedIn.conversionAge : 71,
            unlockingPercent: (scenario.settings.lockedIn ? scenario.settings.lockedIn.unlockingPercent : 50.0) / 100.0,
            cansim_rate: (scenario.settings.lockedIn ? scenario.settings.lockedIn.cansimRate : 3.5) / 100.0,
            jurisdiction: scenario.settings.province
        },

        // ★★★ [신설] 배우자 Locked-in 설정 전송 ★★★
        spouse_locked_in_settings: {
             conversion_age: scenario.settings.spouseLockedIn ? scenario.settings.spouseLockedIn.conversionAge : 71,
             unlockingPercent: (scenario.settings.spouseLockedIn ? scenario.settings.spouseLockedIn.unlockingPercent : 50.0) / 100.0
             // Cansim, Jurisdiction은 Client와 공유하거나 필요 시 추가
        },

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
        non_reg_acb: mapped_non_reg_acb,
        spouse_non_reg_acb: mapped_spouse_non_reg_acb, // [신규] 전송

        rebalancing: {
            enabled: scenario.settings.rebalanceThreshold === 0, 
            frequency_years: 1
        },
        runs: scenario.settings.monteCarlo.simulationCount
    };

    return payload;
};
