// --- components/layout/ScenarioManager.js ---

const ScenarioManager = ({ scenarios, activeScenarioId, onSelectScenario, onRenameScenario, onCopyScenario, onDeleteScenario, onAddScenario, colors }) => {

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
        padding: '10px 0', // 상하 패딩만 유지
        borderBottom: '1px solid #374151',
        display: 'flex',
        alignItems: 'center',
        gap: '4px', // 탭 사이 간격
        marginBottom: '20px' // BasicSettings와의 간격
    };

    const tabStyle = {
        padding: '8px 16px',
        borderRadius: '6px 6px 0 0', // 상단 둥근 모서리 (탭 느낌)
        cursor: 'pointer',
        fontWeight: '500',
        fontSize: '14px',
        border: '1px solid transparent',
        borderBottom: 'none',
        transition: 'background-color 0.2s ease-in-out',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        minWidth: '120px',
        justifyContent: 'space-between'
    };

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

    // Add Scenario 버튼 스타일 (탭처럼 보이게)
    const addButtonStyle = {
        ...tabStyle,
        backgroundColor: 'transparent',
        color: '#a5f3fc',
        border: '1px dashed #4b5563', // 점선 테두리로 구별
        justifyContent: 'center',
        minWidth: '40px',
        width: '40px',
        padding: '8px'
    };

    return (
        <div style={containerStyle}>
            {/* --- 시나리오 탭 목록 --- */}
            {scenarios.map((scenario, index) => {
                const isEditing = editingState.id === scenario.id;
                const isActive = scenario.id === activeScenarioId;
                const scenarioColor = colors[index % colors.length];
                
                const activeTabStyle = {
                    ...tabStyle,
                    backgroundColor: '#1f2937', // 활성 탭 배경 (컨텐츠 배경과 동일)
                    color: scenarioColor,
                    borderTop: `2px solid ${scenarioColor}`, // 상단 컬러 라인
                    borderLeft: '1px solid #374151',
                    borderRight: '1px solid #374151',
                };
                
                const inactiveTabStyle = {
                    ...tabStyle,
                    backgroundColor: 'transparent',
                    color: '#9ca3af',
                    borderBottom: '1px solid #374151' // 비활성 탭은 하단 선이 있음
                };

                return (
                    <div key={scenario.id}>
                        {isEditing ? (
                            <input
                                type="text"
                                value={editingState.name}
                                onChange={handleNameChange}
                                onBlur={handleRenameConfirm}
                                onKeyDown={handleKeyDown}
                                style={{ ...activeTabStyle, outline: `2px solid ${scenarioColor}`, width: '150px' }}
                                autoFocus
                            />
                        ) : (
                            <div
                                style={isActive ? activeTabStyle : inactiveTabStyle}
                                onClick={() => onSelectScenario(scenario.id)}
                                onDoubleClick={() => handleDoubleClick(scenario)}
                                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = '#374151'; }}
                                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                <span>{scenario.name}</span>
                                {isActive && ( // 활성 탭일 때만 컨트롤 표시
                                    <div style={{display: 'flex', alignItems: 'center'}}>
                                        <button 
                                            title="Copy Scenario"
                                            style={iconButtonStyle}
                                            onClick={(e) => { e.stopPropagation(); onCopyScenario(scenario.id); }}
                                            disabled={scenarios.length >= 5} // 최대 5개 제한
                                        >
                                            <svg style={{width: '14px', height: '14px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V16.5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 017 16.5v-13z" /><path d="M5 6.5A1.5 1.5 0 016.5 5h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0115 9.622V14.5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 015 14.5v-8z" /></svg>
                                        </button>
                                        <button
                                            title="Delete Scenario"
                                            style={{...iconButtonStyle, marginLeft: '4px'}}
                                            onClick={(e) => { e.stopPropagation(); onDeleteScenario(scenario.id); }}
                                            disabled={scenarios.length <= 1}
                                        >
                                            <svg style={{width: '14px', height: '14px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* ★★★ [신설] 탭 목록 오른쪽에 'Add' 버튼 배치 ★★★ */}
            {scenarios.length < 5 && (
                <button 
                    onClick={onAddScenario}
                    style={addButtonStyle}
                    title="Add New Scenario"
                >
                    +
                </button>
            )}
        </div>
    );
};
