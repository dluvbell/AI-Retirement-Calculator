// --- simulation.worker.js ---

// 1. 계산에 필요한 모든 엔진 스크립트들을 불러옵니다.
importScripts(
    'https://unpkg.com/javascript-lp-solver/prod/solver.js',
    './utils.js',
    './data.js',
    './tax.js',
    './strategy.js',
    './simulation.js'
);

// 2. 메인 스레드(App.js)로부터 메시지를 받을 준비를 합니다.
self.onmessage = function(event) {
    const { scenario, runs } = event.data;

    if (!scenario || runs === undefined) {
        self.postMessage({ error: 'Worker received invalid data.' });
        return;
    }

    const finalBalances = [];
    const depletionYears = [];
    let successCount = 0;
    const simulationPaths = [];

    for (let i = 0; i < runs; i++) {
        try {
            // ★★★ 수정된 부분: 세 번째 인자로 반복 순번 'i'를 넘겨줍니다 ★★★
            const result = runSingleSimulation(scenario, true, i);

            const lastYearData = result.yearlyData[result.yearlyData.length - 1];
            if (lastYearData) {
                finalBalances.push(lastYearData.endTotalBalance);
            }

            const path = result.yearlyData.map(d => d.endTotalBalance);
            simulationPaths.push(path);

            if (result.fundDepletionYear > scenario.settings.endYear) {
                successCount++;
            } else {
                depletionYears.push(result.fundDepletionYear);
            }

            if ((i + 1) % 50 === 0 || (i + 1) === runs) {
                self.postMessage({ 
                    type: 'progress', 
                    completedRuns: i + 1,
                    totalRuns: runs 
                });
            }

        } catch (e) {
            self.postMessage({ error: `Simulation run failed: ${e.message}` });
            return; 
        }
    }

    self.postMessage({
        finalBalances: finalBalances,
        depletionYears: depletionYears,
        successCount: successCount,
        simulationPaths: simulationPaths
    });
};