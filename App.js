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
    const [scenarios, setScenarios] = React.useState([createNewScenario("My Default Scenario")]);
    const [activeScenarioId, setActiveScenarioId] = React.useState(scenarios[0].id);
    const activeScenario = scenarios.find(s => s.id === activeScenarioId);
    
    const [standardResults, setStandardResults] = React.useState({});
    const [aiResults, setAiResults] = React.useState({});
    const [isCalculatingStd, setIsCalculatingStd] = React.useState(false);

    const [isCalculatingMC, setIsCalculatingMC] = React.useState(false);

    const fileInputRef = React.useRef(null);
    const [importError, setImportError] = React.useState(null);    
    const [mcProgress, setMcProgress] = React.useState(0);
    const [devMode, setDevMode] = React.useState(false);

    const [openSections, setOpenSections] = React.useState({
        basic: true,
        assets: true,
        incomes: false,
	    expert: false,
    });

    const toggleSection = (section) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const runStandardSimulation = () => {
        const validationResult = validateScenario(activeScenario);
        if (!validationResult.isValid) {
            alert(`시나리오 "${activeScenario.name}"의 입력 값에 오류가 있습니다:\n\n` + validationResult.errors.join('\n'));
            return;
        }

        setIsCalculatingStd(true);
        setStandardResults(prev => ({ ...prev, [activeScenarioId]: null }));
        setAiResults(prev => ({...prev, [activeScenarioId]: null}));

        (async () => {
            try {
                const payload = createApiPayload(activeScenario);
                
                const response = await fetch('http://127.0.0.1:5001/simulate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`서버 응답 오류: ${errorData.error || response.statusText}`);
                }

                const result = await response.json();
                
                setStandardResults(prev => ({
                    ...prev,
                    [activeScenarioId]: {
                        yearlyData: result.chart_data.baseline_nw.map((nw, i) => ({
                            year: (activeScenario.settings.startYear) + i,
                            age: (activeScenario.settings.startYear - activeScenario.settings.birthYear) + i,
                            endTotalBalance: nw,
                        })),
                        finalBalance: result.baseline.net_worth,
                        totalTax: result.baseline.tax_paid,
                        detailedLog: result.detailed_log.baseline_log
                    }
                }));

                setAiResults(prev => ({
                    ...prev,
                    [activeScenarioId]: {
                        yearlyData: result.chart_data.ai_nw.map((nw, i) => ({
                            year: (activeScenario.settings.startYear) + i,
                            age: (activeScenario.settings.startYear - activeScenario.settings.birthYear) + i,
                            endTotalBalance: nw
                        })),
                        finalBalance: result.ai_optimized.net_worth,
                        totalTax: result.ai_optimized.tax_paid,
                        detailedLog: result.detailed_log.ai_log
                    }
                }));

            } catch (error) {
                console.error(`시나리오 "${activeScenario.name}" 처리 중 오류:`, error);
                alert(`시나리오 "${activeScenario.name}"을 계산하는 중 오류가 발생했습니다: ${error.message}`);
            }
            setIsCalculatingStd(false);
        })();
    };

    const handleSettingsChange = (key, value, action = 'replace') => {
        setScenarios(prevScenarios => {
            const newScenarios = prevScenarios.map(scenario => {
                if (scenario.id === activeScenarioId) {
                    const newScenario = deepCopy(scenario);
                    
                    if (key === 'settings' && action === 'replace') {
                        newScenario.settings = value;
                        return newScenario;
                    }

                    const keys = key.split('.');
                    if (keys.length > 1) {
                        let temp = newScenario.settings;
                        for (let i = 0; i < keys.length - 1; i++) {
                            temp = temp[keys[i]];
                        }
                        temp[keys[keys.length - 1]] = value;
                    } else if (newScenario.settings.hasOwnProperty(key)) {
                        newScenario.settings[key] = value;
                    } else if (Array.isArray(newScenario[key])) {
                        if (action === 'add_or_edit') {
                            const existingItemIndex = newScenario[key].findIndex(i => i.id === value.id);
                            if (existingItemIndex > -1) {
                                newScenario[key][existingItemIndex] = value;
                            } else {
                                newScenario[key].push(value);
                            }
                        } else {
                           newScenario[key] = value;
                        }
                    } else {
                        newScenario.settings[key] = value;
                    }

                    // [수정] birthYear 또는 lifeExpectancy 변경 시 endYear를 올바르게 재계산합니다.
                    // (참고: 'scenario'는 변경 전 상태, 'newScenario'는 변경 중인 상태입니다)
                    if (key === 'birthYear') {
                        const newBirthYear = parseInt(value, 10);
                        // 기존 기대수명을 (변경 전 endYear - 변경 전 birthYear)로 계산합니다.
                        const lifeExpectancy = scenario.settings.endYear - scenario.settings.birthYear;
                        if (!isNaN(lifeExpectancy) && !isNaN(newBirthYear)) {
                            newScenario.settings.endYear = newBirthYear + lifeExpectancy;
                        }
                    } else if (key === 'lifeExpectancy') {
                        // 'lifeExpectancy'는 settings에 저장되지 않지만, BasicSettings.js가 이 key로 호출합니다.
                        const birthYear = newScenario.settings.birthYear;
                        const newLifeExpectancy = parseInt(value, 10);
                        if (!isNaN(birthYear) && !isNaN(newLifeExpectancy)) {
                            newScenario.settings.endYear = birthYear + newLifeExpectancy;
                        }
                    }
                    return newScenario;
                }
                return scenario;
            });
            return newScenarios;
        });
    };

    const handleSelectScenario = (id) => {
        setActiveScenarioId(id);
    };

    const handleAddScenario = () => {
        setScenarios(prevScenarios => {
            if (prevScenarios.length >= 5) {
                alert("You can create a maximum of 5 scenarios.");
                return prevScenarios;
            }
            const newScenario = createNewScenario(`Scenario ${prevScenarios.length + 1}`);
            setActiveScenarioId(newScenario.id); 
            return [...prevScenarios, newScenario];
        });
    };
    
    const handleRenameScenario = (id, newName) => {
        setScenarios(prevScenarios => prevScenarios.map(s => (s.id === id ? { ...s, name: newName } : s)));
    };

    const handleCopyScenario = (id) => {
        setScenarios(prevScenarios => {
            if (prevScenarios.length >= 5) {
                alert("You can create a maximum of 5 scenarios.");
                return prevScenarios;
            }
            const scenarioToCopy = prevScenarios.find(s => s.id === id);
            if (!scenarioToCopy) return prevScenarios;
            const newScenario = deepCopy(scenarioToCopy);
            newScenario.id = Date.now();
            newScenario.name = `${scenarioToCopy.name} (Copy)`;
            setActiveScenarioId(newScenario.id);
            return [...prevScenarios, newScenario];
        });
    };

    const handleDeleteScenario = (id) => {
        if (scenarios.length <= 1) {
            alert("The last scenario cannot be deleted.");
            return;
        }
        if (activeScenarioId === id) {
            const newActiveScenario = scenarios.find(s => s.id !== id);
            setActiveScenarioId(newActiveScenario.id);
        }
        setScenarios(prevScenarios => prevScenarios.filter(s => s.id !== id));
        setStandardResults(prev => {
            const newResults = {...prev};
            delete newResults[id];
            return newResults;
        });
        setAiResults(prev => {
            const newResults = {...prev};
            delete newResults[id];
            return newResults;
        });
    };
    
    const runMonteCarloTest = () => {
        alert("This feature is now integrated into the 'Run AI Simulation'. Each run is an average of the selected number of Monte Carlo simulations (e.g., 1000 runs) executed by the AI engine.");
    };

    const handleExport = () => {
        exportScenarioToJSON(activeScenario);
    };

    const handleImportClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            importScenarioFromJSON(file, (importedScenario, error) => {
                if (error) {
                    setImportError(error);
                    alert(`Import failed: ${error}`);
                } else {
                    const newScenario = deepCopy(activeScenario);
                    newScenario.name = importedScenario.name || activeScenario.name;
                    newScenario.settings = importedScenario.settings || activeScenario.settings;
                    
                    setScenarios(prev => prev.map(s => s.id === activeScenarioId ? newScenario : s));
                    setImportError(null); 
                    alert(`Scenario "${newScenario.name}" loaded successfully!`);
                }
            });
        }
        event.target.value = null; 
    };

    const handleDownloadResults = (format) => {
        const activeAiResults = aiResults[activeScenarioId];
        const activeStandardResults = standardResults[activeScenarioId];
        if (!activeAiResults || !activeStandardResults) {
            alert("Please run the simulation first to generate results.");
            return;
        }
        if (format === 'csv') {
            exportToCSV(activeAiResults.detailedLog, `${activeScenario.name}_AI_Optimized`);
            exportToCSV(activeStandardResults.detailedLog, `${activeScenario.name}_Baseline`);
        }
    };
    
    return (
    <div>
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            backgroundColor: '#111827',
            borderBottom: '1px solid #374151'
        }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white' }}>
                Intelligent Retirement Planner
            </h1>
            <div style={{ display: 'flex', gap: '12px' }}>
                <button
                    style={{ padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', backgroundColor: '#374151', border: '1px solid #4b5563', color: '#d1d5db', transition: 'background-color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#374151'}
                    title={scenarios.length >= 5 ? "Maximum of 5 scenarios reached." : "Add Scenario"}
                    onClick={handleAddScenario}
                    disabled={scenarios.length >= 5}
                >
                    Add Scenario
                </button>
                <button onClick={handleImportClick} style={{ padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', backgroundColor: '#374151', border: '1px solid #4b5563', color: '#d1d5db', transition: 'background-color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#374151'}>Import</button>
                <button onClick={handleExport} style={{ padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', backgroundColor: '#374151', border: '1px solid #4b5563', color: '#d1d5db', transition: 'background-color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#374151'}>Export</button>
                <div style={{height: '100%', borderLeft: '1px solid #4b5563'}}></div>
                <button onClick={() => handleDownloadResults('csv')} style={{ padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', backgroundColor: '#374151', border: '1px solid #4b5563', color: '#d1d5db', transition: 'background-color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#374151'}>Download CSV</button>
            </div>
        </div>
        
        <ScenarioManager
            scenarios={scenarios}
            activeScenarioId={activeScenarioId}
            onSelectScenario={handleSelectScenario}
            onRenameScenario={handleRenameScenario}
            onCopyScenario={handleCopyScenario}
            onDeleteScenario={handleDeleteScenario}
	        colors={SCENARIO_COLORS}
        />
        <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".json"
            onChange={handleFileChange}
        />
        
        <div className="flex flex-col gap-5 p-5">
            <div className="w-full flex flex-col gap-5">
                <div className="card-section">
                    <button onClick={() => toggleSection('basic')} className="w-full flex items-center justify-between text-lg font-bold text-left p-4 transition-colors duration-200 hover:bg-gray-700">
                        <span>Basic Information</span>
                        <svg style={{ transform: openSections.basic ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                    </button>
                    {openSections.basic && (
                        <div className="p-5">
                            <BasicSettings
                                scenario={activeScenario}
                                onUpdate={handleSettingsChange}
                            />
                        </div>
                    )}
                </div>

                <div className="card-section">
                    <button onClick={() => toggleSection('assets')} className="w-full flex items-center justify-between text-lg font-bold text-left p-4 transition-colors duration-200 hover:bg-gray-700">
                        <span>Assets & Strategy</span>
                        <svg style={{ transform: openSections.assets ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                    </button>
                    {openSections.assets && (
                        <div className="p-5">
                            <AssetsStrategy
                                scenario={activeScenario}
                                onUpdate={handleSettingsChange}
                            />
                            <AssetProfiles
                                scenario={activeScenario}
                                onUpdate={handleSettingsChange}
                                useSimpleMode={activeScenario.settings.portfolio.useSimpleMode}
                            />
                        </div>
                    )}
                </div>

                <div className="card-section">
                    <button onClick={() => toggleSection('incomes')} className="w-full flex items-center justify-between text-lg font-bold text-left p-4 transition-colors duration-200 hover:bg-gray-700">
                        <span>Incomes & Events</span>
                        <svg style={{ transform: openSections.incomes ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                    </button>
                    {openSections.incomes && (
                        <div className="p-5">
                            <IncomesExpenses
                                scenario={activeScenario}
                                onUpdate={handleSettingsChange}
                            />
                        </div>
                    )}
                </div>

               <div className="bg-gray-800 p-5 rounded-lg border border-gray-700">
                <h2 className="text-xl font-bold mb-4">Run Simulations</h2>
                <div className="flex gap-4 items-end flex-wrap">
                    <button 
                        onClick={runStandardSimulation} 
                        className="px-5 py-2.5 text-lg justify-center bg-blue-600 text-white rounded-md cursor-pointer h-12 flex items-center transition-colors hover:bg-blue-700"
                        style={{ flexGrow: 2 }}
                        disabled={isCalculatingStd}
                    >
                        {isCalculatingStd ? 'Calculating...' : 'Run AI Simulation'}
                    </button>

                    <div className="flex flex-col gap-2 min-w-[250px]" style={{ flexGrow: 1 }}>
                       <div className="flex gap-4 items-end">
                            <button onClick={runMonteCarloTest} disabled={true} className="px-5 py-2.5 text-lg justify-center bg-gray-600 text-white rounded-md flex items-center h-12 disabled:cursor-not-allowed disabled:opacity-70 flex-grow transition-colors">
                                Monte Carlo (Legacy)
                            </button>
                            <div style={{width: '110px'}}>
                                <label htmlFor="simulationCount" style={{fontSize: '12px', color: '#9ca3af'}}>Runs</label>
                                <select
                                    id="simulationCount"
                                    value={activeScenario.settings.monteCarlo.simulationCount}
                                    onChange={(e) => handleSettingsChange('monteCarlo.simulationCount', parseInt(e.target.value, 10))}
                                    style={{width: '100%', padding: '8px 12px', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '6px', color: 'white', height: '48px'}}
                                >
                                    {[100, 500, 1000, 2000, 5000].map(val => (
                                        <option key={val} value={val}>{val.toLocaleString()}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={devMode} onChange={e => setDevMode(e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                    <span className="text-sm font-medium text-gray-300">Show Developer Details</span>
                </div>
            </div>
            </div>

            <div className="w-full mt-5">
                <ResultsSection 
                    allScenarioResults={standardResults}
                    aiResults={aiResults}
                    scenarios={scenarios}
                    activeScenario={activeScenario}
                    devMode={devMode}
	                colors={SCENARIO_COLORS}
                />
            </div>
        </div>
    </div>
  );
};
