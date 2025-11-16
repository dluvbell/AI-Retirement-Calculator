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
            if (type === 'oneTimeEvents') {
                newItemTemplate = {
                    id: Date.now(),
                    name: '',
                    amount: 0,
                    year: scenario.settings.startYear,
                    type: 'income',
                    taxationType: 'nonTaxable',
                    acb: 0
                };
            } else {
                // 'incomes' 또는 'expenses'
                newItemTemplate = {
                    id: Date.now(),
                    name: '',
                    amount: 0,
                    startYear: scenario.settings.startYear,
                    endYear: scenario.settings.endYear,
                    growthRate: scenario.settings.generalInflation,
                    isExpense: type === 'expenses'
                };
            }
            setActiveFormState({ type: type, item: newItemTemplate, isEditing: false });
        }
    };

    const handleHideForm = () => {
        setActiveFormState({ type: null, item: null, isEditing: false });
    };

    const handleFormChange = (key, value) => {
        const numericKeys = ['amount', 'startYear', 'endYear', 'growthRate', 'year', 'acb', 'duration'];
        const isNumeric = numericKeys.includes(key);
        const parsedValue = isNumeric ? parseFloat(value) || 0 : value;

        setActiveFormState(prev => ({
            ...prev,
            item: {
                ...prev.item,
                [key]: parsedValue
            }
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

    const handleSaveItem = () => {
        const { type, item, isEditing } = activeFormState;
        
        let listKey = type;
        if (type === 'incomes') {
            listKey = item.isExpense ? 'expenses' : 'incomes';
        }

        const currentList = scenario.settings[listKey] || [];
        let newList;

        if (isEditing) {
            newList = currentList.map(i => i.id === item.id ? item : i);
        } else {
            newList = [...currentList, item];
        }

        onUpdate(listKey, newList);
        handleHideForm();
    };

    const handleDeleteItem = (listKey, id) => {
        if (!confirm('Are you sure you want to delete this item?')) {
            return;
        }

        const currentList = scenario.settings[listKey];
        const newList = currentList.filter(i => i.id !== id);
        onUpdate(listKey, newList);
    };

    // --- 렌더링 함수 ---

    const renderListSection = (title, listKey, itemNames, showFormType) => (
        <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>{title}</h4>
                <button
                    onClick={() => handleShowForm(showFormType)}
                    style={{ ...buttonStyle, backgroundColor: 'transparent', color: '#a5f3fc', border: '1px solid #a5f3fc', padding: '4px 10px', fontSize: '14px' }}
                >
                    + Add
                </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(scenario.settings[listKey] && scenario.settings[listKey].length > 0) ? (
                    scenario.settings[listKey].map(item => (
                        <div key={item.id} style={listItemStyle}>
                            <span style={{ flex: 1 }}>{item[itemNames.name]}</span>
                            <span style={{ flex: 1, textAlign: 'right', color: '#e5e7eb' }}>{formatCurrency(item[itemNames.amount], 0)}</span>
                            <span style={{ flex: 1, textAlign: 'right' }}>{item[itemNames.start]} - {item[itemNames.end]}</span>
                            <div style={{ flexShrink: 0, marginLeft: '12px' }}>
                                <button onClick={() => handleShowForm(showFormType, item)} style={iconButtonStyle}>Edit</button>
                                <button onClick={() => handleDeleteItem(listKey, item.id)} style={{...iconButtonStyle, color: '#f87171'}}>Delete</button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>No items added.</p>
                )}
            </div>
        </div>
    );

    // --- 컴포넌트 렌더링 ---
    const { type, item } = activeFormState;
    const assetKeys = ['growth', 'balanced', 'dividend_can', 'dividend_us', 'bond', 'gic'];

    // [추가] 실수로 삭제된 스타일 정의 복원
    const buttonStyle = {
        padding: '8px 16px', borderRadius: '6px',
        border: 'none', cursor: 'pointer',
        fontWeight: '500', transition: 'background-color 0.2s',
        fontSize: '14px'
    };
    const listItemStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px',
        backgroundColor: '#374151',
        borderRadius: '6px',
        fontSize: '14px',
        color: '#d1d5db'
    };
    const iconButtonStyle = {
        background: 'none',
        border: 'none',
        color: '#a5f3fc',
        cursor: 'pointer',
        fontSize: '14px',
        marginLeft: '8px'
    };
    const modalOverlayStyle = {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    };
    const modalContentStyle = {
        backgroundColor: '#1f2937', color: 'white',
        borderRadius: '8px', padding: '24px',
        width: '90%', maxWidth: '600px',
        border: '1px solid #374151'
    };
    const modalHeaderStyle = {
        fontSize: '18px',
        fontWeight: '600',
        marginBottom: '20px'
    };
    const modalActionsStyle = {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
        marginTop: '24px'
    };
    const formGridStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px'
    };
    const formLabelStyle = {
        display: 'block',
        fontSize: '14px',
        fontWeight: '500',
        marginBottom: '4px'
    };
    const formInputStyle = {
        width: '100%',
        padding: '8px 12px',
        backgroundColor: '#374151',
        border: '1px solid #4b5563',
        borderRadius: '6px',
        color: 'white'
    };

    return (
        <div style={{ backgroundColor: '#1f2937', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
            
            {renderListSection(
                'Recurring Incomes / Expenses',
                'incomes',
                { name: 'name', amount: 'amount', start: 'startYear', end: 'endYear' },
                'incomes' // 'Add' 버튼을 누를 때 사용할 폼 타입
            )}
            
            {renderListSection(
                'One-Time Events',
                'oneTimeEvents',
                { name: 'name', amount: 'amount', start: 'year', end: 'type' },
                'oneTimeEvents'
            )}

            {/* --- 모달 폼 --- */}
            {activeFormState.type && (
                <div style={modalOverlayStyle} onClick={handleHideForm}>
                    <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                        <h3 style={modalHeaderStyle}>
                            {activeFormState.isEditing ? 'Edit Item' : 'Add New Item'}
                        </h3>
                        
                        {/* --- Recurring Incomes/Expenses 폼 --- */}
                        {type === 'incomes' && (
                            <div style={formGridStyle}>
                                <div>
                                    <label style={formLabelStyle}>Name</label>
                                    <input type="text" style={formInputStyle} value={item.name} onChange={e => handleFormChange('name', e.target.value)} />
                                </div>
                                <div>
                                    <label style={formLabelStyle}>Amount (Annual)</label>
                                    <input type="number" style={formInputStyle} value={item.amount} onChange={e => handleFormChange('amount', e.target.value)} />
                                </div>
                                <div>
                                    <label style={formLabelStyle}>Start Year</label>
                                    <input type="number" style={formInputStyle} value={item.startYear} onChange={e => handleFormChange('startYear', e.target.value)} />
                                </div>
                                <div>
                                    <label style={formLabelStyle}>End Year</label>
                                    <input type="number" style={formInputStyle} value={item.endYear} onChange={e => handleFormChange('endYear', e.target.value)} />
                                </div>
                                <div>
                                    <label style={formLabelStyle}>Growth Rate (%)</label>
                                    <input type="number" style={formInputStyle} value={item.growthRate} onChange={e => handleFormChange('growthRate', e.target.value)} />
                                </div>
                                <div>
                                    <label style={formLabelStyle}>Type</label>
                                    <select style={formInputStyle} value={item.isExpense ? 'expense' : 'income'} onChange={e => handleFormChange('isExpense', e.target.value === 'expense')}>
                                        <option value="income">Income</option>
                                        <option value="expense">Expense</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* --- One-Time Events 폼 --- */}
                        {type === 'oneTimeEvents' && (
                            <div style={formGridStyle}>
                                <div>
                                    <label style={formLabelStyle}>Event Name</label>
                                    <input type="text" style={formInputStyle} value={item.name} onChange={e => handleFormChange('name', e.target.value)} />
                                </div>
                                <div>
                                    <label style={formLabelStyle}>Amount</label>
                                    <input type="number" style={formInputStyle} value={item.amount} onChange={e => handleFormChange('amount', e.target.value)} />
                                </div>
                                <div>
                                    <label style={formLabelStyle}>Year</label>
                                    <input type="number" style={formInputStyle} value={item.year} onChange={e => handleFormChange('year', e.target.value)} />
                                </div>
                                <div>
                                    <label style={formLabelStyle}>Type</label>
                                    <select style={formInputStyle} value={item.type} onChange={e => handleFormChange('type', e.target.value)}>
                                        <option value="income">Income</option>
                                        <option value="expense">Expense</option>
                                    </select>
                                </div>
                                {item.type === 'income' && (
                                    <>
                                        <div>
                                            <label style={formLabelStyle}>Taxation</label>
                                            <select style={formInputStyle} value={item.taxationType} onChange={e => handleFormChange('taxationType', e.target.value)}>
                                                <option value="nonTaxable">Non-Taxable</option>
                                                <option value="capitalGains">Capital Gains</option>
                                                <option value="fullyTaxed">Fully Taxed</option>
                                            </select>
                                        </div>
                                        {item.taxationType === 'capitalGains' && (
                                            <div>
                                                <label style={formLabelStyle}>Adjusted Cost Base (ACB)</label>
                                                <input type="number" style={formInputStyle} value={item.acb} onChange={e => handleFormChange('acb', e.target.value)} />
                                            </div>
                                        )}
                                    </>
                                )}
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
