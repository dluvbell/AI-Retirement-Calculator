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
            // [수정] advancedSettings에 endComposition이 없으면 portfolio의 endComposition을 기본값으로 사용
            dataToEdit.rrspEndComposition = deepCopy(scenario.settings.advancedSettings.rrsp.endComposition || scenario.settings.portfolio.endComposition);
            dataToEdit.tfsaEndComposition = deepCopy(scenario.settings.advancedSettings.tfsa.endComposition || scenario.settings.portfolio.endComposition);
            dataToEdit.nonRegEndComposition = deepCopy(scenario.settings.advancedSettings.nonReg.endComposition || scenario.settings.portfolio.endComposition);
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
            // [수정] settings.advancedSettings의 경로로 데이터를 업데이트합니다.
            onUpdate('advancedSettings.rrsp', { ...scenario.settings.advancedSettings.rrsp, endComposition: editingData.rrspEndComposition });
            onUpdate('advancedSettings.tfsa', { ...scenario.settings.advancedSettings.tfsa, endComposition: editingData.tfsaEndComposition });
            onUpdate('advancedSettings.nonReg', { ...scenario.settings.advancedSettings.nonReg, endComposition: editingData.nonRegEndComposition });
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
                    [field]: numericValue
                }
            }
        }));
    };

    const handleEndCompositionChange = (acctKey, assetKey, value) => {
        const numericValue = parseFloat(value) || 0;
        const compKey = `${acctKey}EndComposition`; // 예: 'rrspEndComposition'
        
        setEditingData(prev => ({
            ...prev,
            [compKey]: {
                ...prev[compKey],
                [assetKey]: numericValue
            }
        }));
    };

    // --- 스타일 정의 ---
    const modalOverlayStyle = {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    };
    const modalContentStyle = {
        backgroundColor: '#1f2937', color: 'white',
        borderRadius: '8px', padding: '24px',
        width: '90%', maxWidth: '800px',
        maxHeight: '80vh', overflowY: 'auto',
        border: '1px solid #374151'
    };
    const modalHeaderStyle = { fontSize: '20px', fontWeight: '600', marginBottom: '16px' };
    const modalActionsStyle = { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' };
    const actionButtonStyle = {
        padding: '8px 16px', borderRadius: '6px',
        border: 'none', cursor: 'pointer',
        fontWeight: '500', transition: 'background-color 0.2s'
    };
    const tableHeaderStyle = { padding: '10px', borderBottom: '2px solid #4b5563', fontSize: '14px', fontWeight: '600', textAlign: 'left' };
    const tableCellStyle = { padding: '8px', borderBottom: '1px solid #374151' };
    const tableInputStyle = {
        width: '100%', padding: '6px 8px', backgroundColor: '#374151',
        border: '1px solid #4b5563', borderRadius: '4px',
        color: 'white', fontSize: '14px'
    };
    const tooltipIconStyle = { color: '#9ca3af', cursor: 'pointer', height: '16px', width: '16px' };

    // [AI 2.0] 6개 자산군 키
    const assetKeys = ['growth', 'balanced', 'dividend_can', 'dividend_us', 'bond', 'gic'];
    const accountKeys = ['rrsp', 'tfsa', 'nonReg'];

    return (
        <div>
            <button
                onClick={handleOpen}
                style={{
                    ...actionButtonStyle,
                    backgroundColor: 'transparent',
                    color: '#a5f3fc',
                    border: '1px solid #a5f3fc',
                    padding: '6px 12px',
                    fontSize: '14px',
                    width: '100%',
                    marginTop: '20px'
                }}
            >
                Manage Asset Profiles
            </button>

            {isOpen && editingData && (
                <div style={modalOverlayStyle} onClick={handleClose}>
                    <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                        <h3 style={modalHeaderStyle}>Manage Asset Profiles</h3>
                        
                        {/* --- 자산 프로파일 테이블 --- */}
                        <div className="overflow-x-auto">
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                                <thead>
                                    <tr>
                                        <th style={tableHeaderStyle}>Asset</th>
                                        <th style={tableHeaderStyle}>Growth %</th>
                                        <th style={tableHeaderStyle}>Dividend %</th>
                                        <th style={tableHeaderStyle}>Volatility %</th>
                                        <th style={tableHeaderStyle}>Div. Growth %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {assetKeys.map(key => (
                                        <tr key={key}>
                                            <td style={tableCellStyle}>{editingData.assetProfiles[key].name}</td>
                                            <td style={tableCellStyle}><input type="number" style={tableInputStyle} value={editingData.assetProfiles[key].growth} onChange={e => handleProfileChange(key, 'growth', e.target.value)} /></td>
                                            <td style={tableCellStyle}><input type="number" style={tableInputStyle} value={editingData.assetProfiles[key].dividend} onChange={e => handleProfileChange(key, 'dividend', e.target.value)} /></td>
                                            <td style={tableCellStyle}><input type="number" style={tableInputStyle} value={editingData.assetProfiles[key].volatility} onChange={e => handleProfileChange(key, 'volatility', e.target.value)} /></td>
                                            <td style={tableCellStyle}><input type="number" style={tableInputStyle} value={editingData.assetProfiles[key].dividend_growth} onChange={e => handleProfileChange(key, 'dividend_growth', e.target.value)} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* --- [신규] 어드밴스드 모드일 때만 End Composition 수정 UI 표시 --- */}
                        {!useSimpleMode && (
                            <>
                                <h4 style={{ fontSize: '16px', fontWeight: '600', marginTop: '24px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>Advanced End Composition</span>
                                    <Tooltip text="Define a specific 'End Composition' target for each account, used only in Advanced Mode.">
                                        <svg style={tooltipIconStyle} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
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
