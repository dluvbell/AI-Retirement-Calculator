// --- components/layout/ScenarioManager.js ---

const ScenarioManager = ({ scenarios, activeScenarioId, onSelectScenario, onRenameScenario, onCopyScenario, onDeleteScenario, colors }) => {

    const [editingState, setEditingState] = React.useState({ id: null, name: '' });

    const handleDoubleClick = (scenario) => {
        setEditingState({ id: scenario.id, name: scenario.name });
    };

    const handleNameChange = (event) => {
        setEditingState(prev => ({ ...prev, name: event.target.value }));
    };

    const handleRenameConfirm = () => {
        if (editingState.id && editingState.name) {
            onRenameScenario(editingState.id, editingState.name);
        }
        setEditingState({ id: null, name: '' });
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter') {
            handleRenameConfirm();
        } else if (event.key === 'Escape') {
            setEditingState({ id: null, name: '' });
        }
    };

    // --- 스타일 정의 ---
    const containerStyle = {
        padding: '10px 20px',
        backgroundColor: '#1f2937',
        borderBottom: '1px solid #374151',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
    };

    const tabStyle = {
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '14px',
    border: '1px solid transparent',
    transition: 'background-color 0.2s ease-in-out' // 이 라인을 추가하세요
};

    const inactiveTabStyle = {
    ...tabStyle,
    backgroundColor: 'transparent',
    color: '#9ca3af',
    // Add a hover effect directly in the style for inactive tabs
    // Note: For complex hover effects, CSS classes are better, but this works for simple changes.
    // This is a conceptual example; direct hover styles in JS are tricky.
    // A better way is to handle mouseEnter/mouseLeave events if not using CSS classes.
};

// To properly handle hover, we'll adjust how styles are applied in the map function.
// So, the above inactiveTabStyle remains, and we'll apply hover logic below.
    
    const iconButtonStyle = {
        background: 'none',
        border: 'none',
        padding: '2px',
        margin: 0,
        cursor: 'pointer',
        color: '#9ca3af',
        display: 'inline-flex',
        alignItems: 'center'
    };

    return (
        <div style={containerStyle}>
            {/* --- 시나리오 탭 목록 --- */}
            <div style={{ display: 'flex', flexGrow: 1 }}>
                {scenarios.map((scenario, index) => {
                    const isEditing = editingState.id === scenario.id;

const scenarioColor = colors[index % colors.length];
                    const activeTabStyle = {
                        ...tabStyle,
                        backgroundColor: '#111827',
                        color: scenarioColor,
                        border: `1px solid ${scenarioColor}` // 테두리 색상 변경
                    };
                    
                    return (
    <div key={scenario.id} style={{ marginRight: '4px' }}>
        {isEditing ? (
                                // --- 수정 모드일 때 입력 필드 ---
                                <input
                                    type="text"
                                    value={editingState.name}
                                    onChange={handleNameChange}
                                    onBlur={handleRenameConfirm}
                                    onKeyDown={handleKeyDown}
                                    style={{ ...activeTabStyle, outline: `2px solid ${scenarioColor}` }} // 수정 모드 아웃라인 색상도 변경
                                    autoFocus
                                />
                            ) : (
                                // --- 일반 모드일 때 탭 ---
                                <div
                                    style={{
        ...(scenario.id === activeScenarioId ? activeTabStyle : inactiveTabStyle),
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
    }}
                                    onClick={() => onSelectScenario(scenario.id)}
                                    onDoubleClick={() => handleDoubleClick(scenario)}
				    onMouseEnter={(e) => { if (scenario.id !== activeScenarioId) e.currentTarget.style.backgroundColor = '#4b5563'; }} // 색상을 더 밝게 변경
   			            onMouseLeave={(e) => { if (scenario.id !== activeScenarioId) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                    <span>{scenario.name}</span>
                                    <div style={{display: 'flex', alignItems: 'center'}}>
                                        <button 
                                            title="Copy Scenario"
                                            style={iconButtonStyle}
                                            onClick={(e) => { e.stopPropagation(); onCopyScenario(scenario.id); }}
                                            disabled={scenarios.length >= 3}
                                        >
                                            <svg style={{width: '16px', height: '16px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V16.5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 017 16.5v-13z" /><path d="M5 6.5A1.5 1.5 0 016.5 5h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0115 9.622V14.5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 015 14.5v-8z" /></svg>
                                        </button>
                                        <button
                                            title="Delete Scenario"
                                            style={iconButtonStyle}
                                            onClick={(e) => { e.stopPropagation(); onDeleteScenario(scenario.id); }}
                                            disabled={scenarios.length <= 1}
                                        >
                                            <svg style={{width: '16px', height: '16px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};