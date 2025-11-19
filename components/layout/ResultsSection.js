// --- components/layout/ResultsSection.js ---

// [신설] 개발자용 상세 로그 테이블 (모든 현금 흐름 표시)
const DeveloperLogTable = ({ logData }) => {
    if (!logData || logData.length === 0) return null;

    const tableContainerStyle = { 
        marginTop: '20px', maxHeight: '600px', overflow: 'auto', 
        border: '1px solid #4b5563', borderRadius: '6px', backgroundColor: '#111827' 
    };
    const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'nowrap' };
    const thStyle = { 
        backgroundColor: '#1f2937', padding: '8px', textAlign: 'right', 
        borderBottom: '2px solid #6b7280', borderRight: '1px solid #374151', 
        position: 'sticky', top: 0, zIndex: 10, color: '#e5e7eb' 
    };
    const tdStyle = { padding: '4px 8px', textAlign: 'right', borderBottom: '1px solid #374151', borderRight: '1px solid #374151', color: '#d1d5db' };
    const stickyColStyle = { ...tdStyle, position: 'sticky', left: 0, backgroundColor: '#1f2937', zIndex: 5, textAlign: 'center', fontWeight: 'bold' };
    const stickyHeaderStyle = { ...thStyle, position: 'sticky', left: 0, zIndex: 15, textAlign: 'center' };

    return (
        <div style={{ marginTop: '30px', borderTop: '2px dashed #4b5563', paddingTop: '20px' }}>
             <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg style={{width:'20px', height:'20px'}} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
                Developer's Detailed Log (Full Cash Flow)
            </h3>
            <div style={tableContainerStyle}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={stickyHeaderStyle}>Year (Age)</th>
                            <th style={thStyle}>Start NW</th>
                            
                            {/* Income & Expense */}
                            <th style={{...thStyle, color: '#a5f3fc'}}>Total Income</th>
                            <th style={{...thStyle, color: '#fca5a5'}}>Total Expense</th>
                            <th style={{...thStyle, color: '#f87171'}}>Tax Paid</th>
                            
                            {/* Withdrawals */}
                            <th style={thStyle}>LIF W/D</th>
                            <th style={thStyle}>RRSP W/D</th>
                            <th style={thStyle}>TFSA W/D</th>
                            <th style={thStyle}>NonReg W/D</th>
                            
                            {/* Balances (End of Year) */}
                            <th style={{...thStyle, color: '#fbbf24'}}>LIRA Bal</th>
                            <th style={{...thStyle, color: '#34d399'}}>LIF Bal</th>
                            <th style={{...thStyle, color: '#f472b6'}}>RRSP Bal</th>
                            <th style={{...thStyle, color: '#60a5fa'}}>TFSA Bal</th>
                            <th style={{...thStyle, color: '#a78bfa'}}>NonReg Bal</th>
                            <th style={{...thStyle, color: '#9ca3af'}}>Chequing Bal</th>
                            
                            <th style={{...thStyle, fontWeight:'bold', color:'white'}}>End NW</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logData.map((d, index) => {
                            const bals = d.balances || {};
                            const wds = d.withdrawals || {};
                            return (
                                <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#1f2937' : '#111827' }}>
                                    <td style={stickyColStyle}>{d.year} ({d.age})</td>
                                    <td style={tdStyle}>{formatCurrency(d.start_nw, 0)}</td>
                                    
                                    <td style={{...tdStyle, color: '#a5f3fc'}}>{formatCurrency(d.total_income, 0)}</td>
                                    <td style={{...tdStyle, color: '#fca5a5'}}>{formatCurrency(d.total_expense, 0)}</td>
                                    <td style={{...tdStyle, color: '#f87171'}}>{formatCurrency(d.tax_paid, 0)}</td>
                                    
                                    <td style={tdStyle}>{formatCurrency(wds.lif || 0, 0)}</td>
                                    <td style={tdStyle}>{formatCurrency(wds.rrsp || 0, 0)}</td>
                                    <td style={tdStyle}>{formatCurrency(wds.tfsa || 0, 0)}</td>
                                    <td style={tdStyle}>{formatCurrency(wds.non_reg || 0, 0)}</td>
                                    
                                    <td style={{...tdStyle, color: '#fbbf24'}}>{formatCurrency(bals.lira || 0, 0)}</td>
                                    <td style={{...tdStyle, color: '#34d399'}}>{formatCurrency(bals.lif || 0, 0)}</td>
                                    <td style={{...tdStyle, color: '#f472b6'}}>{formatCurrency(bals.rrsp || 0, 0)}</td>
                                    <td style={{...tdStyle, color: '#60a5fa'}}>{formatCurrency(bals.tfsa || 0, 0)}</td>
                                    <td style={{...tdStyle, color: '#a78bfa'}}>{formatCurrency(bals.non_reg || 0, 0)}</td>
                                    <td style={{...tdStyle, color: '#9ca3af'}}>{formatCurrency(bals.chequing || 0, 0)}</td>
                                    
                                    <td style={{...tdStyle, fontWeight:'bold', color:'white'}}>{formatCurrency(d.end_nw, 0)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const DetailedLogTable = ({ logData, scenarioName }) => {
    // 일반 사용자용 요약 테이블 (기존 유지)
    if (!logData || logData.length === 0) {
        return <p style={{ color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>Run simulation to see summary log.</p>;
    }
    // ... (기존 DetailedLogTable 코드 생략 - 위에서 이미 구현됨, 중복 방지 위해 그대로 둡니다) ...
    // 사용자 요청에 따라 DetailedLogTable 대신 DeveloperLogTable을 주로 사용하게 될 것임.
    // 하지만 "Show Developer Log"가 꺼져있을 때 보여줄 간단한 버전이 필요하므로 유지.
    
    const tableContainerStyle = { marginTop: '20px', maxHeight: '400px', overflowY: 'auto', border: '1px solid #374151', borderRadius: '6px' };
    const tableStyle = { width: '100%', minWidth: '800px', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'monospace' };
    const thStyle = { backgroundColor: '#374151', padding: '8px', textAlign: 'right', borderBottom: '1px solid #4b5563', position: 'sticky', top: 0, zIndex: 1, color: '#d1d5db' };
    const tdStyle = { padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #374151', color: '#9ca3af' };

    return (
        <div style={{ marginTop: '30px', borderTop: '2px solid #4b5563', paddingTop: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#a5f3fc' }}>
                Summary Log: {scenarioName}
            </h3>
            <div style={tableContainerStyle}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={{...thStyle, textAlign:'left'}}>Age</th>
                            <th style={thStyle}>Net Worth</th>
                            <th style={thStyle}>Income</th>
                            <th style={thStyle}>Expense</th>
                            <th style={thStyle}>Tax</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logData.map((d, index) => (
                            <tr key={d.year} style={{ backgroundColor: index % 2 === 0 ? '#1f2937' : 'transparent' }}>
                                <td style={{...tdStyle, textAlign:'left', fontWeight:'bold'}}>{d.age}</td>
                                <td style={{...tdStyle, color:'white'}}>{formatCurrency(d.end_nw, 0)}</td>
                                <td style={tdStyle}>{formatCurrency(d.total_income, 0)}</td>
                                <td style={tdStyle}>{formatCurrency(d.total_expense, 0)}</td>
                                <td style={tdStyle}>{formatCurrency(d.tax_paid, 0)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ResultsSection = ({ allScenarioResults, aiResults, scenarios, activeScenario, colors, showDevLog }) => {
    const chartRef = React.useRef(null);
    const chartInstanceRef = React.useRef(null);
    
    React.useEffect(() => {
        if (chartRef.current) {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
            }
            const ctx = chartRef.current.getContext('2d');
            const datasets = [];
            
            scenarios.forEach((scenario, index) => {
                const aiResult = aiResults[scenario.id];
                const baseResult = allScenarioResults[scenario.id];
                const color = colors[index % colors.length];

                if (aiResult && aiResult.yearlyData) {
                    datasets.push({
                        label: `${scenario.name} (AI)`,
                        data: aiResult.yearlyData.map(d => d.endTotalBalance),
                        borderColor: color,
                        backgroundColor: color,
                        borderWidth: 2,
                        tension: 0.4,
                        pointRadius: 0
                    });
                }
                if (baseResult && baseResult.yearlyData) {
                    datasets.push({
                        label: `${scenario.name} (Baseline)`,
                        data: baseResult.yearlyData.map(d => d.endTotalBalance),
                        borderColor: '#9ca3af',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        tension: 0.4,
                        pointRadius: 0
                    });
                }
            });

            const activeResult = aiResults[activeScenario.id] || allScenarioResults[activeScenario.id];
            const labels = activeResult && activeResult.yearlyData ? activeResult.yearlyData.map(d => d.age) : [];

            chartInstanceRef.current = new Chart(ctx, {
                type: 'line',
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { labels: { color: '#d1d5db' } },
                        title: { display: true, text: 'Net Worth Projection', color: 'white', font: { size: 16 } },
                        tooltip: {
                            mode: 'index', intersect: false,
                            backgroundColor: 'rgba(17, 24, 39, 0.9)',
                            titleColor: '#fff', bodyColor: '#d1d5db', borderColor: '#374151', borderWidth: 1
                        }
                    },
                    scales: {
                        x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(75, 85, 99, 0.1)' }, title: { display: true, text: 'Age', color: '#9ca3af'} },
                        y: { ticks: { color: '#9ca3af', callback: (value) => formatCurrency(value) }, grid: { color: 'rgba(75, 85, 99, 0.1)' } }
                    }
                }
            });
        }
        return () => { if (chartInstanceRef.current) { chartInstanceRef.current.destroy(); } };
    }, [aiResults, allScenarioResults, scenarios, activeScenario.id, colors]);

    const sectionStyle = { padding: '20px', border: '1px solid #374151', margin: '20px', borderRadius: '8px' };
    const h2Style = { fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' };
    const summaryGridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' };
    const resultBoxStyle = { backgroundColor: '#1f2937', padding: '16px', borderRadius: '8px' };
    
    const activeStandardResult = allScenarioResults[activeScenario.id];
    const activeAiResult = aiResults[activeScenario.id];

    return (
        <div style={sectionStyle}>
            <h2 style={h2Style}>Simulation Results: {activeScenario.name}</h2>
            
            {(activeStandardResult || activeAiResult) && (
                <div style={summaryGridStyle}>
                    <div style={resultBoxStyle}>
                        <h3 style={{color: '#9ca3af'}}>Baseline (Rule-based)</h3>
                        <p><strong>Final Net Worth:</strong> {activeStandardResult ? formatCurrency(activeStandardResult.finalBalance) : 'N/A'}</p>
                        <p><strong>Total Tax Paid:</strong> {activeStandardResult ? formatCurrency(activeStandardResult.totalTax) : 'N/A'}</p>
                    </div>
                    <div style={resultBoxStyle}>
                        <h3 style={{color: '#a5f3fc'}}>AI Optimized</h3>
                        <p><strong>Final Net Worth:</strong> {activeAiResult ? formatCurrency(activeAiResult.finalBalance) : 'N/A'}</p>
                        <p><strong>Total Tax Paid:</strong> {activeAiResult ? formatCurrency(activeAiResult.totalTax) : 'N/A'}</p>
                    </div>
                </div>
            )}

            <div style={{ height: '400px', position: 'relative' }}><canvas ref={chartRef}></canvas></div>

            {/* ★★★ [수정] 토글 상태(showDevLog)에 따라 다른 테이블 표시 ★★★ */}
            {activeAiResult && (
                showDevLog 
                ? <DeveloperLogTable logData={activeAiResult.detailedLog} />
                : <DetailedLogTable logData={activeAiResult.detailedLog} scenarioName={activeScenario.name} />
            )}
        </div>
    );
};
