// --- components/inputs/BasicSettings.js ---

const BasicSettings = ({ scenario, onUpdate }) => {
    const { province, birthYear, startYear, endYear } = scenario.settings;
    const lifeExpectancy = endYear - birthYear;

    // ★★★ [신설] 주별 LIRA Unlocking 규정 데이터 ★★★
    const UNLOCKING_RULES = {
        'ON': { limit: 50, text: "Ontario allows 50% unlocking to RRSP/Cash within 60 days of transfer to LIF." },
        'AB': { limit: 50, text: "Alberta allows 50% unlocking to RRSP/Cash." },
        'MB': { limit: 50, text: "Manitoba allows 50% unlocking." },
        'SK': { limit: 0, text: "Saskatchewan generally does not allow one-time unlocking (0%)." },
        'BC': { limit: 0, text: "BC generally does not allow one-time unlocking (0%), except for small balances." },
        'QC': { limit: 0, text: "Quebec generally does not allow one-time unlocking (0%)." },
        'NS': { limit: 0, text: "Nova Scotia generally does not allow one-time unlocking (0%)." },
        'NB': { limit: 0, text: "New Brunswick generally does not allow one-time unlocking (0%)." },
        'NL': { limit: 0, text: "Newfoundland generally does not allow one-time unlocking (0%)." },
        'PE': { limit: 0, text: "PEI generally does not allow one-time unlocking (0%)." },
        'FED': { limit: 50, text: "Federal jurisdiction allows 50% unlocking." } // 참고용
    };

    const currentRule = UNLOCKING_RULES[province] || { limit: 0, text: "Check your specific provincial legislation." };
    const userUnlockingPercent = scenario.settings.lockedIn.unlockingPercent || 0;
    const showWarning = userUnlockingPercent > currentRule.limit;

    const handleSettingChange = (key, value) => {
        const numericValue = !isNaN(parseFloat(value)) ? parseFloat(value) : value;
        onUpdate(key, numericValue);
    };

    const provinces = [
        { value: 'ON', label: 'Ontario' }, { value: 'QC', label: 'Quebec' },
        { value: 'BC', label: 'British Columbia' }, { value: 'AB', label: 'Alberta' },
        { value: 'MB', label: 'Manitoba' }, { value: 'SK', label: 'Saskatchewan' },
        { value: 'NS', label: 'Nova Scotia' }, { value: 'NB', label: 'New Brunswick' },
        { value: 'NL', label: 'Newfoundland and Labrador' }, { value: 'PE', label: 'Prince Edward Island' },
        { value: 'NT', label: 'Northwest Territories' }, { value: 'NU', label: 'Nunavut' },
        { value: 'YT', label: 'Yukon' }
    ];

    const birthYearOptions = [];
    for (let y = 2100; y >= 1930; y--) {
        birthYearOptions.push(y);
    }

    const lifeExpectancyOptions = [];
    for (let age = 60; age <= 110; age++) {
        lifeExpectancyOptions.push(age);
    }

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

    return (
        <div style={{ backgroundColor: '#1f2937', padding: '20px', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
                Basic Information
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                <div>
                    <label style={labelStyle} htmlFor="province">Province</label>
                    <select
                        id="province"
                        style={inputStyle}
                        value={province}
                        onChange={(e) => handleSettingChange('province', e.target.value)}
                    >
                        {provinces.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                </div>

                <div>
                    <label style={labelStyle} htmlFor="birthYear">Birth Year</label>
                    <select
                        id="birthYear"
                        style={inputStyle}
                        value={birthYear}
                        onChange={(e) => handleSettingChange('birthYear', e.target.value)}
                    >
                        {birthYearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                
                <div>
                    <label style={labelStyle} htmlFor="startYear">Retirement Start Year</label>
                    <select
                        id="startYear"
                        style={inputStyle}
                        value={startYear}
                        onChange={(e) => handleSettingChange('startYear', e.target.value)}
                    >
                        {(() => {
                            const startYearOptions = [];
                            for (let y = 2100; y >= 2020; y--) {
                                const age = y - birthYear;
                                startYearOptions.push({ year: y, age: age });
                            }
                            return startYearOptions.map(item => (
                                <option key={item.year} value={item.year}>
                                    {item.year} (Age: {item.age})
                                </option>
                            ));
                        })()}
                    </select>
                </div>

                <div>
                    <label style={{...labelStyle, display: 'flex', alignItems: 'center', gap: '8px'}} htmlFor="lifeExpectancy">
                        <span>Life Expectancy</span>
                        <Tooltip text="The age at which the simulation ends. This is not a prediction of lifespan, but the financial planning horizon.">
                            <svg style={{color: '#9ca3af', cursor: 'pointer', height: '16px', width: '16px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                        </Tooltip>
                    </label>
                    <select
                        id="lifeExpectancy"
                        style={inputStyle}
                        value={lifeExpectancy}
                        onChange={(e) => {
                            const newEndYear = birthYear + parseInt(e.target.value, 10);
                            handleSettingChange('endYear', newEndYear);
                        }}
                    >
                        {lifeExpectancyOptions.map(age => <option key={age} value={age}>{age}</option>)}
                    </select>
                </div>
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', marginTop: '24px', borderTop: '1px solid #374151', paddingTop: '16px' }}>
                Locked-in Account Settings
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                <div>
                    <label style={labelStyle} htmlFor="conversionAge">LIRA Conversion Age</label>
                    <input
                        type="number"
                        id="conversionAge"
                        style={inputStyle}
                        value={scenario.settings.lockedIn.conversionAge}
                        onChange={(e) => handleSettingChange('lockedIn.conversionAge', e.target.value)}
                    />
                </div>
                
                {/* ★★★ [수정] Unlocking % 입력 필드에 가이드 및 경고 메시지 추가 ★★★ */}
                <div>
                    <label style={labelStyle} htmlFor="unlockingPercent">Unlocking % (to RRSP)</label>
                    <input
                        type="number"
                        id="unlockingPercent"
                        style={{...inputStyle, borderColor: showWarning ? '#f59e0b' : '#4b5563'}} // 경고 시 노란색 테두리
                        value={scenario.settings.lockedIn.unlockingPercent}
                        onChange={(e) => handleSettingChange('lockedIn.unlockingPercent', e.target.value)}
                    />
                    {/* 규정 안내 (기본 회색) */}
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                        {currentRule.text}
                    </div>
                    {/* 경고 메시지 (초과 시 노란색) */}
                    {showWarning && (
                        <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg style={{width:'12px', height:'12px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            <span>High value for {province}. Normally limited to {currentRule.limit}%. (Allowed for small balances)</span>
                        </div>
                    )}
                </div>

                <div>
                    <label style={{...labelStyle, display: 'flex', alignItems: 'center', gap: '8px'}} htmlFor="cansimRate">
                        <span>LIF CANSIM Rate (%)</span>
                        <Tooltip text="The long-term government bond rate (Reference Rate) used to calculate the maximum annual LIF withdrawal limit.">
                            <svg style={{color: '#9ca3af', cursor: 'pointer', height: '16px', width: '16px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                        </Tooltip>
                    </label>
                    <input
                        type="number"
                        id="cansimRate"
                        style={inputStyle}
                        value={scenario.settings.lockedIn.cansimRate}
                        onChange={(e) => handleSettingChange('lockedIn.cansimRate', e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
};
