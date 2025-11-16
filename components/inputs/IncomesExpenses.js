// --- components/inputs/IncomesExpenses.js ---

const IncomesExpenses = ({ scenario, onUpdate }) => {
    
    const [activeFormState, setActiveFormState] = React.useState({
        type: null,
        item: null,
        isEditing: false
    });

    const handleShowForm = (type, itemToEdit = null) => {
        if (itemToEdit) {
            const itemWithFlag = type === 'incomes' ? { ...itemToEdit, isExpense: !!itemToEdit.isExpense } : itemToEdit;
            setActiveFormState({ type: type, item: itemWithFlag, isEditing: true });
        } else {
            let newItemTemplate;
            if (type === 'marketCrashes') {
                newItemTemplate = {
                    id: Date.now(),
                    startYear: scenario.settings.startYear,
                    duration: 1,
                    // [AI 2.0] 6개 자산군으로 수정
                    impact: { growth: 0, balanced: 0, dividend_can: 0, dividend_us: 0, bond: 0, gic: 0 }
                };
            } else if (type === 'oneTimeEvents') {
                newItemTemplate = {
                    id: Date.now(),
                    name: '',
                    amount: 0,
                    year: scenario.settings.startYear,
                    type: 'income',
                    taxationType: 'nonTaxable',
                    acb: 0
                };
            } else { // for 'incomes' (Recurring items)
                newItemTemplate = {
                    id: Date.now(),
                    type: 'Other',
                    customName: '',
                    amount: 0,
                    growthRate: 0,
                    startYear: scenario.settings.startYear,
                    endYear: scenario.settings.endYear,
                    isExpense: false
                };
            }
            setActiveFormState({ type: type, item: newItemTemplate, isEditing: false });
        }
    };

    const handleHideForm = () => {
        setActiveFormState({ type: null, item: null, isEditing: false });
    };

    const handleFormInputChange = (key, value) => {
        const numericFields = ['amount', 'growthRate', 'startYear', 'endYear', 'year', 'acb', 'duration'];
        const processedValue = numericFields.includes(key)
            ? (parseFloat(value) || 0)
            : value;
        setActiveFormState(prev => ({
            ...prev,
            item: { ...prev.item, [key]: processedValue }
        }));
    };

    const handleImpactChange = (assetKey, value) => {
        const numericValue = parseFloat(value) || 0;
        setActiveFormState(prev => ({
            ...prev,
            item: {
                ...prev.item,
                impact: {
                    ...prev.item.impact,
                    [assetKey]: numericValue
                }
            }
        }));
    };
    
    const handleDeleteItem = (listKey, itemId) => {
        const currentList = scenario[listKey] || [];
        const newList = currentList.filter(item => item.id !== itemId);
        onUpdate(listKey, newList, 'replace');
    };

    const handleSaveItem = () => {
        const { type, item } = activeFormState;
        if (!type || !item) return;

        let listKey;
        const { isExpense, ...newItem } = item;

        if (type === 'incomes') {
            listKey = isExpense ? 'expenses' : 'incomes';
        } else {
            listKey = type;
        }
        onUpdate(listKey, newItem, 'add_or_edit');
        handleHideForm();
    };

    // --- 스타일 정의 ---
    const sectionStyle = { backgroundColor: '#1f2937', padding: '20px', borderRadius: '8px', marginTop: '20px' };
    const h3Style = { fontSize: '18px', fontWeight: '600', marginBottom: '16px' };
    const buttonStyle = { padding: '8px 16px', fontSize: '14px', backgroundColor: '#374151', color: 'white', borderRadius: '6px', border: '1px solid #4b5563', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' };
    const listItemStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#374151', borderRadius: '6px' };
    const iconButtonStyle = { backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af' };
    const iconStyle = { height: '20px', width: '20px' };
    const formRowStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' };
    const formLabelStyle = { display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px', color: '#d1d5db' };
    const formInputStyle = { width: '100%', padding: '8px 12px', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '6px', color: 'white' };

    // ★★★ [수정] 모달 팝업을 위한 스타일 추가 ★★★
    const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' };
    const modalContentStyle = { backgroundColor: '#1f2937', padding: '24px', borderRadius: '8px', border: '1px solid #374151', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' };
    const modalActionsStyle = { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid #374151', paddingTop: '16px' };
    // ★★★ [수정 끝] ★★★

    return (
        <div style={{ marginTop: '20px' }}>
            {/* --- 섹션 1: 정기 수입/지출 --- */}
            <div style={sectionStyle}>
                <h3 style={h3Style}>Recurring Incomes / Expenses</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                    {scenario.incomes && scenario.incomes.length > 0 ? (
                        scenario.incomes.map(item => {
                            const startAge = item.startYear - scenario.settings.birthYear;
                            const endAge = item.endYear - scenario.settings.birthYear;
                            return (
                                <div key={item.id} style={listItemStyle}>
                                    <div style={{ flexGrow: 1 }}>
                                        <p style={{ fontWeight: '600', color: '#86efac' }}>{item.customName || item.type}</p>
                                        <p style={{ fontSize: '14px', color: '#86efac' }}>
                                            {formatCurrency(item.amount)}/yr from {item.startYear} (Age: {startAge}) to {item.endYear} (Age: {endAge})
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button style={iconButtonStyle} title="Edit" onClick={() => handleShowForm('incomes', item)}><svg style={iconStyle} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg></button>
                                        <button style={iconButtonStyle} title="Delete" onClick={() => handleDeleteItem('incomes', item.id)}><svg style={iconStyle} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No recurring items added.</p>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', borderTop: '1px dashed #4b5563', paddingTop: '16px', marginTop: '16px' }}>
                    {scenario.expenses && scenario.expenses.length > 0 ? (
                        scenario.expenses.map(item => {
                            const startAge = item.startYear - scenario.settings.birthYear;
                            const endAge = item.endYear - scenario.settings.birthYear;
                            return (
                                <div key={item.id} style={listItemStyle}>
                                    <div style={{ flexGrow: 1 }}>
                                        <p style={{ fontWeight: '600', color: '#fca5a5' }}>{item.customName || item.type || item.name}</p>
                                        <p style={{ fontSize: '14px', color: '#fca5a5' }}>
                                            -{formatCurrency(item.amount)}/yr from {item.startYear} (Age: {startAge}) to {item.endYear} (Age: {endAge})
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button style={iconButtonStyle} title="Edit" onClick={() => handleShowForm('incomes', { ...item, isExpense: true })}><svg style={iconStyle} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg></button>
                                        <button style={iconButtonStyle} title="Delete" onClick={() => handleDeleteItem('expenses', item.id)}><svg style={iconStyle} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No recurring expenses added.</p>
                    )}
                </div>
                <button style={buttonStyle} onClick={() => handleShowForm('incomes')}>
                    <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '20px', width: '20px' }} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    Add Recurring Item
                </button>
            </div>

            {/* --- 섹션 2: 일회성 이벤트 --- */}
            <div style={sectionStyle}>
                <h3 style={h3Style}>One-time Events</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                    {scenario.oneTimeEvents && scenario.oneTimeEvents.length > 0 ? (
                        scenario.oneTimeEvents.map(item => {
                            const age = item.year - scenario.settings.birthYear;
                            return (
                                <div key={item.id} style={listItemStyle}>
                                    <div style={{ flexGrow: 1 }}>
                                        <p style={{ fontWeight: '600', color: item.type === 'income' ? '#86efac' : '#fca5a5' }}>{item.name}</p>
                                        <p style={{ fontSize: '14px', color: item.type === 'income' ? '#86efac' : '#fca5a5' }}>
                                            {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)} in {item.year} (Age: {age})
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button style={iconButtonStyle} title="Edit" onClick={() => handleShowForm('oneTimeEvents', item)}><svg style={iconStyle} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg></button>
                                        <button style={iconButtonStyle} title="Delete" onClick={() => handleDeleteItem('oneTimeEvents', item.id)}><svg style={iconStyle} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button>
                                    </div>
                                </div>
                            );
                        })
                    ) : (<p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No one-time events added.</p>)}
                </div>
                <button style={buttonStyle} onClick={() => handleShowForm('oneTimeEvents')}>
                    <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '20px', width: '20px' }} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    Add One-time Event
                </button>
            </div>

            {/* --- 섹션 3: 시장 붕괴 --- */}
            <div style={sectionStyle}>
                <h3 style={h3Style}>Market Crashes</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                    {scenario.marketCrashes && scenario.marketCrashes.length > 0 ? (
                        scenario.marketCrashes.map(item => {
                            const startAge = item.startYear - scenario.settings.birthYear;
                            return (
                                <div key={item.id} style={listItemStyle}>
                                    <div style={{ flexGrow: 1 }}>
                                        <p style={{ fontWeight: '600', color: '#fca5a5' }}>Market Crash Event</p>
                                        <p style={{ fontSize: '14px', color: '#fca5a5' }}>
                                            Starts in {item.startYear} (Age: {startAge}) for {item.duration} year(s)
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button style={iconButtonStyle} title="Edit" onClick={() => handleShowForm('marketCrashes', item)}><svg style={iconStyle} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg></button>
                                        <button style={iconButtonStyle} title="Delete" onClick={() => handleDeleteItem('marketCrashes', item.id)}><svg style={iconStyle} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button>
                                    </div>
                                </div>
                            );
                        })
                    ) : (<p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No market crashes added.</p>)}
                </div>
                <button style={buttonStyle} onClick={() => handleShowForm('marketCrashes')}>
                    <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '20px', width: '20px' }} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    Add Market Crash
                </button>
            </div>
            
            {/* ★★★ [수정] 모든 폼을 담을 통합 모달 팝업 ★★★ */}
            {activeFormState.type && (
                <div style={modalOverlayStyle} onClick={handleHideForm}>
                    <div style={modalContentStyle} onClick={e => e.stopPropagation()}>

                        {/* --- 폼 1: 정기 수입/지출 --- */}
                        {activeFormState.type === 'incomes' && (
                            <div>
                                <h3 style={{...h3Style, marginTop: 0, color: 'white'}}>{activeFormState.isEditing ? 'Edit' : 'Add'} Recurring Item</h3>
                                <div style={formRowStyle}>
                                    <div>
                                        <label style={formLabelStyle}>Type</label>
                                        <select style={formInputStyle} value={activeFormState.item.isExpense ? 'expense' : 'income'} onChange={e => handleFormInputChange('isExpense', e.target.value === 'expense')}>
                                            <option value="income">Recurring Income</option>
                                            <option value="expense">Recurring Expense</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={formLabelStyle}>Category</label>
                                        <select style={formInputStyle} value={activeFormState.item.type || ''} onChange={e => handleFormInputChange('type', e.target.value)}>
                                            {activeFormState.item.isExpense ? (
                                                <><option value="Living Expense">Living Expense</option><option value="Other">Other</option></>
                                            ) : (
                                                <><option value="CPP">CPP</option><option value="OAS">OAS</option><option value="Other Pension">Other Pension</option><option value="Other">Other</option></>
                                            )}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={formLabelStyle}>Name</label>
                                    <input type="text" placeholder="e.g., Company Pension, Condo Fees" style={formInputStyle} value={activeFormState.item.customName || ''} onChange={e => handleFormInputChange('customName', e.target.value)} />
                                </div>
                                <div style={formRowStyle}>
                                    <div>
                                        <label style={formLabelStyle}>Amount ($/yr)</label>
                                        <input type="number" style={formInputStyle} value={activeFormState.item.amount || 0} onChange={e => handleFormInputChange('amount', e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={formLabelStyle}>Annual Growth (%)</label>
                                        <input type="number" style={formInputStyle} value={activeFormState.item.growthRate || 0} onChange={e => handleFormInputChange('growthRate', e.target.value)} />
                                    </div>
                                </div>
                                {/* ★★★ 수정된 부분 시작 ★★★ */}
                                <div style={formRowStyle}>
                                    <div>
                                        <label style={formLabelStyle}>Start Year</label>
                                        <select
                                            style={formInputStyle}
                                            value={activeFormState.item.startYear || scenario.settings.startYear}
                                            onChange={e => handleFormInputChange('startYear', e.target.value)}
                                        >
                                            {(() => {
                                                const yearOptions = [];
                                                for (let y = 2100; y >= 2025; y--) {
                                                    yearOptions.push(y);
                                                }
                                                return yearOptions.map(y => <option key={y} value={y}>{y}</option>);
                                            })()}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={formLabelStyle}>End Year</label>
                                        <select
                                            style={formInputStyle}
                                            value={activeFormState.item.endYear || scenario.settings.endYear}
                                            onChange={e => handleFormInputChange('endYear', e.target.value)}
                                        >
                                            {(() => {
                                                const yearOptions = [];
                                                for (let y = 2100; y >= 2025; y--) {
                                                    yearOptions.push(y);
                                                }
                                                return yearOptions.map(y => <option key={y} value={y}>{y}</option>);
                                            })()}
                                        </select>
                                    </div>
                                </div>
</div>
                        )}

                        {/* --- 폼 2: 일회성 이벤트 --- */}
                        {activeFormState.type === 'oneTimeEvents' && (
                             <div>
                                <h3 style={{...h3Style, marginTop: 0, color: 'white'}}>{activeFormState.isEditing ? 'Edit' : 'Add'} One-time Event</h3>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={formLabelStyle}>Event Name</label>
                                    <input type="text" placeholder="e.g., Inheritance, Car Purchase" style={formInputStyle} value={activeFormState.item.name || ''} onChange={e => handleFormInputChange('name', e.target.value)} />
                                </div>
                                {/* ★★★ 수정된 부분 시작 ★★★ */}
                                <div style={formRowStyle}>
                                    <div>
                                        <label style={formLabelStyle}>Year</label>
                                        <select
                                            style={formInputStyle}
                                            value={activeFormState.item.year || scenario.settings.startYear}
                                            onChange={e => handleFormInputChange('year', e.target.value)}
                                        >
                                            {(() => {
                                                const yearOptions = [];
                                                for (let y = 2100; y >= 2020; y--) {
                                                    yearOptions.push(y);
                                                }
                                                return yearOptions.map(y => <option key={y} value={y}>{y}</option>);
                                            })()}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={formLabelStyle}>Type</label>
                                        <select style={formInputStyle} value={activeFormState.item.type || 'income'} onChange={e => handleFormInputChange('type', e.target.value)}>
                                            <option value="income">Income</option>
                                            <option value="expense">Expense</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={formRowStyle}>
                                    <div>
                                        <label style={formLabelStyle}>Amount ($)</label>
                                        <input type="number" style={formInputStyle} value={activeFormState.item.amount || 0} onChange={e => handleFormInputChange('amount', e.target.value)} />
                                    </div>
                                    {activeFormState.item.type !== 'expense' && (
                                        <div>
                                            <label style={formLabelStyle}>Taxation</label>
                                            <select style={formInputStyle} value={activeFormState.item.taxationType || 'nonTaxable'} onChange={e => handleFormInputChange('taxationType', e.target.value)}>
                                                <option value="nonTaxable">Non-Taxable</option>
                                                <option value="regularIncome">Regular Income</option>
                                                <option value="capitalGain">Capital Gain</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                                {activeFormState.item.taxationType === 'capitalGain' && (
                                    <div style={{...formRowStyle, gridTemplateColumns: '1fr'}}>
                                        <div>
                                            <label style={formLabelStyle}>Adjusted Cost Base (ACB)</label>
                                            <input type="number" style={formInputStyle} value={activeFormState.item.acb || 0} onChange={e => handleFormInputChange('acb', e.target.value)} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* --- 폼 3: 시장 붕괴 --- */}
                        {activeFormState.type === 'marketCrashes' && (
                            <div>
                                <h3 style={{...h3Style, marginTop: 0, color: 'white'}}>{activeFormState.isEditing ? 'Edit' : 'Add'} Market Crash</h3>
                                {/* ★★★ 수정된 부분 시작 ★★★ */}
                                <div style={formRowStyle}>
                                    <div>
                                        <label style={formLabelStyle}>Start Year</label>
                                        <select
                                            style={formInputStyle}
                                            value={activeFormState.item.startYear}
                                            onChange={e => handleFormInputChange('startYear', e.target.value)}
                                        >
                                            {(() => {
                                                const yearOptions = [];
                                                for (let y = 2100; y >= 2020; y--) {
                                                    yearOptions.push(y);
                                                }
                                                return yearOptions.map(y => <option key={y} value={y}>{y}</option>);
                                            })()}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={formLabelStyle}>Duration (Years)</label>
                                        <select
                                            style={formInputStyle}
                                            value={activeFormState.item.duration}
                                            onChange={e => handleFormInputChange('duration', e.target.value)}
                                        >
                                            {(() => {
                                                const durationOptions = [];
                                                for (let d = 1; d <= 20; d++) {
                                                    durationOptions.push(d);
                                                }
                                                return durationOptions.map(d => <option key={d} value={d}>{d}</option>);
                                            })()}
                                        </select>
                                    </div>
                                </div>
                                {/* ★★★ 수정된 부분 끝 ★★★ */}
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={formLabelStyle}>Impact (%)</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '10px' }}>
                                        {/* [AI 2.0] 6개 자산군으로 수정 */}
                                        {['growth', 'balanced', 'dividend_can', 'dividend_us', 'bond', 'gic'].map(assetKey => (
                                            <div key={assetKey}>
                                                <label style={{...formLabelStyle, fontSize: '12px', color: '#9ca3af'}}>{assetKey.charAt(0).toUpperCase() + assetKey.slice(1)}</label>
                                                <input
                                                    type="number"
                                                    style={{...formInputStyle, padding: '6px 8px'}}
                                                    value={activeFormState.item.impact?.[assetKey] || 0}
                                                    onChange={e => handleImpactChange(assetKey, e.target.value)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- 공통 버튼 --- */}
                        <div style={modalActionsStyle}>
                            <button onClick={handleHideForm} style={{ ...buttonStyle, backgroundColor: '#4b5563' }}>Cancel</button>
                            <button onClick={handleSaveItem} style={{ ...buttonStyle, backgroundColor: '#2563eb' }}>Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};