// --- engine/utils.js ---

/**
 * 이 파일은 앱 전체에서 사용되는 순수 유틸리티 함수들만 포함해야 합니다.
 * (data.js의 내용이 실수로 복사되어 있던 것을 모두 제거하고, 
 * App.js 및 ResultsSection.js가 필요로 하는 함수들로 복원합니다.)
 */

/**
 * 숫자를 통화 형식 (예: $1,234.56)으로 포맷합니다.
 * ResultsSection.js에서 사용합니다.
 */
const formatCurrency = (value, decimals = 2) => {
    const num = Number(value);
    if (isNaN(num)) {
        return '$0.00';
    }
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'CAD', // 캐나다 달러 기준
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(num);
};

/**
 * 객체나 배열을 깊은 복사(deep copy)합니다.
 * App.js에서 시나리오 복사 시 사용합니다.
 */
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

/**
 * 현재 시나리오를 JSON 파일로 내보냅니다.
 * App.js에서 사용합니다.
 */
const exportScenarioToJSON = (scenario) => {
    try {
        const dataStr = JSON.stringify(scenario, null, 4);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = `${scenario.name.replace(/ /g, '_') || 'scenario'}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    } catch (err) {
        console.error("Error exporting scenario:", err);
        alert("Failed to export scenario. See console for details.");
    }
};

/**
 * JSON 파일을 읽어 시나리오를 불러옵니다.
 * App.js에서 사용합니다.
 */
const importScenarioFromJSON = (file, callback) => {
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedScenario = JSON.parse(event.target.result);
            if (importedScenario && importedScenario.settings && importedScenario.id) {
                callback(importedScenario, null);
            } else {
                callback(null, "Invalid scenario file format.");
            }
        } catch (err) {
            console.error("Error importing scenario:", err);
            callback(null, `Error parsing JSON file: ${err.message}`);
        }
    };
    reader.onerror = (err) => {
        console.error("File reading error:", err);
        callback(null, "Failed to read the file.");
    };
    reader.readAsText(file);
};

/**
 * 시뮬레이션 결과 로그를 CSV로 변환합니다.
 * App.js에서 사용합니다.
 */
const exportToCSV = (logData, fileName) => {
    if (!logData || logData.length === 0) {
        alert("No data to export.");
        return;
    }

    const headers = Object.keys(logData[0]).join(',');
    const rows = logData.map(row => 
        Object.values(row).map(val => 
            typeof val === 'object' ? `"${JSON.stringify(val).replace(/"/g, '""')}"` : val
        ).join(',')
    );

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};