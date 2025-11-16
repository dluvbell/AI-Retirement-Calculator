// --- components/layout/ResultsSection.js ---

// ★★★ [수정] DeveloperDetailsTable 및 하위 컴포넌트(TaxCalculationDetails, AccountDetails, CashFlowDetails) 삭제 ★★★
// (해당 컴포넌트들은 Python 서버가 반환하지 않는 구(舊) 데이터 구조를 기반으로 하고 있어 '죽은 코드'이므로 제거합니다.)

const DetailedLogTable = ({ logData, scenarioName, type }) => {
    if (!logData || logData.length === 0) {
        return <p style={{ color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>Run simulation to see detailed annual log.</p>;
    }

    const tableContainerStyle = { marginTop: '20px', maxHeight: '500px', overflowY: 'auto', border: '1px solid #374151', borderRadius: '6px' };
    const tableStyle = { width: '100%', minWidth: '1200px', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'monospace' };
    const thStyle = { backgroundColor: '#374151', padding: '8px', textAlign: 'right', borderBottom: '1px solid #4b5563', position: 'sticky', top: 0, zIndex: 1 };
    const tdStyle = { padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #374151' };

    return (
        <div style={{ marginTop: '30px', borderTop: '2px solid #4b5563', paddingTop: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                Detailed Annual Log: {scenarioName} ({type})
            </h3>
            <div style={tableContainerStyle}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={{...thStyle, textAlign: 'left'}}>Year(Age)</th>
                            <th style={thStyle}>Start NW</th>
                            <th style={{...thStyle, color: '#a5f3fc'}}>+ Income</th>
                            <th style={thStyle}>- Expense</th>
                            <th style={{...thStyle, color: '#fca5a5'}}>- Withdrawal</th>
                            <th style={{...thStyle, color: '#4ade80'}}>+ Inv. Growth</th>
                            <th style={thStyle}>- Tax Paid</th>
                            <th style={{...thStyle, fontWeight: 'bold'}}>End NW</th>
                            <th style={{...thStyle, color: '#f87171', borderLeft: '1px solid #4b5563'}}>TFSA W/D</th>
                            <th style={{...thStyle, color: '#f87171'}}>RRSP W/D</th>
                            <th style={{...thStyle, color: '#f87171'}}>NonReg W/D</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logData.map((d, index) => {
                            const totalWithdrawal = (d.withdrawals.tfsa || 0) + (d.withdrawals.rrsp || 0) + (d.withdrawals.non_reg || 0);
                            const investmentGrowth = d.end_nw - d.start_nw - d.total_income + d.total_expense + d.tax_paid + totalWithdrawal;
                            return (
                                <tr key={d.year} style={{ backgroundColor: index % 2 === 0 ? '#1f2937' : 'transparent' }}>
                                    <td style={{...tdStyle, textAlign: 'left', fontWeight: '600'}}>{d.year} ({d.age})</td>
                                    <td style={tdStyle}>{formatCurrency(d.start_nw)}</td>
                                    <td style={{...tdStyle, color: '#a5f3fc'}}>{formatCurrency(d.total_income)}</td>
                                    <td style={tdStyle}>{formatCurrency(d.total_expense)}</td>
                                    <td style={{...tdStyle, color: '#fca5a5'}}>{formatCurrency(totalWithdrawal)}</td>
                                    <td style={{...tdStyle, color: investmentGrowth >= 0 ? '#4ade80' : '#f87171'}}>{formatCurrency(investmentGrowth)}</td>
                                    <td style={tdStyle}>{formatCurrency(d.tax_paid)}</td>
                                    <td style={{...tdStyle, fontWeight: 'bold'}}>{formatCurrency(d.end_nw)}</td>
                                    <td style={{...tdStyle, color: '#f87171', borderLeft: '1px solid #4b5563'}}>{formatCurrency(d.withdrawals.tfsa)}</td>
                                    <td style={{...tdStyle, color: '#f87171'}}>{formatCurrency(d.withdrawals.rrsp)}</td>
                                    <td style={{...tdStyle, color: '#f87171'}}>{formatCurrency(d.withdrawals.non_reg)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- [오류 수정 지점] ---
// `standardResults`를 `allScenarioResults`로 변경합니다.
const ResultsSection = ({ allScenarioResults, aiResults, scenarios, activeScenario, devMode, colors }) => {
    const chartRef = React.useRef(null);
    const chartInstanceRef = React.useRef(null);
    
    React.useEffect(() => {
        if (chartRef.current) {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
            }

            const ctx = chartRef.current.getContext('2d');
            
            const datasets = scenarios.map((scenario, index) => {
                const result = aiResults[scenario.id];
                if (!result || !result.yearlyData) return null;

                return {
                    label: `${scenario.name} (AI Optimized)`,
                    data: result.yearlyData.map(d => d.endTotalBalance),
                    borderColor: colors[index % colors.length],
                    borderWidth: scenario.id === activeScenario.id ? 3 : 1.5,
                    pointRadius: 0,
                    tension: 0.4
                };
            }).filter(Boolean);

            const activeResultForLabels = aiResults[activeScenario.id] || Object.values(aiResults).find(r => r);
            const labels = activeResultForLabels && activeResultForLabels.yearlyData 
                ? activeResultForLabels.yearlyData.map(d => d.age)
                : [];

            chartInstanceRef.current = new Chart(ctx, {
                type: 'line',
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#d1d5db' } },
                        title: { display: true, text: 'AI Optimized Net Worth Comparison', color: 'white', font: { size: 16 } }
                    },
                    scales: {
                        x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(75, 85, 99, 0.5)' }, title: { display: true, text: 'Age', color: '#9ca3af'} },
                        y: { ticks: { color: '#9ca3af', callback: (value) => formatCurrency(value) }, grid: { color: 'rgba(75, 85, 99, 0.5)' } }
                    }
                }
            });
        }
        return () => { if (chartInstanceRef.current) { chartInstanceRef.current.destroy(); } };
    }, [aiResults, scenarios, activeScenario.id, colors]);

    const sectionStyle = { padding: '20px', border: '1px solid #374151', margin: '20px', borderRadius: '8px' };
    const h2Style = { fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' };
    const summaryGridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' };
    const resultBoxStyle = { backgroundColor: '#1f2937', padding: '16px', borderRadius: '8px' };
    
    // --- [오류 수정 지점] ---
    // `standardResults`를 `allScenarioResults`로 변경합니다.
    const activeStandardResult = allScenarioResults[activeScenario.id];
    const activeAiResult = aiResults[activeScenario.id];

    return (
        <div style={sectionStyle}>
            <h2 style={h2Style}>Simulation Results: {activeScenario.name}</h2>
            
            {(activeStandardResult || activeAiResult) && (
                <div style={summaryGridStyle}>
                    <div style={resultBoxStyle}>
                        <h3 style={{color: '#9ca3af'}}>Baseline (Simple Rules)</h3>
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

            {activeAiResult && <DetailedLogTable logData={activeAiResult.detailedLog} scenarioName={activeScenario.name} type="AI Optimized" />}
            {/* ★★★ [수정] devMode가 켜지면 Baseline의 상세 로그 테이블을 보여줍니다. ★★★ */}
            {devMode && activeStandardResult && <DetailedLogTable logData={activeStandardResult.detailedLog} scenarioName={activeScenario.name} type="Baseline" />}
            
            {/* ★★★ [수정] DeveloperDetailsTable 호출 삭제 (죽은 코드) ★★★ */}
        </div>
    );
};
