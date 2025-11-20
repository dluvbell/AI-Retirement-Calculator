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

    // 툴팁 텍스트를 title에 따라 동적으로 결정합니다
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
    
    // 6개 자산군으로 수정
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

    const { useSimpleMode } = scenario.settings.portfolio;
    // ★★★ [신설] 배우자 활성화 여부 확인 ★★★
    const hasSpouse = scenario.settings.spouseSettings && scenario.settings.spouseSettings.enabled;

    // [신규] 단순 모드에서 계좌 총액이 변경될 때 호출되는 함수
    const handleTotalChange = (accountKey, newTotalValue) => {
        // Simple Mode에서는 initialBalances를 직접 수정하므로 이 함수는 사용되지 않을 수 있으나,
        // Advanced Mode와의 호환성을 위해 남겨둘 수 있음. 
        // (현재 로직상 Simple Mode는 input onChange에서 직접 onUpdate('initialBalances', ...)를 호출함)
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

    // [추가] Simple Mode 클릭 시 override 플래그를 false로 설정
    const handleSimpleModeClick = () => {
        onUpdate('portfolio', { ...scenario.settings.portfolio, useSimpleMode: true });
        // 모든 계좌의 override를 false로
        const accounts = ['rrsp', 'tfsa', 'nonReg', 'lira', 'lif', 'spouse_rrsp', 'spouse_tfsa', 'spouse_nonReg', 'spouse_lira', 'spouse_lif'];
        const newAdvancedSettings = { ...scenario.settings.advancedSettings };
        
        accounts.forEach(key => {
            if (newAdvancedSettings[key]) {
                newAdvancedSettings[key] = { ...newAdvancedSettings[key], override: false };
            }
        });
        onUpdate('advancedSettings', newAdvancedSettings);
    };

    // [추가] Advanced Mode 클릭 시 override 플래그를 true로 설정
    const handleAdvancedModeClick = () => {
        onUpdate('portfolio', { ...scenario.settings.portfolio, useSimpleMode: false });
        // 모든 계좌의 override를 true로
        const accounts = ['rrsp', 'tfsa', 'nonReg', 'lira', 'lif', 'spouse_rrsp', 'spouse_tfsa', 'spouse_nonReg', 'spouse_lira', 'spouse_lif'];
        const newAdvancedSettings = { ...scenario.settings.advancedSettings };
        
        accounts.forEach(key => {
            if (newAdvancedSettings[key]) {
                newAdvancedSettings[key] = { ...newAdvancedSettings[key], override: true };
            }
        });
        onUpdate('advancedSettings', newAdvancedSettings);
    };

    // [신규] 고급 모드에서 자산/ACB 값이 변경될 때 호출되는 함수
    const handleAdvancedChange = (accountKey, assetKey, field, value) => {
        const numericValue = parseFloat(value) || 0;
        const account = scenario.settings.advancedSettings[accountKey];

        const newAccountData = {
            ...account,
            [field]: { // 'field' is 'holdings' or 'acb'
                ...account[field],
                [assetKey]: numericValue
            }
        };
        onUpdate(`advancedSettings.${accountKey}`, newAccountData);
    };

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
        marginBottom: '4px',
        color: '#d1d5db'
    };

    const subLabelStyle = {
        fontSize: '12px', color: '#9ca3af', marginBottom: '2px', display:'block'
    };

    // [AI 2.0] 자산군 정의
    const assetKeys = ['growth', 'balanced', 'dividend_can', 'dividend_us', 'bond', 'gic'];
    
    // ★★★ [수정] Advanced Mode 테이블용 계좌 키 목록 동적 생성 ★★★
    let accountKeys = ['rrsp', 'tfsa', 'nonReg', 'lira', 'lif'];
    if (hasSpouse) {
        // 부부 계좌를 나란히 또는 교차해서 보여주기 위해 배열 재구성
        accountKeys = [
            'rrsp', 'spouse_rrsp',
            'tfsa', 'spouse_tfsa',
            'nonReg', 'spouse_nonReg',
            'lira', 'spouse_lira',
            'lif', 'spouse_lif'
        ];
    }

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

    // Simple Mode 입력 그룹 렌더링 헬퍼
    const renderSimpleInputGroup = (label, clientKey, spouseKey, tooltipText = null) => (
        <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>{label}</label>
                {tooltipText && (
                    <Tooltip text={tooltipText}>
                        <svg style={{color: '#9ca3af', cursor: 'pointer', height: '16px', width: '16px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                    </Tooltip>
                )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: hasSpouse ? '1fr 1fr' : '1fr', gap: '16px' }}>
                <div>
                    {hasSpouse && <span style={subLabelStyle}>Client</span>}
                    <input
                        type="number"
                        style={inputStyle}
                        value={scenario.settings.initialBalances[clientKey]}
                        onChange={(e) => onUpdate('initialBalances', { ...scenario.settings.initialBalances, [clientKey]: parseFloat(e.target.value) || 0 })}
                    />
                </div>
                {hasSpouse && (
                    <div>
                        <span style={subLabelStyle}>Spouse</span>
                        <input
                            type="number"
                            style={inputStyle}
                            value={scenario.settings.initialBalances[spouseKey]}
                            onChange={(e) => onUpdate('initialBalances', { ...scenario.settings.initialBalances, [spouseKey]: parseFloat(e.target.value) || 0 })}
                        />
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div style={{ backgroundColor: '#1f2937', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
                Assets & Strategy
            </h3>
            
            {/* --- 모드 토글 스위치 --- */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#374151', borderRadius: '9999px', padding: '4px' }}>
                    <button
                        onClick={handleSimpleModeClick}
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
                    <button
                        onClick={handleAdvancedModeClick}
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

            <div style={{ marginTop: '16px' }}>
                {useSimpleMode ? (
                    // --- 단순 모드 UI ---
                    <div>
                        <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>
                            Initial Asset Totals {hasSpouse && "(Combined View)"}
                        </h4>
                        
                        {/* ★★★ [수정] 부부 통합 입력 필드 ★★★ */}
                        {renderSimpleInputGroup("RRSP Total", "rrsp", "spouse_rrsp")}
                        {renderSimpleInputGroup("TFSA Total", "tfsa", "spouse_tfsa")}
                        {renderSimpleInputGroup("Non-Registered Total", "nonReg", "spouse_nonReg")}
                        {renderSimpleInputGroup("LIRA Total", "lira", "spouse_lira")}
                        {renderSimpleInputGroup("LIF Total", "lif", "spouse_lif")}
                        
                        {/* ACB Ratio (Shared rule for simplicity, applied to both if spouse enabled) */}
                        <div style={{ marginBottom: '16px' }}>
                             <label style={{...labelStyle, display: 'flex', alignItems: 'center', gap: '8px'}}>
                                <span>ACB Ratio (%)</span>
                                <Tooltip text="Adjusted Cost Base (ACB) as a percentage of the Non-Registered Total. Applied to both Client and Spouse (if enabled) in Simple Mode.">
                                    <svg style={{color: '#9ca3af', cursor: 'pointer', height: '16px', width: '16px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                    </svg>
                                </Tooltip>
                            </label>
                            <input
                                type="number"
                                style={inputStyle}
                                value={scenario.settings.initialBalances.nonRegAcbRatio}
                                onChange={(e) => onUpdate('initialBalances', { ...scenario.settings.initialBalances, nonRegAcbRatio: parseFloat(e.target.value) || 0 })}
                            />
                        </div>

                        {/* Chequing Account (Shared/Joint usually) */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Checking Balance (Joint)</label>
                                <input
                                    type="number"
                                    style={inputStyle}
                                    value={scenario.settings.initialBalances.checking}
                                    onChange={(e) => onUpdate('initialBalances', { ...scenario.settings.initialBalances, checking: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div>
                                <label style={{...labelStyle, display: 'flex', alignItems: 'center', gap: '8px'}}>
                                    <span>Max Checking Balance</span>
                                    <Tooltip text="The maximum balance to keep in the checking account. Surplus cash above this amount (plus next year's estimated tax) will be reinvested at the end of each year.">
                                        <svg style={{color: '#9ca3af', cursor: 'pointer', height: '16px', width: '16px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                        </svg>
                                    </Tooltip>
                                </label>
                                <input
                                    type="number"
                                    style={inputStyle}
                                    value={scenario.settings.initialBalances.maxChecking}
                                    onChange={(e) => onUpdate('initialBalances', { ...scenario.settings.initialBalances, maxChecking: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>

                        {/* 포트폴리오 배분 입력 (Shared Glide Path) */}
                        <CompositionInputs
                            title="Start Composition (Shared)"
                            composition={scenario.settings.portfolio.startComposition}
                            onCompositionChange={(assetKey, newValue) => handleCompositionChange('startComposition', assetKey, newValue)}
                        />
                        <CompositionInputs
                            title="End Composition (Shared)"
                            composition={scenario.settings.portfolio.endComposition}
                            onCompositionChange={(assetKey, newValue) => handleCompositionChange('endComposition', assetKey, newValue)}
                        />
                    </div>
                ) : (
                    // --- 고급 모드 UI (테이블) ---
                    <div className="overflow-x-auto">
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                            <thead>
                                <tr>
                                    <th style={{ ...tableHeaderStyle, textAlign: 'left' }}>Account</th>
                                    {assetKeys.map(key => <th key={key} style={tableHeaderStyle}>{key.charAt(0).toUpperCase() + key.slice(1)}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {accountKeys.map(acctKey => {
                                    const isSpouse = acctKey.startsWith('spouse_');
                                    const label = isSpouse ? acctKey.replace('spouse_', '').toUpperCase() + ' (Spouse)' : acctKey.toUpperCase();
                                    const rowColor = isSpouse ? '#374151' : 'transparent'; // 배우자 행 구분 색상

                                    return (
                                        <tr key={acctKey} style={{ borderBottom: '1px solid #374151', backgroundColor: rowColor }}>
                                            <td style={{ ...tableCellStyle, fontWeight: '600', color: isSpouse ? '#a5f3fc' : 'white' }}>
                                                {label}
                                            </td>
                                            {assetKeys.map(assetKey => (
                                                <td key={assetKey} style={tableCellStyle}>
                                                    {(acctKey === 'nonReg' || acctKey === 'spouse_nonReg') ? (
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
                                                        // RRSP, TFSA, LIRA, LIF는 Amount만 입력
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
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
