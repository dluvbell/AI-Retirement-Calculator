// --- components/inputs/BasicSettings.js ---

const BasicSettings = ({ scenario, onUpdate }) => {
    const { province, birthYear, startYear, endYear } = scenario.settings;
    // ★★★ [안전장치] 데이터가 초기화되지 않았을 경우를 대비해 기본값 처리 ★★★
    const spouseSettings = scenario.settings.spouseSettings || { 
        enabled: false, 
        birthYear: birthYear, 
        cppAmount: 0, 
        oasAmount: 0, 
        baseIncome: 0 
    };

    const lifeExpectancy = endYear - birthYear;

    // 주별 LIRA Unlocking 규정 데이터
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

    // ★★★ [신설] 배우자 설정 업데이트 핸들러 ★★★
    const handleSpouseChange = (field, value) => {
        const newValue = field === 'enabled' ? value : (!isNaN(parseFloat(value)) ? parseFloat(value) : value);
        onUpdate('spouseSettings', {
            ...spouseSettings,
            [field]: newValue
        });
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

    const sectionHeaderStyle = {
        fontSize: '18px', 
        fontWeight: '600', 
        marginBottom: '16px', 
        marginTop: '24px', 
        borderTop: '1px solid #374151', 
        paddingTop: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
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

                <div>
                    <label style={{...labelStyle, display: 'flex', alignItems: 'center', gap: '8px'}} htmlFor="generalInflation">
                        <span>General Inflation (%)</span>
                        <Tooltip text="The annual rate at which living expenses, CPP/OAS benefits, and other indexed incomes increase.">
                            <svg style={{color: '#9ca3af', cursor: 'pointer', height: '16px', width: '16px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                        </Tooltip>
                    </label>
                    <input
                        type="number"
                        id="generalInflation"
                        style={inputStyle}
                        value={scenario.settings.generalInflation}
                        onChange={(e) => handleSettingChange('generalInflation', e.target.value)}
                        step="0.1"
                    />
                </div>

                <div>
                    <label style={{...labelStyle, display: 'flex', alignItems: 'center', gap: '8px'}} htmlFor="taxInflationRate">
                        <span>Tax Inflation (%)</span>
                        <Tooltip text="The annual rate at which tax brackets and TFSA contribution limits increase (Indexation). Usually similar to General Inflation.">
                            <svg style={{color: '#9ca3af', cursor: 'pointer', height: '16px', width: '16px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                        </Tooltip>
                    </label>
                    <input
                        type="number"
                        id="taxInflationRate"
                        style={inputStyle}
                        value={scenario.settings.taxInflationRate}
                        onChange={(e) => handleSettingChange('taxInflationRate', e.target.value)}
                        step="0.1"
                    />
                </div>
            </div>

            {/* ★★★ [신설] Spouse Settings Section ★★★ */}
            <div style={sectionHeaderStyle}>
                <span>Spouse Settings (Income Splitting)</span>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span style={{fontSize: '14px', color: spouseSettings.enabled ? '#a5f3fc' : '#6b7280'}}>
                        {spouseSettings.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={spouseSettings.enabled} 
                            onChange={(e) => handleSpouseChange('enabled', e.target.checked)} 
                            className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
            </div>

            {spouseSettings.enabled && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '10px' }}>
                    <div>
                        <label style={labelStyle} htmlFor="spouseBirthYear">Spouse Birth Year</label>
                        <select
                            id="spouseBirthYear"
                            style={inputStyle}
                            value={spouseSettings.birthYear}
                            onChange={(e) => handleSpouseChange('birthYear', e.target.value)}
                        >
                            {birthYearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle} htmlFor="spouseCpp">Spouse Annual CPP</label>
                        <input
                            type="number"
                            id="spouseCpp"
                            style={inputStyle}
                            value={spouseSettings.cppAmount}
                            onChange={(e) => handleSpouseChange('cppAmount', e.target.value)}
                        />
                    </div>
                    <div>
                        <label style={labelStyle} htmlFor="spouseOas">Spouse Annual OAS</label>
                        <input
                            type="number"
                            id="spouseOas"
                            style={inputStyle}
                            value={spouseSettings.oasAmount}
                            onChange={(e) => handleSpouseChange('oasAmount', e.target.value)}
                        />
                    </div>
                    <div>
                        <label style={labelStyle} htmlFor="spouseBaseIncome">Spouse Other Income</label>
                        <Tooltip text="Other taxable base income for spouse (e.g. Company Pension). Do not include RRSP/LIF here as they are simulated.">
                            <span style={{marginLeft: '4px', fontSize: '12px', color: '#9ca3af'}}>(?)</span>
                        </Tooltip>
                        <input
                            type="number"
                            id="spouseBaseIncome"
                            style={inputStyle}
                            value={spouseSettings.baseIncome}
                            onChange={(e) => handleSpouseChange('baseIncome', e.target.value)}
                        />
                    </div>
                </div>
            )}

            <h3 style={sectionHeaderStyle}>
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
                
                <div>
                    <label style={labelStyle} htmlFor="unlockingPercent">Unlocking % (to RRSP)</label>
                    <input
                        type="number"
                        id="unlockingPercent"
                        style={{...inputStyle, borderColor: showWarning ? '#f59e0b' : '#4b5563'}}
                        value={scenario.settings.lockedIn ? scenario.settings.lockedIn.unlockingPercent : 50}
                        onChange={(e) => handleSettingChange('lockedIn.unlockingPercent', e.target.value)}
                    />
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                        {currentRule.text}
                    </div>
                </div>

                <div>
                    <label style={{...labelStyle, display: 'flex', alignItems: 'center', gap: '8px'}} htmlFor="cansimRate">
                        <span>LIF CANSIM Rate (%)</span>
                        <Tooltip text="A government benchmark rate used to calculate the maximum you can withdraw from a LIF.">
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
