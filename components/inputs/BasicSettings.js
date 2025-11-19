// --- components/inputs/BasicSettings.js ---

const BasicSettings = ({ scenario, onUpdate }) => {
    const { province, birthYear, startYear, endYear } = scenario.settings;
    const lifeExpectancy = endYear - birthYear;

    // ★★★ [수정] 배우자 설정 데이터 초기화 (cppIncome 추가) ★★★
    const spouse = scenario.settings.spouse || {
        hasSpouse: false,
        birthYear: birthYear, 
        cppIncome: 0,     // [신설] CPP Sharing 전용 소득
        pensionIncome: 0, // [기존] Pension Splitting 대상 소득
        baseIncome: 0,    // [기존] 스플릿 불가능 소득
        optimizeCppSharing: false,
        useSpouseAgeForRrif: false
    };

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
        'FED': { limit: 50, text: "Federal jurisdiction allows 50% unlocking." }
    };

    const currentRule = UNLOCKING_RULES[province] || { limit: 0, text: "Check your specific provincial legislation." };
    const userUnlockingPercent = scenario.settings.lockedIn ? scenario.settings.lockedIn.unlockingPercent : 0;
    const showWarning = userUnlockingPercent > currentRule.limit;

    const handleSettingChange = (key, value) => {
        const numericValue = !isNaN(parseFloat(value)) ? parseFloat(value) : value;
        onUpdate(key, numericValue);
    };

    // ★★★ [수정] 배우자 설정 변경 핸들러 (cppIncome 처리 추가) ★★★
    const handleSpouseChange = (key, value) => {
        // 숫자로 변환해야 하는 필드들 목록에 cppIncome 추가
        const numericKeys = ['birthYear', 'cppIncome', 'pensionIncome', 'baseIncome'];
        
        const numericValue = numericKeys.includes(key)
            ? (parseFloat(value) || 0) 
            : value;
        
        const newSpouseSettings = { ...spouse, [key]: numericValue };
        onUpdate('spouse', newSpouseSettings);
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

    const checkboxStyle = {
        width: '16px',
        height: '16px',
        marginRight: '8px',
        cursor: 'pointer'
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
                        value={endYear - birthYear}
                        onChange={(e) => handleSettingChange('endYear', birthYear + parseInt(e.target.value, 10))}
                    >
                        {lifeExpectancyOptions.map(age => <option key={age} value={age}>{age}</option>)}
                    </select>
                </div>
            </div>

            {/* ★★★ Spouse Settings 섹션 (3단 분리 입력 적용) ★★★ */}
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', marginTop: '24px', borderTop: '1px solid #374151', paddingTop: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                Spouse Information
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', fontWeight: 'normal', cursor: 'pointer', color: '#a5f3fc' }}>
                    <input 
                        type="checkbox" 
                        checked={spouse.hasSpouse} 
                        onChange={(e) => handleSpouseChange('hasSpouse', e.target.checked)} 
                        style={checkboxStyle} 
                    />
                    Has Spouse?
                </label>
            </h3>

            {spouse.hasSpouse && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div>
                        <label style={labelStyle}>Spouse Birth Year</label>
                        <select
                            style={inputStyle}
                            value={spouse.birthYear}
                            onChange={(e) => handleSpouseChange('birthYear', e.target.value)}
                        >
                            {birthYearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    {/* [신설] Spouse CPP (Sharing 대상) */}
                    <div>
                        <label style={{...labelStyle, display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <span>Spouse CPP ($/yr)</span>
                            <Tooltip text="Spouse's Canada Pension Plan income. If 'Optimize CPP Sharing' is checked, this will be pooled with your CPP and split 50/50 for tax purposes.">
                                <svg style={{color: '#9ca3af', cursor: 'pointer', height: '16px', width: '16px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                            </Tooltip>
                        </label>
                        <input
                            type="number"
                            style={inputStyle}
                            value={spouse.cppIncome}
                            onChange={(e) => handleSpouseChange('cppIncome', e.target.value)}
                        />
                    </div>

                    {/* [기존] Pension Income (Splitting 대상) */}
                    <div>
                        <label style={{...labelStyle, display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <span>Eligible Pension ($/yr)</span>
                            <Tooltip text="Income eligible for Pension Income Splitting (e.g., RRIF, LIF, DB Pension). Up to 50% can be allocated to the lower-income spouse to reduce tax.">
                                <svg style={{color: '#9ca3af', cursor: 'pointer', height: '16px', width: '16px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                            </Tooltip>
                        </label>
                        <input
                            type="number"
                            style={inputStyle}
                            value={spouse.pensionIncome}
                            onChange={(e) => handleSpouseChange('pensionIncome', e.target.value)}
                        />
                    </div>

                    {/* [기존] Base Income (Splitting 불가) */}
                    <div>
                        <label style={{...labelStyle, display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <span>Base Income ($/yr)</span>
                            <Tooltip text="Income NOT eligible for splitting (e.g., OAS, Employment Income, Investment Income).">
                                <svg style={{color: '#9ca3af', cursor: 'pointer', height: '16px', width: '16px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                            </Tooltip>
                        </label>
                        <input
                            type="number"
                            style={inputStyle}
                            value={spouse.baseIncome}
                            onChange={(e) => handleSpouseChange('baseIncome', e.target.value)}
                        />
                    </div>
                    
                    {/* 전략 토글 스위치들 */}
                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '20px', marginTop: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', cursor: 'pointer', color: '#e5e7eb' }}>
                            <input 
                                type="checkbox" 
                                checked={spouse.optimizeCppSharing} 
                                onChange={(e) => handleSpouseChange('optimizeCppSharing', e.target.checked)} 
                                style={checkboxStyle} 
                            />
                            Optimize CPP Sharing (50:50)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', cursor: 'pointer', color: '#e5e7eb' }}>
                            <input 
                                type="checkbox" 
                                checked={spouse.useSpouseAgeForRrif} 
                                onChange={(e) => handleSpouseChange('useSpouseAgeForRrif', e.target.checked)} 
                                style={checkboxStyle} 
                            />
                            Use Spouse Age for RRIF Minimum
                        </label>
                    </div>
                </div>
            )}

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
                        value={scenario.settings.lockedIn ? scenario.settings.lockedIn.conversionAge : 71}
                        onChange={(e) => handleSettingChange('lockedIn.conversionAge', e.target.value)}
                    />
                </div>
                
                {/* Unlocking % 입력 필드 및 가이드 */}
                <div>
                    <label style={labelStyle} htmlFor="unlockingPercent">Unlocking % (to RRSP)</label>
                    <input
                        type="number"
                        id="unlockingPercent"
                        style={{...inputStyle, borderColor: showWarning ? '#f59e0b' : '#4b5563'}}
                        value={scenario.settings.lockedIn ? scenario.settings.lockedIn.unlockingPercent : 0}
                        onChange={(e) => handleSettingChange('lockedIn.unlockingPercent', e.target.value)}
                    />
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                        {currentRule.text}
                    </div>
                    {showWarning && (
                        <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg style={{width:'12px', height:'12px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            <span>High value for {province}. Normally limited to {currentRule.limit}%. (Allowed for small balances)</span>
                        </div>
                    )}
                </div>

                {/* CANSIM Rate 툴팁 개선 */}
                <div>
                    <label style={{...labelStyle, display: 'flex', alignItems: 'center', gap: '8px'}} htmlFor="cansimRate">
                        <span>LIF CANSIM Rate (%)</span>
                        <Tooltip text="A government benchmark rate used to calculate the maximum you can withdraw from a LIF. Higher rates = higher max withdrawal limits. Lower rates = lower limits. (Note: Minimum withdrawal is determined only by age.)">
                            <svg style={{color: '#9ca3af', cursor: 'pointer', height: '16px', width: '16px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                        </Tooltip>
                    </label>
                    <input
                        type="number"
                        id="cansimRate"
                        style={inputStyle}
                        value={scenario.settings.lockedIn ? scenario.settings.lockedIn.cansimRate : 3.5}
                        onChange={(e) => handleSettingChange('lockedIn.cansimRate', e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
};
