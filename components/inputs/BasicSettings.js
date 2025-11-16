// --- components/inputs/BasicSettings.js ---

const BasicSettings = ({ scenario, onUpdate }) => {
    const { province, birthYear, startYear, endYear } = scenario.settings;
    const lifeExpectancy = endYear - birthYear;

    const handleSettingChange = (key, value) => {
        // 값이 숫자인 경우, 숫자로 변환해줍니다.
        const numericValue = !isNaN(parseFloat(value)) ? parseFloat(value) : value;
        onUpdate(key, numericValue);
    };

    // --- 드롭다운 메뉴 옵션 생성 ---
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
                {/* --- 거주 주 선택 --- */}
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

                {/* --- 출생 연도 선택 --- */}
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
                
                {/* ★★★ 수정된 부분 시작 ★★★ */}
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
                {/* ★★★ 수정된 부분 끝 ★★★ */}

                {/* --- 기대 수명 선택 --- */}
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
        </div>
    );
};