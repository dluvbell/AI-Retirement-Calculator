// --- components/layout/ResultsSection.js ---

const DetailedLogTable = ({ logData, scenarioName }) => {
    if (!logData || logData.length === 0) {
        return <p style={{ color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>Run simulation to see detailed annual log.</p>;
    }

    const tableContainerStyle = { marginTop: '20px', maxHeight: '500px', overflowY: 'auto', border: '1px solid #374151', borderRadius: '6px' };
    const tableStyle = { width: '100%', minWidth: '1000px', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'monospace' };
    const thStyle = { backgroundColor: '#374151', padding: '8px', textAlign: 'right', borderBottom: '1px solid #4b5563', position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap' };
    const tdStyle = { padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #374151' };

    return (
        <div style={{ marginTop: '30px', borderTop: '2px solid #4b5563', paddingTop: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#a5f3fc' }}>
                Account Balances Log: {scenarioName}
            </h3>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '10px' }}>
                Verify LIRA to LIF/RRSP conversions by tracking the year-over-year balances below.
            </p>
            <div style={tableContainerStyle}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={{...thStyle, textAlign: 'left'}}>Year(Age)</th>
                            <th style={{...thStyle, color: 'white'}}>End Net Worth</th>
                            <th style={{...thStyle, color: '#fbbf24'}}>LIRA Bal</th>
                            <th style={{...thStyle, color: '#34d399'}}>LIF Bal</th>
                            <th style={{...thStyle, color: '#f472b6'}}>RRSP Bal</th>
                            <th style={{...thStyle, color: '#60a5fa'}}>TFSA Bal</th>
                            <th style={{...thStyle, color: '#a78bfa'}}>Non-Reg Bal</th>
                            <th style={{...thStyle, color: '#9ca3af', borderLeft: '1px solid #4b5563'}}>Tax Paid</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logData.map((d, index) => {
                            const bals = d.balances || d.endBalances || {};
                            return (
                                <tr key={d.year} style={{ backgroundColor: index % 2 === 0 ? '#1f2937' : 'transparent' }}>
                                    <td style={{...tdStyle, textAlign: 'left', fontWeight: '600', color: '#e5e7eb'}}>{d.year} ({d.age})</td>
                                    <td style={{...tdStyle, fontWeight: 'bold', color: 'white'}}>{formatCurrency(d.end_nw || d.endTotalBalance)}</td>
                                    <td style={{...tdStyle, color: '#fbbf24'}}>{formatCurrency(bals.lira || 0)}</td>
                                    <td style={{...tdStyle, color: '#34d399'}}>{formatCurrency(bals.lif || 0)}</td>
                                    <td style={{...tdStyle, color: '#f472b6'}}>{formatCurrency(bals.rrsp || 0)}</td>
                                    <td style={{...tdStyle, color: '#60a5fa'}}>{formatCurrency(bals.tfsa || 0)}</td>
                                    <td style={{...tdStyle, color: '#a78bfa'}}>{formatCurrency(bals.non_reg || bals.nonReg || 0)}</td>
                                    <td style={{...tdStyle, color: '#9ca3af', borderLeft: '1px solid #4b5563'}}>{formatCurrency(d.tax_paid || d.taxPayable)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ResultsSection = ({ allScenarioResults, aiResults, scenarios, activeScenario, colors }) => {
    const chartRef = React.useRef(null);
    const chartInstanceRef = React.useRef(null);
    
    React.useEffect(() => {
        if (chartRef.current) {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
            }

            const ctx = chartRef.current.getContext('2d');
            
            const datasets = [];
            // ★★★ [수정] AI 및 Baseline 데이터셋 모두 추가 ★★★
            scenarios.forEach((scenario, index) => {
                const aiResult = aiResults[scenario.id];
                const baseResult = allScenarioResults[scenario.id];
                const color = colors[index % colors.length];

                // 1. AI 데이터셋 (실선)
                if (aiResult && aiResult.yearlyData) {
                    datasets.push({
                        label: `${scenario.name} (AI)`,
                        data: aiResult.yearlyData.map(d => d.endTotalBalance),
                        borderColor: color,
                        backgroundColor: color,
                        borderWidth: 2,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    });
                }
                // 2. Baseline 데이터셋 (점선, 회색)
                if (baseResult && baseResult.yearlyData) {
                    datasets.push({
                        label: `${scenario.name} (Baseline)`,
                        data: baseResult.yearlyData.map(d => d.endTotalBalance),
                        borderColor: '#9ca3af', // 회색
                        borderDash: [5, 5],     // 점선 처리
                        borderWidth: 2,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    });
                }
            });

            // X축 라벨 생성 (활성 시나리오 기준)
            const activeResultForLabels = aiResults[activeScenario.id] || allScenarioResults[activeScenario.id];
            const labels = activeResultForLabels && activeResultForLabels.yearlyData 
                ? activeResultForLabels.yearlyData.map(d => d.age)
                : [];

            chartInstanceRef.current = new Chart(ctx, {
                type: 'line',
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    // ★★★ [수정] 툴팁 모드 변경 (수직선 위의 모든 데이터 표시) ★★★
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: { labels: { color: '#d1d5db' } },
                        title: { display: true, text: 'Net Worth Projection (AI vs Baseline)', color: 'white', font: { size: 16 } },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(17, 24, 39, 0.9)',
                            titleColor: '#fff',
                            bodyColor: '#d1d5db',
                            borderColor: '#374151',
                            borderWidth: 1
                        }
                    },
                    scales: {
                        x: { 
                            ticks: { color: '#9ca3af' }, 
                            grid: { color: 'rgba(75, 85, 99, 0.1)' }, 
                            title: { display: true, text: 'Age', color: '#9ca3af'} 
                        },
                        y: { 
                            ticks: { color: '#9ca3af', callback: (value) => formatCurrency(value) }, 
                            grid: { color: 'rgba(75, 85, 99, 0.1)' } 
                        }
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

            {activeAiResult && <DetailedLogTable logData={activeAiResult.detailedLog} scenarioName={activeScenario.name} />}
        </div>
    );
};
