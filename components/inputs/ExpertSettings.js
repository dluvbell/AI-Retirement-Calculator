// --- components/inputs/ExpertSettings.js ---

const ExpertSettings = ({ scenario, onUpdate }) => {
    // 모달 열림/닫힘 상태
    const [isModalOpen, setIsModalOpen] = React.useState(false);

    const toggleModal = () => {
        setIsModalOpen(prev => !prev);
    };

    // 전문가 설정 값을 업데이트하는 핸들러 함수
    const handleSettingChange = (key, value, isExpertParam = false) => {
        const numericValue = typeof value === 'boolean' ? value : parseFloat(value) || 0;

        if (isExpertParam) {
            // expertMode.params 내부의 값을 업데이트
            const newExpertParams = { ...scenario.settings.expertMode.params, [key]: numericValue };
            const newExpertMode = { ...scenario.settings.expertMode, params: newExpertParams };
            onUpdate('expertMode', newExpertMode);
        } else if (key === 'expertMode.enabled') {
            // expertMode의 활성화 여부를 업데이트
            const newExpertMode = { ...scenario.settings.expertMode, enabled: numericValue };
            onUpdate('expertMode', newExpertMode);
        } else {
            // settings 최상위 레벨의 값을 업데이트 (예: rebalanceThreshold)
            onUpdate(key, numericValue);
        }
    };

    // --- 스타일 정의 ---
    const toggleContainerStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px'
    };

    const toggleLabelStyle = {
        color: '#d1d5db',
        fontSize: '14px',
        fontWeight: '500'
    };

    const modalOverlayStyle = {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        opacity: isModalOpen ? 1 : 0,
        visibility: isModalOpen ? 'visible' : 'hidden',
        transition: 'opacity 0.3s ease-in-out'
    };

    const modalContentStyle = {
        backgroundColor: '#1f2937',
        padding: '24px',
        borderRadius: '8px',
        width: '400px',
        maxWidth: '90%',
        maxHeight: '80vh',
        overflowY: 'auto',
        position: 'relative',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    };

    const closeButtonStyle = {
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'none',
        border: 'none',
        color: '#9ca3af',
        cursor: 'pointer',
        fontSize: '18px'
    };

    const formRowStyle = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px'
    };

    const formLabelStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '14px',
        fontWeight: '500',
        color: '#d1d5db'
    };

    const formInputStyle = {
        width: '100px',
        padding: '6px 10px',
        backgroundColor: '#374151',
        border: '1px solid #4b5563',
        borderRadius: '6px',
        color: 'white',
        textAlign: 'right'
    };

    const tooltipIconStyle = {
        color: '#9ca3af',
        cursor: 'pointer',
        height: '16px',
        width: '16px'
    };

    return (
        <>
            {/* --- 토글 스위치 --- */}
            <div style={toggleContainerStyle}>
                <label style={toggleLabelStyle}>Enable Expert Settings</label>
                <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={isModalOpen}
                        onChange={toggleModal}
                    />
                    <div className="relative w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            {/* --- 모달 팝업 --- */}
            {isModalOpen && (
                <div style={modalOverlayStyle} onClick={toggleModal}>
                    <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                        <button style={closeButtonStyle} onClick={toggleModal}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                        <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>
                            Expert Settings
                        </h2>

                        {/* --- Enable/Disable Toggle --- */}
                        <div style={{ ...formRowStyle, paddingBottom: '16px', borderBottom: '1px dashed #374151' }}>
                            <label style={formLabelStyle}>
                                Enable Expert Mode
                                <Tooltip text="Enable to override automatic strategies with manual parameters. When disabled, the simulator uses a balanced, default strategy.">
                                    <svg style={tooltipIconStyle} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                    </svg>
                                </Tooltip>
                            </label>
                            <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={scenario.settings.expertMode.enabled}
                                    onChange={e => handleSettingChange('expertMode.enabled', e.target.checked)}
                                />
                                <div className="relative w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        {/* --- Settings Inputs --- */}
                        <div style={{ opacity: scenario.settings.expertMode.enabled ? 1 : 0.5, transition: 'opacity 0.3s' }}>
                            <div style={{ ...formRowStyle, marginTop: '16px' }}>
                                <label style={formLabelStyle}>
                                    Rebalancing Threshold (%)
                                    <Tooltip text="The portfolio rebalances only if an asset class deviates from its target by more than this percentage. Example: 0 for annual rebalancing, 5 to rebalance only when an asset is off by >5%.">
                                        <svg style={tooltipIconStyle} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                        </svg>
                                    </Tooltip>
                                </label>
                                <input
                                    type="number"
                                    style={formInputStyle}
                                    value={scenario.settings.rebalanceThreshold}
                                    onChange={e => handleSettingChange('rebalanceThreshold', e.target.value)}
                                />
                            </div>

                            <div style={formRowStyle}>
                                <label style={formLabelStyle}>
                                    Tax Bracket Inflation Rate (%)
                                    <Tooltip text="The annual inflation rate applied to tax brackets and credits like BPA, OAS Clawback, etc. Default is 2.5%.">
                                        <svg style={tooltipIconStyle} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                        </svg>
                                    </Tooltip>
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    style={formInputStyle}
                                    disabled={!scenario.settings.expertMode.enabled}
                                    value={scenario.settings.taxInflationRate}
                                    onChange={e => handleSettingChange('taxInflationRate', e.target.value)}
                                />
                            </div>

                            <div style={formRowStyle}>
                                <label style={formLabelStyle}>
                                    Look-Ahead Period (Years)
                                    <Tooltip text="How many years the engine looks into the future to anticipate tax changes and make smarter withdrawal decisions. Default is 7 years.">
                                        <svg style={tooltipIconStyle} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                        </svg>
                                    </Tooltip>
                                </label>
                                <input
                                    type="number"
                                    style={formInputStyle}
                                    disabled={!scenario.settings.expertMode.enabled}
                                    value={scenario.settings.expertMode.params.lookAheadYears}
                                    onChange={e => handleSettingChange('lookAheadYears', e.target.value, true)}
                                />
                            </div>

                            <div style={formRowStyle}>
                                <label style={formLabelStyle}>
                                    TFSA Withdrawal Penalty
                                    <Tooltip text="A factor to discourage TFSA withdrawals, making it a last resort. Higher values increase the penalty. Example: 0.07 is a moderate penalty.">
                                        <svg style={tooltipIconStyle} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                        </svg>
                                    </Tooltip>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    style={formInputStyle}
                                    disabled={!scenario.settings.expertMode.enabled}
                                    value={scenario.settings.expertMode.params.tfsaWithdrawalPenalty}
                                    onChange={e => handleSettingChange('tfsaWithdrawalPenalty', e.target.value, true)}
                                />
                            </div>

                            <div style={{ ...formRowStyle, marginBottom: 0 }}>
                                <label style={formLabelStyle}>
                                    RRSP Withdrawal Bonus
                                    <Tooltip text="A factor to encourage RRSP withdrawals, especially in low-income years to smooth out taxes. Higher values increase the bonus. Example: 0.02 is a small bonus.">
                                        <svg style={tooltipIconStyle} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                        </svg>
                                    </Tooltip>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    style={formInputStyle}
                                    disabled={!scenario.settings.expertMode.enabled}
                                    value={scenario.settings.expertMode.params.rrspWithdrawalBonus}
                                    onChange={e => handleSettingChange('rrspWithdrawalBonus', e.target.value, true)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};