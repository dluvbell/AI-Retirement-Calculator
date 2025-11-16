// --- components/inputs/AssetsStrategy.js ---

// --- [신규] 포트폴리오 배분 입력을 위한 재사용 컴포넌트 ---
const CompositionInputs = ({ title, composition, onCompositionChange }) => {
    const total = Object.values(composition).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);

    let totalColor = '#facc15'; // Yellow for < 100
    if (Math.abs(total - 100) < 0.01) {
        totalColor = '#4ade80'; // Green for 100
    } else if (total > 100) {
        totalColor = '#f87171'; // Red for > 100
    }

// ★★★ 툴팁 텍스트를 title에 따라 동적으로 결정합니다 ★★★
    let tooltipText = null;
    if (title === 'Start Composition') {
        tooltipText = "Your portfolio's asset allocation at the start of retirement. The simulation will gradually shift from this to the End Composition over time.";
    } else if (title === 'End Composition') {
        tooltipText = "Your portfolio's target asset allocation at the end of the simulation (Life Expectancy).";
    }

    const inputStyle = {
        width: '100%', padding: '8px 12px', backgroundColor: '#374151',
        border: '1px solid #4b5563', borderRadius: '6px', color: 'white'
    };
    const labelStyle = { display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' };
    
    // [AI 2.0] 6개 자산군으로 수정
    const assetKeys = ['growth', 'balanced', 'dividend_can', 'dividend_us', 'bond', 'gic'];

    return (
        <div style={{ marginTop: '20px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', borderBottom: '1px solid #374151', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{title}</span>
                {tooltipText && (
                    <Tooltip text={tooltipText}>
                        <svg style={{color: '#9ca3af', cursor: 'pointer', height: '16px', width: '16px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                    </Tooltip>
                )}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px' }}>
                {assetKeys.map(key => (
                    <div key={key}>
                        <label style={labelStyle} htmlFor={`${title}-${key}`}>{key.charAt(0).toUpperCase() + key.slice(1)} (%)</label>
                        <input
                            type="number"
                            id={`${title}-${key}`}
                            style={inputStyle}
                            value={composition[key] || 0}
                            onChange={(e) => onCompositionChange(key, e.target.value)}
                        />
                    </div>
                ))}
            </div>
            <div style={{ marginTop: '12px', textAlign: 'right', fontSize: '16px', fontWeight: 'bold', color: totalColor }}>
                Total: {total.toFixed(2)}%
            </div>
        </div>
    );
};

const AssetsStrategy = ({ scenario, onUpdate }) => {

   // [수정] scenario.settings.portfolio에서 useSimpleMode를 읽어옵니다.
    const { useSimpleMode } = scenario.settings.portfolio;

// [신규] 단순 모드에서 계좌 총액이 변경될 때 호출되는 함수
const handleTotalChange = (accountKey, newTotalValue) => {
    const newTotal = parseFloat(newTotalValue) || 0;
    // [수정] account 객체를 settings.advancedSettings에서 가져옵니다.
    const account = scenario.settings.advancedSettings[accountKey];

    let composition = getAccountComposition(account.holdings);
    if (Object.keys(composition).length === 0) {
        composition = scenario.settings.portfolio.startComposition;
    }

    const newHoldings = {};
    for (const assetKey in composition) {
        const percentage = composition[assetKey] / 100;
        newHoldings[assetKey] = newTotal * percentage;
    }

    // [수정] App.js의 onUpdate가 dot notation을 처리하도록 수정된 경로로 호출합니다.
    onUpdate(`advancedSettings.${accountKey}`, { ...account, holdings: newHoldings });
};

// [신규] 포트폴리오 배분율(%)이 변경될 때 호출되는 함수
const handleCompositionChange = (compositionType, assetKey, newValue) => {
    const value = parseFloat(newValue) || 0;

    const newPortfolio = {
        ...scenario.settings.portfolio,
        [compositionType]: {
            ...scenario.settings.portfolio[compositionType],
            [assetKey]: value
        }
    };
    onUpdate('portfolio', newPortfolio);
};

// [신규] 고급 모드에서 자산/ACB 값이 변경될 때 호출되는 함수
const handleAdvancedChange = (accountKey, assetKey, field, value) => {
    const numericValue = parseFloat(value) || 0;
    // [수정] account 객체를 settings.advancedSettings에서 가져옵니다.
    const account = scenario.settings.advancedSettings[accountKey];

    const newAccountData = {
        ...account,
        [field]: { // 'field' is 'holdings' or 'acb'
            ...account[field], // [수정] ...account[field]
            [assetKey]: numericValue
        }
    };
    // [수정] App.js의 onUpdate가 dot notation을 처리하도록 수정된 경로로 호출합니다.
    onUpdate(`advancedSettings.${accountKey}`, newAccountData);
};

    // 공통적으로 사용할 스타일 객체들을 정의합니다.
    const inputStyle = {
        width: '100%',
        padding: '8px 12px',
        backgroundColor: '#374151',
        border: '1px solid #4b5563',
        borderRadius: '6px',
        color: 'white'
    };
    
    const labelStyle = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '4px'
};

// [신규] 고급 모드 테이블에서 사용할 변수와 스타일
// [AI 2.0] 6개 자산군으로 수정
const assetKeys = ['growth', 'balanced', 'dividend_can', 'dividend_us', 'bond', 'gic'];
const accountKeys = ['rrsp', 'tfsa', 'nonReg'];
const tableHeaderStyle = { padding: '10px', borderBottom: '2px solid #4b5563', fontSize: '14px', fontWeight: '600' };
const tableCellStyle = { padding: '8px', verticalAlign: 'top' };
const tableInputStyle = {
    width: '100%',
    padding: '6px 8px',
    backgroundColor: '#374151',
    border: '1px solid #4b5563',
    borderRadius: '4px',
    color: 'white',
    fontSize: '14px'
};

    // 화면에 보여줄 UI 구조입니다.
    return (
        <div style={{ backgroundColor: '#1f2937', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
                Assets & Strategy
            </h3>
            
            {/* --- [신규] 단순/고급 모드 토글 스위치 --- */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#374151', borderRadius: '9999px', padding: '4px' }}>
                {/* [수정] onClick 핸들러가 portfolio 객체 전체를 업데이트하도록 변경 */}
                <button
                    onClick={() => onUpdate('portfolio', { ...scenario.settings.portfolio, useSimpleMode: true })}
                    style={{
                        padding: '6px 16px',
                        borderRadius: '9999px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: useSimpleMode ? '#1f2937' : 'white',
                        backgroundColor: useSimpleMode ? '#a5f3fc' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out'
                    }}
                >
                    Simple Mode
                </button>
                {/* [수정] onClick 핸들러가 portfolio 객체 전체를 업데이트하도록 변경 */}
                <button
                    onClick={() => onUpdate('portfolio', { ...scenario.settings.portfolio, useSimpleMode: false })}
                    style={{
                        padding: '6px 16px',
                        borderRadius: '9999px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: !useSimpleMode ? '#1f2937' : 'white',
                        backgroundColor: !useSimpleMode ? '#a5f3fc' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out'
                    }}
                >
                    Advanced Mode
                </button>
            </div>
        </div>

            {/*
                선택된 모드에 따라 '단순 모드 UI' 또는 '고급 모드 UI'가
                이 아래에 표시될 것입니다.
            */}
            <div style={{ marginTop: '16px' }}>
                {useSimpleMode ? (
            // --- [신규] 단순 모드 UI ---
            <div>
                <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>
                    Initial Asset Totals
                </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', alignItems: 'end' }}>
                        {/* [수정] Simple Mode가 initialBalances를 직접 수정하도록 변경 */}
                        <div>
                            <label style={labelStyle} htmlFor="rrspTotal">RRSP Total</label>
                            <input
                                type="number"
                                id="rrspTotal"
                                style={inputStyle}
                                value={scenario.settings.initialBalances.rrsp}
                                onChange={(e) => onUpdate('initialBalances', { ...scenario.settings.initialBalances, rrsp: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                        <div>
                            <label style={labelStyle} htmlFor="tfsaTotal">TFSA Total</label>
                            <input
                                type="number"
                                id="tfsaTotal"
                                style={inputStyle}
                                value={scenario.settings.initialBalances.tfsa}
                                onChange={(e) => onUpdate('initialBalances', { ...scenario.settings.initialBalances, tfsa: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                        <div>
                            <label style={labelStyle} htmlFor="nonRegTotal">Non-Registered Total</label>
                            <input
                                type="number"
                                id="nonRegTotal"
                                style={inputStyle}
                                value={scenario.settings.initialBalances.nonReg}
                                onChange={(e) => onUpdate('initialBalances', { ...scenario.settings.initialBalances, nonReg: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                        {/* --- [추가] ACB 비율 입력 필드 --- */}
                        <div>
                            <label style={{...labelStyle, display: 'flex', alignItems: 'center', gap: '8px'}} htmlFor="nonRegAcbRatio">
                                <span>ACB Ratio (%)</span>
                                <Tooltip text="Adjusted Cost Base (ACB) as a percentage of the Non-Registered Total. This is used to estimate capital gains tax. Example: If your total is $100k and ACB is $75k, enter 75.">
                                    <svg style={{color: '#9ca3af', cursor: 'pointer', height: '16px', width: '16px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                    </svg>
                                </Tooltip>
                            </label>
                            <input
                                type="number"
                                id="nonRegAcbRatio"
                                style={inputStyle}
                                value={scenario.settings.initialBalances.nonRegAcbRatio}
                                onChange={(e) => onUpdate('initialBalances', { ...scenario.settings.initialBalances, nonRegAcbRatio: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                        <div>
                            <label style={labelStyle} htmlFor="checkingBalance">Checking Balance</label>
                            <input
                                type="number"
                                id="checkingBalance"
                                style={inputStyle}
                                value={scenario.settings.initialBalances.checking}
                                onChange={(e) => onUpdate('initialBalances', { ...scenario.settings.initialBalances, checking: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                        {/* ★★★ 수정된 부분 시작 ★★★ */}
                        <div>
                            <label style={{...labelStyle, display: 'flex', alignItems: 'center', gap: '8px'}} htmlFor="checkingMaxBalance">
                                <span>Max Checking Balance</span>
                                <Tooltip text="The maximum balance to keep in the checking account. Surplus cash above this amount (plus next year's estimated tax) will be reinvested at the end of each year.">
                                    <svg style={{color: '#9ca3af', cursor: 'pointer', height: '16px', width: '16px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                    </svg>
                                </Tooltip>
                            </label>
                            <input
                                type="number"
                                id="checkingMaxBalance"
                                style={inputStyle}
                                value={scenario.settings.initialBalances.maxChecking}
                                onChange={(e) => onUpdate('initialBalances', { ...scenario.settings.initialBalances, maxChecking: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                        {/* ★★★ 수정된 부분 끝 ★★★ */}
                    </div>

                    {/* --- [신규] 포트폴리오 배분 입력 UI --- */}
                    <CompositionInputs
                        title="Start Composition"
                        composition={scenario.settings.portfolio.startComposition}
                        onCompositionChange={(assetKey, newValue) => handleCompositionChange('startComposition', assetKey, newValue)}
                    />
                    <CompositionInputs
                        title="End Composition"
                        composition={scenario.settings.portfolio.endComposition}
                        onCompositionChange={(assetKey, newValue) => handleCompositionChange('endComposition', assetKey, newValue)}
                    />
                </div>
            ) : (
                // --- [신규] 고급 모드 UI ---
            <div className="overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                        <thead>
                            <tr>
                                <th style={{ ...tableHeaderStyle, textAlign: 'left' }}>Account</th>
                                {assetKeys.map(key => <th key={key} style={tableHeaderStyle}>{key.charAt(0).toUpperCase() + key.slice(1)}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {accountKeys.map(acctKey => (
                                <tr key={acctKey} style={{ borderBottom: '1px solid #374151' }}>
                                    <td style={{ ...tableCellStyle, fontWeight: '600' }}>{acctKey.toUpperCase()}</td>
                                    {assetKeys.map(assetKey => (
                                        <td key={assetKey} style={tableCellStyle}>
                                            {acctKey === 'nonReg' ? (
                                                // Non-Registered 계좌는 Amount와 ACB 두 개 입력
                                                <div>
                                                    <label style={{fontSize: '12px', color: '#9ca3af'}}>Amount</label>
                                                    <input
                                                        type="number"
                                                        style={tableInputStyle}
                                                        value={scenario.settings.advancedSettings[acctKey]?.holdings?.[assetKey] || 0}
                                                        onChange={(e) => handleAdvancedChange(acctKey, assetKey, 'holdings', e.target.value)}
                                                    />
                                                    <label style={{fontSize: '12px', color: '#9ca3af', marginTop: '4px'}}>ACB</label>
                                                    <input
                                                        type="number"
                                                        style={tableInputStyle}
                                                        value={scenario.settings.advancedSettings[acctKey]?.acb?.[assetKey] || 0}
                                                        onChange={(e) => handleAdvancedChange(acctKey, assetKey, 'acb', e.target.value)}
                                                    />
                                                </div>
                                            ) : (
                                                // RRSP, TFSA는 Amount만 입력
                                                <div>
                                                    <label style={{fontSize: '12px', color: '#9ca3af'}}>Amount</label>
                                                    <input
                                                        type="number"
                                                        style={tableInputStyle}
                                                        value={scenario.settings.advancedSettings[acctKey]?.holdings?.[assetKey] || 0}
                                                        onChange={(e) => handleAdvancedChange(acctKey, assetKey, 'holdings', e.target.value)}
                                                    />
                                                </div>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
	  </div>
       </div>
    );
};
