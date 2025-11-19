// --- App.js ---

const deepCopy = (obj, visited = new WeakMap()) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (visited.has(obj)) return visited.get(obj);
    if (obj instanceof Date) return new Date(obj.getTime());
    if (Array.isArray(obj)) {
        const arrCopy = [];
        visited.set(obj, arrCopy);
        for (let i = 0; i < obj.length; i++) arrCopy[i] = deepCopy(obj[i], visited);
        return arrCopy;
    }
    const objCopy = {};
    visited.set(obj, objCopy);
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) objCopy[key] = deepCopy(obj[key], visited);
    }
    return objCopy;
};

const SCENARIO_COLORS = ['#38bdf8', '#fbbf24', '#a78bfa', '#4ade80', '#f87171'];

const App = () => {
    const [scenarios, setScenarios] = React.useState([window.createNewScenario("My Default Scenario")]);
    const [activeScenarioId, setActiveScenarioId] = React.useState(scenarios[0].id);
    const activeScenario = scenarios.find(s => s.id === activeScenarioId);
    
    const [standardResults, setStandardResults] = React.useState({});
    const [aiResults, setAiResults] = React.useState({});
    const [isLoading, setIsLoading] = React.useState(false);
    const [progress, setProgress] = React.useState({ message: '', percentage: 0 });
    const [error, setError] = React.useState(null);
    const [apiStatus, setApiStatus] = React.useState({ ai: null });
    
    // ★★★ [신설] 개발자 디테일 로그 토글 상태 ★★★
    const [showDevLog, setShowDevLog] = React.useState(false);
    
    const [simulationWorker, setSimulationWorker] = React.useState(null);
    
    // (Worker useEffect removed as requested in previous step, keeping clean)

    // --- 시나리오 관리 ---
    const handleAddScenario = () => {
        if (scenarios.length >= 5) {
            alert("You can add up to 5 scenarios.");
            return;
        }
        const newScenario = window.createNewScenario(`Scenario ${scenarios.length + 1}`);
        setScenarios(prev => [...prev, newScenario]);
        setActiveScenarioId(newScenario.id);
    };

    const handleCopyScenario = (idToCopy) => {
        if (scenarios.length >= 5) {
            alert("You can add up to 5 scenarios.");
            return;
        }
        const scenarioToCopy = scenarios.find(s => s.id === idToCopy);
        const newScenario = {
            ...deepCopy(scenarioToCopy),
            id: Date.now(),
            name: `${scenarioToCopy.name} (Copy)`
        };
        setScenarios(prev => [...prev, newScenario]);
        setActiveScenarioId(newScenario.id);
    };

    const handleDeleteScenario = (idToDelete) => {
        if (scenarios.length <= 1) {
            alert("You must have at least one scenario.");
            return;
        }
        const newScenarios = scenarios.filter(s => s.id !== idToDelete);
        setScenarios(newScenarios);
        if (activeScenarioId === idToDelete) {
            setActiveScenarioId(newScenarios[0].id);
        }
    };

    const handleRenameScenario = (idToRename, newName) => {
        setScenarios(prev => prev.map(s => s.id === idToRename ? { ...s, name: newName } : s));
    };

    const handleSelectScenario = (id) => {
        setActiveScenarioId(id);
    };

    const handleSettingsChange = (key, value) => {
        setScenarios(prev => prev.map(s => {
            if (s.id === activeScenarioId) {
                const keys = key.split('.');
                if (keys.length > 1) {
                    const newSettings = { ...s.settings };
                    let currentLevel = newSettings;
                    for (let i = 0; i < keys.length - 1; i++) {
                        currentLevel = currentLevel[keys[i]];
                    }
                    currentLevel[keys[keys.length - 1]] = value;
                    return { ...s, settings: newSettings };
                } else {
                    return { ...s, settings: { ...s.settings, [key]: value } };
                }
            }
            return s;
        }));
    };

    // --- [신설] Import/Export 핸들러 ---
    const handleExportJSON = () => {
        exportToJSON(activeScenario, `scenario_${activeScenario.name.replace(/\s+/g, '_')}.json`);
    };

    const handleImportJSON = () => {
        // 파일 입력 엘리먼트 동적 생성
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            importFromJSON(file).then(data => {
                if (data && data.settings) {
                    const newScenario = { ...data, id: Date.now(), name: data.name + " (Imported)" };
                    setScenarios(prev => [...prev, newScenario]);
                    setActiveScenarioId(newScenario.id);
                } else {
                    alert("Invalid scenario file format.");
                }
            }).catch(err => alert(err));
        };
        input.click();
    };

    const handleExportCSV = () => {
        const resultLog = aiResults[activeScenario.id]?.detailedLog;
        generateVerificationCSV(activeScenario, resultLog, `verification_${activeScenario.name.replace(/\s+/g, '_')}.csv`);
    };

    // --- 시뮬레이션 실행 ---
    const runAiSimulation = (scenario) => {
        setIsLoading(true);
        setError(null);
        setProgress({ message: 'Running AI Simulation...', percentage: 0 });
        setApiStatus({ ai: 'running' });

        const payload = createApiPayload(scenario);
        
        fetch('http://127.0.0.1:5001/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => {
            if (!res.ok) throw new Error(`Server responded with ${res.status}`);
            return res.json();
        })
        .then(data => {
            setAiResults(prev => ({
                ...prev,
                [scenario.id]: {
                    finalBalance: data.ai_optimized.net_worth,
                    totalTax: data.ai_optimized.tax_paid,
                    yearlyData: data.chart_data.ai_nw.map((nw, i) => ({ year: parseInt(data.chart_data.labels[i]), age: parseInt(data.chart_data.labels[i]), endTotalBalance: nw })),
                    detailedLog: data.detailed_log.ai_log || []
                }
            }));
            setStandardResults(prev => ({
                ...prev,
                [scenario.id]: {
                    finalBalance: data.baseline.net_worth,
                    totalTax: data.baseline.tax_paid,
                    yearlyData: data.chart_data.baseline_nw.map((nw, i) => ({ year: parseInt(data.chart_data.labels[i]), age: parseInt(data.chart_data.labels[i]), endTotalBalance: nw })),
                    detailedLog: data.detailed_log.baseline_log || []
                }
            }));
            setApiStatus({ ai: 'complete' });
            setIsLoading(false);
        })
        .catch(err => {
            console.error("AI sim error:", err);
            setError(`AI Sim Error: ${err.message}`);
            setApiStatus({ ai: 'error' });
            setIsLoading(false);
        });
    };
    
    if (!activeScenario) {
        return <div>Loading scenarios...</div>;
    }

    return (
    <div style={{minHeight: '100vh', backgroundColor: '#111827', color: 'white'}}>
        <div style={{maxWidth: '1000px', margin: '0 auto', padding: '20px'}}>
            {/* Header & Developer Toggle */}
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                <h2 style={{fontSize: '24px', fontWeight: '600', margin: 0}}>Retirement Planner</h2>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span style={{fontSize: '14px', color: '#9ca3af'}}>Show Developer's Detailed Log</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={showDevLog} onChange={e => setShowDevLog(e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
            </div>
            
            <ScenarioManager 
                scenarios={scenarios}
                activeScenarioId={activeScenarioId}
                onSelectScenario={handleSelectScenario}
                onRenameScenario={handleRenameScenario}
                onCopyScenario={handleCopyScenario}
                onDeleteScenario={handleDeleteScenario}
                onAddScenario={handleAddScenario} 
                colors={SCENARIO_COLORS}
            />
            
            <BasicSettings scenario={activeScenario} onUpdate={handleSettingsChange} />
            <AssetsStrategy scenario={activeScenario} onUpdate={handleSettingsChange} />
            <AssetProfiles scenario={activeScenario} onUpdate={handleSettingsChange} useSimpleMode={activeScenario.settings.portfolio.useSimpleMode} />
            <IncomesExpenses scenario={activeScenario} onUpdate={handleSettingsChange} />
        </div>
        
        <div style={{maxWidth: '1000px', margin: '0 auto', padding: '20px'}}>
            <div style={{backgroundColor: '#1f2937', padding: '20px', borderRadius: '8px', marginTop: '20px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    
                    {/* Left: Run Simulation Button */}
                    <div style={{display: 'flex', gap: '16px', alignItems: 'center', flex: 1}}>
                        <button 
                            onClick={() => runAiSimulation(activeScenario)}
                            style={{
                                padding: '10px 20px', fontSize: '16px', fontWeight: '600',
                                backgroundColor: apiStatus.ai === 'running' ? '#555' : (apiStatus.ai === 'complete' ? '#16a34a' : '#2563eb'),
                                color: 'white', border: 'none', borderRadius: '6px', cursor: isLoading ? 'not-allowed' : 'pointer',
                                whiteSpace: 'nowrap'
                            }}
                            disabled={isLoading}
                        >
                            {apiStatus.ai === 'running' ? 'Running AI...' : (apiStatus.ai === 'complete' ? 'Run Simulation' : 'Run Simulation')}
                        </button>

                        {/* Loading Bar */}
                        {isLoading ? (
                            <div style={{flex: 1, maxWidth: '300px', marginLeft: '10px', color: '#d1d5db'}}>
                                <div style={{fontSize: '12px', marginBottom: '2px'}}>{progress.message}</div>
                                <div style={{height: '6px', backgroundColor: '#374151', borderRadius: '3px', overflow: 'hidden'}}>
                                    <div style={{width: `${progress.percentage}%`, height: '100%', backgroundColor: '#a5f3fc', transition: 'width 0.2s'}}></div>
                                </div>
                            </div>
                        ) : (
                             error && <div style={{color: '#f87171', fontSize: '14px', marginLeft: '10px'}}>{error}</div>
                        )}
                    </div>

                    {/* Right: Export/Import Buttons */}
                    <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                        {/* [수정] 버튼 기능 연결 */}
                        <button onClick={handleExportJSON} style={{ padding: '6px 12px', fontSize: '14px', backgroundColor: '#4b5563', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Export JSON</button>
                        <button onClick={handleImportJSON} style={{ padding: '6px 12px', fontSize: '14px', backgroundColor: '#4b5563', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Import JSON</button>
                        
                        {/* [수정] CSV Export 버튼으로 변경 */}
                        <button onClick={handleExportCSV} style={{ padding: '6px 12px', fontSize: '14px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg style={{width:'14px', height:'14px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            Export to CSV
                        </button>
                    </div>
                </div>
            </div>

            <div className="w-full mt-5">
                <ResultsSection 
                    allScenarioResults={standardResults}
                    aiResults={aiResults}
                    scenarios={scenarios}
                    activeScenario={activeScenario}
                    colors={SCENARIO_COLORS}
                    showDevLog={showDevLog}
                />
            </div>
        </div>
    </div>
  );
};
