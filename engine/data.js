// --- engine/data.js ---

/**
 * 이 파일은 앱의 '기본 상태(Default State)'와 '데이터 변환(Data Transformation)'을 담당합니다.
 * 사용자가 '새 시나리오'를 추가할 때 사용되는 템플릿입니다.
 */

// [AI 2.0] 6개 자산군 정의 (JS 프론트엔드용 키)
const ASSET_KEYS = ['growth', 'balanced', 'dividend_can', 'dividend_us', 'bond', 'gic'];

// 1. 기본 자산 프로파일 (6개 자산군)
const DEFAULT_ASSET_PROFILES = {
    growth: { name: 'Growth Stocks', appreciation: 8.0, dividendYield: 0.5, volatility: 18.0, dividend_growth: 5.0 },
    balanced: { name: 'Balanced Stocks', appreciation: 5.0, dividendYield: 1.5, volatility: 12.0, dividend_growth: 4.0 },
    dividend_can: { name: 'CAN Dividend', appreciation: 3.0, dividendYield: 4.0, volatility: 10.0, dividend_growth: 3.0 },
    dividend_us: { name: 'US Dividend', appreciation: 4.0, dividendYield: 3.0, volatility: 11.0, dividend_growth: 3.0 },
    bond: { name: 'Bonds', appreciation: 1.0, dividendYield: 2.5, volatility: 5.0, dividend_growth: 0.0 },
    gic: { name: 'GIC/Cash', appreciation: 0.0, dividendYield: 2.0, volatility: 0.1, dividend_growth: 0.0 }
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
        // ACB는 Non-Reg에만 의미가 있으므로 TFSA/RRSP에서는 0으로 설정
        acb: { growth: 0, balanced: 0, dividend_can: 0, dividend_us: 0, bond: 0, gic: 0 },
        endComposition: { growth: 30, balanced: 10, dividend_can: 0, dividend_us: 0, bond: 50, gic: 10 }
    },
    rrsp: {
        override: false,
        holdings: { growth: 120000, balanced: 20000, dividend_can: 0, dividend_us: 0, bond: 60000, gic: 0 },
        acb: { growth: 0, balanced: 0, dividend_can: 0, dividend_us: 0, bond: 0, gic: 0 },
        endComposition: { growth: 30, balanced: 10, dividend_can: 0, dividend_us: 0, bond: 50, gic: 10 }
    },
    nonReg: {
        override: false,
        holdings: { growth: 200000, balanced: 50000, dividend_can: 0, dividend_us: 0, bond: 50000, gic: 0 },
        // Non-Reg는 ACB(투자 원금)가 매우 중요합니다.
        acb: { growth: 150000, balanced: 40000, dividend_can: 0, dividend_us: 0, bond: 45000, gic: 0 },
        endComposition: { growth: 30, balanced: 10, dividend_can: 0, dividend_us: 0, bond: 50, gic: 10 }
    }
};

// 4. 기본 수입 및 지출
const DEFAULT_INCOMES = [
    { id: 1, type: 'CPP', customName: 'My CPP', amount: 15000, startYear: 2050, endYear: 2085, growthRate: 2.5 },
    { id: 2, type: 'OAS', customName: 'My OAS', amount: 8000, startYear: 2050, endYear: 2085, growthRate: 2.5 }
];

const DEFAULT_EXPENSES = [
    { id: 1, type: 'Living Expense', customName: 'Living Expenses', amount: 50000, startYear: 2035, endYear: 2085, growthRate: 2.5 }
];

// 5. 기본 일회성 이벤트 (세금 유형 포함)
const DEFAULT_ONE_TIME_EVENTS = [
    { 
        id: 1, 
        year: 2040, 
        amount: 250000, 
        type: 'income', 
        name: 'Inheritance',
        // 'income' 타입 이벤트는 이 두 필드가 필수입니다.
        taxationType: 'nonTaxable', // 비과세
        acb: 0 
    },
    { 
        id: 2, 
        year: 2045, 
        amount: 50000, 
        type: 'expense', 
        name: 'Car Purchase',
        taxationType: 'n/a', // 지출은 세금과 무관
        acb: 0 
    }
];

// 6. 몬테카를로 및 전문가 설정
const DEFAULT_MONTE_CARLO = {
    simulationCount: 1000,
    riskProfile: "Balanced"
};

const DEFAULT_EXPERT_MODE = {
    enabled: false,
    params: {
        lookAheadYears: 7,
        tfsaWithdrawalPenalty: 0.07,
        rrspWithdrawalBonus: 0.02,
    }
};

/**
 * 새 시나리오 객체를 생성하는 팩토리 함수
 * @param {string} name - 새 시나리오의 이름
 * @returns {object} - 시나리오 기본값이 채워진 객체
 */
const createNewScenario = (name) => {
    const currentYear = new Date().getFullYear();
    const birthYear = 1980;
    const startYear = 2035; // 은퇴 시작 연도 (55세)
    const lifeExpectancy = 95; // 95세까지 계획
    const endYear = birthYear + lifeExpectancy;

    // ★★★ 수정: createNewScenario가 advancedSettings 대신 tfsa, rrsp, nonReg를 직접 생성하도록 변경
    return {
        id: Date.now(),
        name: name,
        settings: {
            // BasicSettings
            province: 'ON',
            birthYear: birthYear,
            startYear: startYear,
            endYear: endYear,

            // AssetsStrategy (Simple Mode)
            checkingBalance: 20000,
            checkingMinBalance: 10000, // minChecking
            checkingMaxBalance: 50000, // maxChecking
            nonRegAcbRatio: 75, // nonReg 총액 대비 ACB 비율 (Simple Mode용)
            useSimpleMode: true, // portfolio.useSimpleMode 대신 여기로 이동
            portfolio: {
                startComposition: deepCopy(DEFAULT_PORTFOLIO.startComposition),
                endComposition: deepCopy(DEFAULT_PORTFOLIO.endComposition)
            },
            
            // AssetsStrategy (Advanced Mode) - UI가 직접 수정하는 실제 데이터
            tfsa: deepCopy(DEFAULT_ADVANCED_SETTINGS.tfsa),
            rrsp: deepCopy(DEFAULT_ADVANCED_SETTINGS.rrsp),
            nonReg: deepCopy(DEFAULT_ADVANCED_SETTINGS.nonReg),

            rebalanceThreshold: 0, // 0 = 매년 리밸런싱

            // AssetProfiles
            assetProfiles: deepCopy(DEFAULT_ASSET_PROFILES),
            taxInflationRate: 2.5, // 세금 브라켓 인플레이션
            initialTfsaRoom: 95000, // TFSA Room
            annualTfsaContribution: 7000, // 연간 TFSA 기여금

            // IncomesExpenses
            incomes: deepCopy(DEFAULT_INCOMES),
            expenses: deepCopy(DEFAULT_EXPENSES),
            oneTimeEvents: deepCopy(DEFAULT_ONE_TIME_EVENTS),
            marketCrashes: [], // 시장 붕괴 이벤트
            
            // ExpertSettings
            expertMode: deepCopy(DEFAULT_EXPERT_MODE),

            // MonteCarlo
            monteCarlo: deepCopy(DEFAULT_MONTE_CARLO),
        }
    };
};


/**
 * 시나리오 객체의 유효성을 검사하는 함수
 * @param {object} scenario - 검사할 시나리오 객체
 * @returns {object} - { isValid: boolean, errors: string[] }
 */
const validateScenario = (scenario) => {
    const errors = [];
    const settings = scenario.settings;

    // 1. 기본 설정 검사
    if (settings.startYear <= settings.birthYear) errors.push("Retirement start year must be after birth year.");
    if (settings.endYear <= settings.startYear) errors.push("Life expectancy (end year) must be after retirement start year.");

    // 2. 자산 검사 (수정: initialBalances 대신 올바른 위치 참조)
    if (settings.checkingBalance < 0) errors.push("Initial checking balance cannot be negative.");
    if (settings.checkingMaxBalance <= settings.checkingMinBalance) {
        errors.push("Max checking balance must be greater than min checking balance.");
    }
    
    // 3. 포트폴리오 검사 (간단 모드)
    if (settings.useSimpleMode) {
        // [AI 2.0] 6개 자산군 합계 검사
        const startSum = Object.values(settings.portfolio.startComposition).reduce((s, v) => (s + (parseFloat(v) || 0)), 0);
        const endSum = Object.values(settings.portfolio.endComposition).reduce((s, v) => (s + (parseFloat(v) || 0)), 0);
        if (Math.abs(startSum - 100.0) > 0.01) errors.push("Simple Mode 'Start Composition' percentages must add up to 100% (currently " + startSum.toFixed(2) + "%).");
        if (Math.abs(endSum - 100.0) > 0.01) errors.push("Simple Mode 'End Composition' percentages must add up to 100% (currently " + endSum.toFixed(2) + "%).");
    }

    // 4. 자산 프로파일 검사
    Object.keys(settings.assetProfiles).forEach(key => {
        const profile = settings.assetProfiles[key];
        if (profile.volatility < 0) errors.push(`Volatility for ${profile.name} cannot be negative.`);
        if (profile.dividend_growth < 0) errors.push(`Dividend growth for ${profile.name} cannot be negative.`);
    });

    // 5. 수입/지출/이벤트 검사
    [...settings.incomes, ...settings.expenses].forEach(item => {
        if (item.endYear < item.startYear) errors.push(`For item '${item.customName || item.type}', end year cannot be before start year.`);
        if (item.amount < 0) errors.push(`Amount for '${item.customName || item.type}' cannot be negative.`);
    });
    settings.oneTimeEvents.forEach(event => {
        if (event.amount < 0) errors.push(`Amount for one-time event '${event.name}' cannot be negative.`);
        if (event.type === 'income' && !event.taxationType) errors.push(`Income event '${event.name}' must have a taxation type.`);
    });

    return {
        isValid: errors.length === 0,
        errors: errors
    };
};


/**
 * 프론트엔드 시나리오 객체를 Python 백엔드 AI가 이해하는 JSON 페이로드로 변환합니다.
 * @param {object} scenario - 프론트엔드의 활성 시나리오 객체
 * @returns {object} - Python 서버의 /simulate 엔드포인트로 전송될 JSON 객체
 */
const createApiPayload = (scenario) => {
    const { settings } = scenario; // 'scenario'는 activeScenario 전체입니다.
    
    // 0. 헬퍼 함수: holdings 객체 { growth: 100, ... } 를 0-1 스케일의 객체로 변환
    const getCompositionPercentages = (holdings) => {
        const total = getAccountTotal(holdings);
        const composition = {};
        if (total > 0) {
            for (const assetKey in holdings) {
                composition[assetKey] = (holdings[assetKey] / total); // 100%가 아닌 1.0 기준으로
            }
        } else {
            // 비어있는 계좌의 기본값 (6개 자산군)
            // 서버가 6개 자산군을 모두 기대하므로 0이라도 보내야 함
            ASSET_KEYS.forEach(key => { composition[key] = 0; });
            composition.growth = 1.0; // 합계 1.0
        }
        return composition;
    };

    // 1. 자산 프로파일 변환 (6개 자산군 매핑)
    const assetProfileMap = {
        growth: 'stocks_growth',
        balanced: 'stocks_balanced',
        dividend_can: 'stocks_dividend_can',
        dividend_us: 'stocks_dividend_us',
        bond: 'bonds',
        gic: 'gic'
    };
    const mappedAssetProfiles = {};
    for (const key_js in settings.assetProfiles) {
        const key_py = assetProfileMap[key_js];
        if (key_py) {
            mappedAssetProfiles[key_py] = {
                // UI는 % (예: 8.0), API는 소수 (예: 0.08)
                growth: (settings.assetProfiles[key_js].appreciation || 0) / 100.0,
                dividend: (settings.assetProfiles[key_js].dividendYield || 0) / 100.0,
                volatility: (settings.assetProfiles[key_js].volatility || 0) / 100.0,
                dividend_growth_rate: (settings.assetProfiles[key_js].dividend_growth || 0) / 100.0
            };
        }
    }

    // 2. 초기 자산 값 변환 (올바른 위치에서 읽기)
    const initialBalances = {
        chequing: settings.checkingBalance || 0,
        tfsa: getAccountTotal(settings.tfsa.holdings),
        rrsp: getAccountTotal(settings.rrsp.holdings),
        non_reg: getAccountTotal(settings.nonReg.holdings)
    };

    // 3. 자산 배분 전략 변환 (Simple/Advanced)
    const mappedAdvancedAssets = {};
    const accountKeys = ['tfsa', 'rrsp', 'nonReg'];

    accountKeys.forEach(acctKey => {
        const pyAcctKey = (acctKey === 'nonReg') ? 'non_reg' : acctKey;
        let compositionSource = {}; // JS 키, 0.0 ~ 1.0 스케일

        if (settings.useSimpleMode) {
            // 간단 모드: 모든 계좌가 동일한 '시작' 비중을 사용 (UI는 %이므로 100으로 나눔)
            for (const key in settings.portfolio.startComposition) {
                compositionSource[key] = (settings.portfolio.startComposition[key] || 0) / 100.0;
            }
        } else {
            // 고급 모드: 각 계좌의 개별 비중을 계산
            compositionSource = getCompositionPercentages(settings[acctKey].holdings);
        }
        
        // compositionSource (JS 키)를 mappedAdvancedAssets (Python 키)로 변환
        const mappedComp = {};
        for (const key_js in assetProfileMap) {
            const key_py = assetProfileMap[key_js];
            mappedComp[key_py] = compositionSource[key_js] || 0;
        }
        mappedAdvancedAssets[pyAcctKey] = mappedComp;
    });

    // 4. 간단 모드(글라이드패스) 변환 (이름 매핑, 0-1 스케일)
    const mapGlidePath = (composition) => {
        const mapped = {};
        for (const key_js in composition) {
            const key_py = assetProfileMap[key_js]; // JS 키를 Python 키로 변환
            if (key_py) {
                mapped[key_py] = (composition[key_js] || 0) / 100.0; // % -> 0-1 스케일
            }
        }
        return mapped;
    };

    // 5. 일회성 이벤트 변환 (세금 정보 포함)
    const mappedEvents = settings.oneTimeEvents.map(event => ({
        year: event.year,
        amount: event.amount,
        type: event.type,
        name: event.name,
        taxationType: event.taxationType || (event.type === 'income' ? 'nonTaxable' : 'n/a'),
        acb: event.acb || 0
    }));

    // 6. ACB 맵핑 (Python 키 사용)
    const mappedAcb = {};
    for (const key_js in settings.nonReg.acb) {
        const key_py = assetProfileMap[key_js];
        if (key_py) {
            mappedAcb[key_py] = settings.nonReg.acb[key_js];
        }
    }

    // 7. 최종 페이로드 조립
    const payload = {
        // 기본 정보
        start_age: settings.startYear - settings.birthYear,
        retirement_age: settings.startYear - settings.birthYear, // 은퇴 후 시뮬레이션
        end_age: settings.endYear - settings.birthYear,
        pre_retirement_inflation: (settings.taxInflationRate || 2.5) / 100.0, // UI의 'taxInflationRate' 사용
        
        // 초기 자산
        initial: initialBalances,
        chequing_min: settings.checkingMinBalance || 10000,
        chequing_max: settings.checkingMaxBalance || 50000,
        province: settings.province || 'ON',

        // 수입/지출/이벤트
        income_items: settings.incomes,
        expense_items: settings.expenses,
        one_time_events: mappedEvents, // taxationType/acb 포함

        // 자산 프로파일 (시장 예측)
        assets: mappedAssetProfiles,
        
        // 자산 배분 전략
        mode: settings.useSimpleMode ? "simple" : "advanced",
        glide_path_start: mapGlidePath(settings.portfolio.startComposition),
        glide_path_end: mapGlidePath(settings.portfolio.endComposition),
        advanced_assets: mappedAdvancedAssets, // % 비율
        
        // ★★★ 수정된 부분: advancedSettings.nonReg.acb -> settings.nonReg.acb ★★★
        non_reg_acb: mappedAcb, // ACB 맵

        // 기타 설정
        rebalancing: {
            enabled: settings.rebalanceThreshold === 0, // 0%일 때만 매년 리밸런싱
            threshold: (settings.rebalanceThreshold || 0) / 100.0, // % -> 0-1 스케일
            frequency_years: 1
        },
        runs: settings.monteCarlo.simulationCount,
        
        // 전문가 설정
        expert_mode: settings.expertMode.enabled,
        look_ahead_years: settings.expertMode.params.lookAheadYears,
        tfsa_penalty: settings.expertMode.params.tfsaWithdrawalPenalty,
        rrsp_bonus: settings.expertMode.params.rrspWithdrawalBonus
    };

    return payload;
};