// --- components/layout/ResultsSection.js ---

const TaxCalculationDetails = ({ details }) => {
    if (!details || !details.federal) return null;
    const taxSectionStyle = { backgroundColor: '#111827', border: '1px solid #4b5563', borderRadius: '6px', padding: '12px', marginTop: '12px', fontSize: '12px', fontFamily: 'monospace' };
    const rowStyle = { display: 'flex', justifyContent: 'space-between', padding: '2px 4px', borderBottom: '1px dotted #374151' };
    const labelStyle = { color: '#9ca3af' };
    const valueStyle = { color: 'white', textAlign: 'right' };
    const headerStyle = { color: '#a5f3fc', fontWeight: '600', marginTop: '10px', marginBottom: '4px' };
    const renderBracketTable = (breakdown) => ( <div style={{ paddingLeft: '16px' }}> {breakdown.map((b, i) => ( <div key={i} style={{...rowStyle, border: 'none'}}> <span style={labelStyle}>{`  - Bracket (up to ${formatCurrency(b.to)} @ ${(b.rate * 100).toFixed(2)}%):`}</span> <span style={valueStyle}>{formatCurrency(b.tax)}</span> </div> ))} </div> );
    return ( <div style={taxSectionStyle}> <div style={rowStyle}><strong>Taxable Income</strong><strong>{formatCurrency(details.taxableIncome)}</strong></div> <p style={headerStyle}>Federal Tax:</p> <div style={rowStyle}><span style={labelStyle}>Tax Before Credits</span><span style={valueStyle}>{formatCurrency(details.federal.taxBeforeCredits)}</span></div> {renderBracketTable(details.federal.taxByBracket)} <div style={rowStyle}><span style={labelStyle}>- Total Credits</span><span style={{...valueStyle, color: '#fca5a5'}}>-{formatCurrency(details.federal.credits.total)}</span></div> <div style={{...rowStyle, border: 'none', paddingLeft: '16px'}}><span style={labelStyle}>  - BPA:</span><span style={valueStyle}>-{formatCurrency(details.federal.credits.bpa)}</span></div> <div style={{...rowStyle, border: 'none', paddingLeft: '16px'}}><span style={labelStyle}>  - Age Credit:</span><span style={valueStyle}>-{formatCurrency(details.federal.credits.age)}</span></div> <div style={{...rowStyle, border: 'none', paddingLeft: '16px'}}><span style={labelStyle}>  - Pension Credit:</span><span style={valueStyle}>-{formatCurrency(details.federal.credits.pension)}</span></div> <div style={{...rowStyle, border: 'none', paddingLeft: '16px'}}><span style={labelStyle}>  - Dividend Tax Credit:</span><span style={valueStyle}>-{formatCurrency(details.federal.credits.dividend)}</span></div> <div style={{...rowStyle, borderTop: '1px solid #4b5563'}}><strong>= Federal Tax</strong><strong>{formatCurrency(details.federal.finalTax)}</strong></div> <p style={headerStyle}>Provincial Tax:</p> <div style={rowStyle}><span style={labelStyle}>Tax Before Credits</span><span style={valueStyle}>{formatCurrency(details.provincial.taxBeforeCredits)}</span></div> {renderBracketTable(details.provincial.taxByBracket)} <div style={rowStyle}><span style={labelStyle}>- Total Credits</span><span style={{...valueStyle, color: '#fca5a5'}}>-{formatCurrency(details.provincial.credits.total)}</span></div> <div style={{...rowStyle, border: 'none', paddingLeft: '16px'}}><span style={labelStyle}>  - BPA:</span><span style={valueStyle}>-{formatCurrency(details.provincial.credits.bpa)}</span></div> <div style={{...rowStyle, borderTop: '1px solid #4b5563'}}><strong>= Provincial Tax</strong><strong>{formatCurrency(details.provincial.finalTax)}</strong></div> </div> );
};
const AccountDetails = ({ yearData }) => {
    const { startAccounts, endAccounts, totalWithdrawals, dividendIncome } = yearData;
    const accountSectionStyle = { marginTop: '12px' };
    const accountHeaderStyle = { color: '#a5f3fc', fontWeight: '600', borderBottom: '1px solid #4b5563', paddingBottom: '4px', marginBottom: '4px' };
    const assetRowStyle = { display: 'flex', justifyContent: 'space-between', padding: '2px 8px', fontSize: '12px' };
    const calcStyle = { color: '#6b7280', fontFamily: 'monospace', whiteSpace: 'pre' };
    return ( <div style={accountSectionStyle}> {['rrsp', 'tfsa', 'nonReg'].map(acctKey => { const startHoldings = startAccounts[acctKey].holdings || {}; const endHoldings = endAccounts[acctKey].holdings || {}; const withdrawalTotal = totalWithdrawals[acctKey] || 0; const startTotal = Object.values(startHoldings).reduce((s, v) => s + v, 0); const endTotal = Object.values(endHoldings).reduce((s, v) => s + v, 0); const growthTotal = endTotal - startTotal + withdrawalTotal; return ( <div key={acctKey} style={{marginBottom: '16px'}}> <h5 style={accountHeaderStyle}>{acctKey.toUpperCase()} Account Details</h5> <div style={assetRowStyle}> <strong>{`Start: ${formatCurrency(startTotal)}`}</strong> <strong style={{color: growthTotal >= 0 ? '#4ade80' : '#fca5a5'}}>{`Growth: ${formatCurrency(growthTotal)}`}</strong> <strong style={{color: '#fca5a5'}}>{`Withdrawal: -${formatCurrency(withdrawalTotal)}`}</strong> <strong>{`End: ${formatCurrency(endTotal)}`}</strong> </div> {Object.keys(startHoldings).map(assetKey => { const start = startHoldings[assetKey] || 0; const end = endHoldings[assetKey] || 0; const withdrawal = start > 0 ? (start / startTotal) * withdrawalTotal : 0; const growth = end - start + withdrawal; return ( <div key={assetKey} style={{paddingLeft: '16px', marginTop: '4px'}}> <div style={{...assetRowStyle, color: '#d1d5db'}}>{assetKey.charAt(0).toUpperCase() + assetKey.slice(1)}:</div> <div style={{...assetRowStyle, ...calcStyle}}> {`${formatCurrency(start, 0)} (Start)`} <span>{`${growth >= 0 ? '+' : ''}${formatCurrency(growth, 0)} (Growth)`}</span> <span>{`-${formatCurrency(withdrawal, 0)} (Withdraw)`}</span> <span>{`= ${formatCurrency(end, 0)} (End)`}</span> </div> </div> ) })} </div> ); })} </div> );
}
const CashFlowDetails = ({ d }) => {
    const detailRowStyle = { display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #374151', fontSize: '12px' };
    const detailLabelStyle = { color: '#9ca3af', fontStyle: 'italic'};
    const detailValueStyle = { fontWeight: '500', color: '#e5e7eb' };
    return ( <div style={{marginTop: '12px'}}> <h4 style={{marginTop: '16px', fontWeight: '600', color: '#a5f3fc'}}>Cash Flow ($)</h4> <div style={detailRowStyle}><span style={detailLabelStyle}>Start Checking:</span><span style={detailValueStyle}>{formatCurrency(d.startBalances.checking)}</span></div> <div style={detailRowStyle}><span style={detailLabelStyle}>+ Total Income:</span><span style={{...detailValueStyle, color: '#4ade80'}}>{formatCurrency(d.totalIncome)}</span></div> <div style={detailRowStyle}><span style={detailLabelStyle}>+ Total Withdrawals:</span><span style={{...detailValueStyle, color: '#4ade80'}}>{formatCurrency(Object.values(d.totalWithdrawals).reduce((s, v) => s + v, 0))}</span></div> <div style={detailRowStyle}><span style={detailLabelStyle}>- Total Expenses:</span><span style={{...detailValueStyle, color: '#f87171'}}>{formatCurrency(d.totalExpense)}</span></div> <div style={detailRowStyle}><span style={detailLabelStyle}>- Tax Paid (for {d.year - 1}):</span><span style={{...detailValueStyle, color: '#f87171'}}>{formatCurrency(d.taxPayable)}</span></div> <div style={{...detailRowStyle, borderTop: '1px solid #4b5563', fontWeight: 'bold'}}><span style={detailLabelStyle}>End Checking:</span><span style={detailValueStyle}>{formatCurrency(d.endBalances.checking)}</span></div> </div> )
}
const DeveloperDetailsTable = ({ yearlyData }) => {
    const assetRowStyle = { display: 'flex', justifyContent: 'space-between', padding: '2px 8px', fontSize: '12px' };
    return ( <div style={{ marginTop: '30px', borderTop: '2px solid #4b5563', paddingTop: '20px' }}> <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>Developer Mode: Annual Breakdown</h3> {yearlyData.map(d => ( <details key={d.year} style={{ backgroundColor: '#1f2937', borderRadius: '6px', marginBottom: '10px', border: '1px solid #374151' }}> <summary style={{ padding: '12px', cursor: 'pointer', fontWeight: '600', fontSize: '16px' }}> {d.year} (Age: {d.age}) - End Balance: {formatCurrency(d.endTotalBalance)} </summary> <div style={{ padding: '12px', borderTop: '1px solid #374151', fontSize: '14px' }}> <AccountDetails yearData={d} /> <CashFlowDetails d={d} /> <h4 style={{marginTop: '16px', fontWeight: '600', color: '#a5f3fc'}}>Tax Calculation Details</h4> <div style={{...assetRowStyle, padding: '4px 8px', borderBottom: '1px solid #374151', display: 'flex', justifyContent: 'space-between', fontSize: '12px'}}> <span><strong>Total Tax (for {d.year} income, paid in {d.year+1})</strong></span> <span style={{color: '#f87171'}}><strong>{formatCurrency(d.taxPayable)}</strong></span> </div> <TaxCalculationDetails details={d.taxDetails} /> </div> </details> ))} </div> );
};

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
            {devMode && activeStandardResult && <DetailedLogTable logData={activeStandardResult.detailedLog} scenarioName={activeScenario.name} type="Baseline" />}
            
            {devMode && activeStandardResult && activeStandardResult.yearlyData && activeStandardResult.yearlyData.length > 0 && activeStandardResult.yearlyData[0].taxDetails && <DeveloperDetailsTable yearlyData={activeStandardResult.yearlyData} />}
        </div>
    );
};