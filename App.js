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
    const [apiStatus, setApiStatus] = React.useState({ ai: null, baseline: null });
    
    const [simulationWorker, setSimulationWorker] = React.useState(null);
    
    React.useEffect(() => {
        const worker = new Worker('./engine/simulation.worker.js');
        worker.onmessage = (e) => {
            if (e.data.error) {
                setError(`Worker Error: ${e.data.error}`);
                setIsLoading(false);
            } else if (e.data.type === 'progress') {
                setProgress({ 
                    message: `Running Baseline Monte Carlo... (${e.data.completedRuns}/${e.data.totalRuns})`,
                    percentage: (e.data.completedRuns / e.data.totalRuns) * 100
                });
            } else {
                handleStandardSimResult(activeScenario.id, e.data);
                setApiStatus(prev => ({ ...prev, baseline: 'complete' }));
                setIsLoading(false);
            }
        };
        setSimulationWorker(worker);
        
        return () => {
            worker.terminate();
        };
    }, [activeScenario.id]); 
    
    // --- 시나리오 관리 핸들러 ---
    const handleAddScenario = () => {
        // ★★★ [수정] 최대 시나리오 개수 5개로 증가 ★★★
        if (scenarios.length >= 5) {
            alert("You can add up to 5 scenarios.");
            return;
        }
        const newScenario = window.createNewScenario(`Scenario ${scenarios.length + 1}`);
        setScenarios(prev => [...prev, newScenario]);
        setActiveScenarioId(newScenario.id);
    };

    const handleCopyScenario = (idToCopy) => {
        // ★★★ [수정] 최대 시나리오 개수 5개로 증가 ★★★
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

    // --- 설정 변경 핸들러 ---
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
    
    const EMPTY_RESULT = { finalBalance: 0, totalTax: 0, yearlyData: [], detailedLog: [] };

    const handleStandardSimResult = (scenarioId, result) => {
        setStandardResults(prev => ({
            ...prev,
            [scenarioId]: {
                finalBalance: result.finalBalance,
                totalTax: result.totalTax,
                yearlyData: result.yearlyData,
                detailedLog: result.detailedLog || []
            }
        }));
    };

    const runStandardSimulation = (scenario) => {
        if (!simulationWorker) {
            setError("Simulation worker is not ready.");
            return;
        }
        setIsLoading(true);
        setApiStatus(prev => ({ ...prev, baseline: 'running' }));
        setProgress({ message: 'Starting Baseline Monte Carlo...', percentage: 0 });
        
        try {
            simulationWorker.postMessage({
                scenario: scenario, 
                runs: 100 
            });
        } catch (err) {
            console.error("Standard sim error:", err);
            setError(`Standard Sim Error: ${err.message}`);
            handleStandardSimResult(scenario.id, EMPTY_RESULT);
            setIsLoading(false);
            setApiStatus(prev => ({ ...prev, baseline: 'error' }));
        }
    };
    
    const runAiSimulation = (scenario) => {
        setIsLoading(true);
        setError(null);
        setProgress({ message: 'Running AI Simulation...', percentage: 0 });
        setApiStatus({ baseline: null, ai: 'running' });

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
            setApiStatus({ baseline: 'complete', ai: 'complete' });
            setIsLoading(false);
        })
        .catch(err => {
            console.error("AI sim error:", err);
            setError(`AI Sim Error: ${err.message}`);
            setApiStatus({ baseline: 'error', ai: 'error' });
            setIsLoading(false);
        });
    };
    
    if (!activeScenario) {
        return <div>Loading scenarios...</div>;
    }

    return (
    <div style={{minHeight: '100vh', backgroundColor: '#111827', color: 'white'}}>
        <div style={{maxWidth: '1000px', margin: '0 auto', padding: '20px'}}>
            <h2 style={{fontSize: '24px', fontWeight: '600', marginBottom: '20px'}}>Retirement Planner</h2>
            
            {/* ★★★ [수정] ScenarioManager를 최상단으로 이동 및 handleAddScenario 전달 ★★★ */}
            <ScenarioManager 
                scenarios={scenarios}
                activeScenarioId={activeScenarioId}
                onSelectScenario={handleSelectScenario}
                onRenameScenario={handleRenameScenario}
                onCopyScenario={handleCopyScenario}
                onDeleteScenario={handleDeleteScenario}
                onAddScenario={handleAddScenario} // 전달
                colors={SCENARIO_COLORS}
            />
            
            <BasicSettings scenario={activeScenario} onUpdate={handleSettingsChange} />
            <AssetsStrategy scenario={activeScenario} onUpdate={handleSettingsChange} />
            <AssetProfiles scenario={activeScenario} onUpdate={handleSettingsChange} useSimpleMode={activeScenario.settings.portfolio.useSimpleMode} />
            <IncomesExpenses scenario={activeScenario} onUpdate={handleSettingsChange} />
        </div>
        
        <div style={{maxWidth: '1000px', margin: '0 auto', padding: '20px'}}>
            <div style={{backgroundColor: '#1f2937', padding: '20px', borderRadius: '8px', marginTop: '20px'}}>
            <div style={{display: 'flex', gap: '16px', alignItems: 'flex-end'}}>
                <button 
                    onClick={() => runAiSimulation(activeScenario)}
                    style={{
                        padding: '10px 20px',
                        fontSize: '16px',
                        fontWeight: '600',
                        backgroundColor: apiStatus.ai === 'running' ? '#555' : (apiStatus.ai === 'complete' ? '#16a34a' : '#2563eb'),
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: isLoading ? 'not-allowed' : 'pointer'
                    }}
                    disabled={isLoading}
                >
                    {apiStatus.ai === 'running' ? 'Running AI...' : (apiStatus.ai === 'complete' ? 'Run AI Simulation (Done)' : 'Run AI Simulation')}
                </button>
                
                <button 
                    onClick={() => runStandardSimulation(activeScenario)}
                    style={{
                        padding: '10px 20px',
                        fontSize: '16px',
                        fontWeight: '600',
                        backgroundColor: apiStatus.baseline === 'running' ? '#555' : (apiStatus.baseline === 'complete' ? '#16a34a' : '#4b5563'),
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: isLoading ? 'not-allowed' : 'pointer'
                    }}
                    disabled={isLoading}
                >
                    {apiStatus.baseline === 'running' ? 'Running Baseline...' : (apiStatus.baseline === 'complete' ? 'Run Baseline (Done)' : 'Run Baseline (JS)')}
                </button>

                {isLoading && (
                    <div style={{flex: 1, color: '#d1d5db'}}>
                        <div style={{fontSize: '14px', marginBottom: '4px'}}>{progress.message}</div>
                        <div style={{height: '6px', backgroundColor: '#374151', borderRadius: '3px', overflow: 'hidden'}}>
                            <div style={{width: `${progress.percentage}%`, height: '100%', backgroundColor: '#a5f3fc', transition: 'width 0.2s'}}></div>
                        </div>
                    </div>
                )}
                {error && <div style={{color: '#f87171', fontSize: '14px', flex: 1}}>{error}</div>}
            </div>
            
            {/* ★★★ [수정] 하단 버튼 그룹 정리 (Add Scenario 삭제, Export/Import 유지) ★★★ */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '20px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => alert('Export functionality to be added.')} style={{ padding: '6px 12px', fontSize: '14px', backgroundColor: '#4b5563', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Export</button>
                    <button onClick={() => alert('Import functionality to be added.')} style={{ padding: '6px 12px', fontSize: '14px', backgroundColor: '#4b5563', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Import</button>
                    <div style={{position: 'relative'}}>
                        <select 
                            onChange={(e) => alert(e.target.value)} 
                            style={{
                                padding: '6px 12px', fontSize: '14px', backgroundColor: '#4b5563', 
                                color: 'white', border: 'none', borderRadius: '6px', 
                                cursor: 'pointer', appearance: 'none', paddingRight: '30px'
                            }}
                        >
                            <option value="">Load Template</option>
                            <option value="template1">Aggressive Growth</option>
                            <option value="template2">Conservative (Capital Preservation)</option>
                        </select>
                    </div>
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
                />
            </div>
        </div>
    </div>
  );
};
