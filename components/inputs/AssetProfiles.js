// --- components/inputs/AssetProfiles.js ---

const AssetProfiles = ({ scenario, onUpdate, useSimpleMode }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [editingData, setEditingData] = React.useState(null);

    const deepCopy = (obj) => JSON.parse(JSON.stringify(obj));

    const handleOpen = () => {
        const dataToEdit = {
            assetProfiles: deepCopy(scenario.settings.assetProfiles)
        };
        // 어드밴스드 모드일 때만 End Composition 데이터를 복사
        if (!useSimpleMode) {
            dataToEdit.rrspEndComposition = deepCopy(scenario.settings.rrsp.endComposition);
            dataToEdit.tfsaEndComposition = deepCopy(scenario.settings.tfsa.endComposition);
            dataToEdit.nonRegEndComposition = deepCopy(scenario.settings.nonReg.endComposition);
        }
        setEditingData(dataToEdit);
        setIsOpen(true);
    };

    const handleClose = () => {
        setIsOpen(false);
        setEditingData(null);
    };

    const handleSave = () => {
        onUpdate('assetProfiles', editingData.assetProfiles);
        // 어드밴스드 모드일 때만 End Composition 데이터를 저장
        if (!useSimpleMode) {
            onUpdate('rrsp', { ...scenario.settings.rrsp, endComposition: editingData.rrspEndComposition });
            onUpdate('tfsa', { ...scenario.settings.tfsa, endComposition: editingData.tfsaEndComposition });
            onUpdate('nonReg', { ...scenario.settings.nonReg, endComposition: editingData.nonRegEndComposition });
        }
        handleClose();
    };

    const handleProfileChange = (assetKey, field, value) => {
        const numericValue = parseFloat(value) || 0;
        setEditingData(prev => ({
            ...prev,
            assetProfiles: {
                ...prev.assetProfiles,
                [assetKey]: {
                    ...prev.assetProfiles[assetKey],
                    [field]: numericValue,
                },
            },
        }));
    };

    const handleEndCompositionChange = (accountKey, assetKey, value) => {
        const numericValue = parseFloat(value) || 0;
        const stateKey = `${accountKey}EndComposition`;

        setEditingData(prev => ({
            ...prev,
            [stateKey]: {
                ...prev[stateKey],
                [assetKey]: numericValue,
            },
        }));
    };

    const CompositionInputs = ({ title, composition, onCompositionChange }) => {
        const total = Object.values(composition).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        let totalColor = '#facc15';
        if (Math.abs(total - 100) < 0.01) totalColor = '#4ade80';
        else if (total > 100) totalColor = '#f87171';

        const inputStyle = { width: '100%', padding: '6px 8px', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '4px', color: 'white', fontSize: '14px', textAlign: 'right' };
        const labelStyle = { display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '2px' };
        
        // [AI 2.0] 6개 자산군으로 수정
        const assetKeys = ['growth', 'balanced', 'dividend_can', 'dividend_us', 'bond', 'gic'];

        return (
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#2d3748', borderRadius: '6px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '10px', color: '#d1d5db' }}>{title}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '10px' }}>
                    {assetKeys.map(key => (
                        <div key={key}>
                            <label style={labelStyle}>{key.charAt(0).toUpperCase() + key.slice(1)} (%)</label>
                            <input type="number" step="0.1" style={inputStyle} value={composition[key] || 0} onChange={(e) => onCompositionChange(key, e.target.value)} />
                        </div>
                    ))}
                </div>
                <div style={{ marginTop: '10px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold', color: totalColor }}>Total: {total.toFixed(2)}%</div>
            </div>
        );
    };

    // --- 스타일 정의 (생략 없이 유지) ---
    const buttonStyle = { width: '100%', padding: '10px 16px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500', marginTop: '20px' };
    const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' };
    const modalContentStyle = { backgroundColor: '#1f2937', padding: '24px', borderRadius: '8px', border: '1px solid #374151', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' };
    const h3Style = { fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: 'white' };
    const tableStyle = { width: '100%', borderCollapse: 'collapse', marginTop: '20px' };
    const thStyle = { padding: '10px 12px', borderBottom: '2px solid #4b5563', fontSize: '14px', fontWeight: '600', textAlign: 'left', color: '#d1d5db' };
    const tdStyle = { padding: '8px 12px', borderBottom: '1px solid #374151' };
    const inputStyle = { width: '100%', padding: '6px 8px', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '4px', color: 'white', fontSize: '14px', textAlign: 'right' };
    const modalActionsStyle = { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' };
    const actionButtonStyle = { padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '500' };

    // [AI 2.0] data.js가 수정되었으므로, 이 코드는 자동으로 6개 자산군을 불러옵니다.
    const assetKeys = Object.keys(scenario.settings.assetProfiles);
    const accountKeys = ['rrsp', 'tfsa', 'nonReg'];

    // --- [수정] 버튼 텍스트를 모드에 따라 동적으로 변경 ---
    const buttonText = useSimpleMode
        ? "Edit Asset Profiles (Growth, Volatility)"
        : "Edit Asset Profiles & End Compositions";

    return (
        <div>
            <button style={buttonStyle} onClick={handleOpen}>
                {buttonText}
            </button>

            {isOpen && (
                <div style={modalOverlayStyle} onClick={handleClose}>
                    <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                        <h3 style={h3Style}>{buttonText}</h3>

                        <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#a5f3fc' }}>Asset Class Profiles</h4>
                        <div className="overflow-x-auto">
                            <table style={tableStyle}>
                                <thead>
                                    <tr>
                                        <th style={thStyle}>Asset Class</th>
                                        <th style={{...thStyle, textAlign: 'right'}}>Expected Growth (%)</th>
                                        {/* ★★★ 배당률 헤더 추가 ★★★ */}
                                        <th style={{...thStyle, textAlign: 'right'}}>Dividend/Interest (%)</th>
                                        <th style={{...thStyle, textAlign: 'right'}}>Volatility (%)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {editingData && assetKeys.map(key => (
                                        <tr key={key}>
                                            <td style={{...tdStyle, fontWeight: '500', color: '#d1d5db'}}>{key.charAt(0).toUpperCase() + key.slice(1)}</td>
                                            <td style={tdStyle}><input type="number" step="0.1" style={inputStyle} value={editingData.assetProfiles[key].appreciation} onChange={e => handleProfileChange(key, 'appreciation', e.target.value)} /></td>
                                            {/* ★★★ 배당률 입력 필드 추가 ★★★ */}
                                            <td style={tdStyle}><input type="number" step="0.1" style={inputStyle} value={editingData.assetProfiles[key].dividendYield} onChange={e => handleProfileChange(key, 'dividendYield', e.target.value)} /></td>
                                            <td style={tdStyle}><input type="number" step="0.1" style={inputStyle} value={editingData.assetProfiles[key].volatility} onChange={e => handleProfileChange(key, 'volatility', e.target.value)} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* --- [수정] 어드밴스드 모드일 때만 End Composition 섹션을 렌더링 --- */}
                        {!useSimpleMode && editingData && (
                            <>
                                <h4 style={{ fontSize: '16px', fontWeight: '600', marginTop: '30px', marginBottom: '12px', color: '#a5f3fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>End of Life Composition (by Account)</span>
                                    <Tooltip text="Define a specific target asset allocation for each account at the end of the simulation. This overrides the global 'End Composition' from Simple Mode.">
                                        <svg style={{color: '#9ca3af', cursor: 'pointer', height: '16px', width: '16px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                        </svg>
                                    </Tooltip>
                                </h4>
                                {accountKeys.map(acctKey => (
                                    <CompositionInputs
                                        key={acctKey}
                                        title={`${acctKey.toUpperCase()} End Composition`}
                                        composition={editingData[`${acctKey}EndComposition`]}
                                        onCompositionChange={(assetKey, newValue) => handleEndCompositionChange(acctKey, assetKey, newValue)}
                                    />
                                ))}
                            </>
                        )}

                        <div style={modalActionsStyle}>
                            <button style={{...actionButtonStyle, backgroundColor: '#4b5563', color: 'white'}} onClick={handleClose}>Cancel</button>
                            <button style={{...actionButtonStyle, backgroundColor: '#2563eb', color: 'white'}} onClick={handleSave}>Save Changes</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};