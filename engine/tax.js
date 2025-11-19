// --- engine/tax.js ---

var taxData_2025 = {
    federal: {
        bpa: 16129,
        rates: [0.145, 0.205, 0.26, 0.29, 0.33], 
        brackets: [57375, 114750, 177882, 253414, Infinity],
    },
    ON: {
        bpa: 12399,
        rates: [0.0505, 0.0915, 0.1116, 0.1216, 0.1316],
        brackets: [51446, 102894, 150000, 220000, Infinity],
        surtax: { threshold1: 5883, rate1: 0.20, threshold2: 7528, rate2: 0.36 },
        ageAmount: { maxAmount: 5798, netIncomeThreshold: 42335, reductionRate: 0.15 }
    },
    QC: {
        bpa: 18056,
        rates: [0.14, 0.19, 0.24, 0.2575],
        brackets: [51780, 103545, 126000, Infinity],
        ageAmount: { maxAmount: 3728 }
    },
    BC: { 
        bpa: 12580, 
        rates: [0.0506, 0.077, 0.105, 0.1229, 0.147, 0.168, 0.205], 
        brackets: [47937, 95875, 110076, 133664, 181232, 252752, Infinity],
        ageAmount: { maxAmount: 5155, netIncomeThreshold: 28953, reductionRate: 0.15 }
    },
    AB: { 
        bpa: 21885, 
        rates: [0.10, 0.12, 0.13, 0.14, 0.15], 
        brackets: [148269, 177922, 237230, 355845, Infinity],
        ageAmount: { maxAmount: 5558, netIncomeThreshold: 42335, reductionRate: 0.15 }
    },
    SK: { bpa: 18491, rates: [0.105, 0.125, 0.145], brackets: [52057, 148734, Infinity] },
    MB: { bpa: 15780, rates: [0.108, 0.1275, 0.174], brackets: [47000, 100000, Infinity] },
    NB: { bpa: 13044, rates: [0.094, 0.14, 0.16, 0.195], brackets: [49958, 99916, 184347, Infinity] },
    NS: { 
        bpa: 11481, 
        rates: [0.0879, 0.1495, 0.1667, 0.175, 0.21], 
        brackets: [29590, 59180, 93000, 150000, Infinity],
        healthSurtax: {
            rates: [0.0, 0.005, 0.01, 0.015, 0.02],
            brackets: [20000, 35000, 50000, 100000, Infinity]
        } 
    },    
    PE: { bpa: 13500, rates: [0.0965, 0.1363, 0.1665], brackets: [32656, 65313, Infinity], surtax: { threshold1: 12500, rate1: 0.10 } },
    NL: { bpa: 10818, rates: [0.087, 0.145, 0.158, 0.178, 0.198, 0.208, 0.213, 0.218], brackets: [43331, 86662, 154730, 216619, 275870, 551739, 1103478, Infinity] },
    YT: { bpa: 15705, rates: [0.064, 0.09, 0.109, 0.128, 0.15], brackets: [55867, 111733, 173205, 500000, Infinity] },
    NT: { bpa: 18517, rates: [0.059, 0.086, 0.122, 0.1405], brackets: [50597, 101197, 164525, Infinity] },
    NU: { bpa: 18767, rates: [0.04, 0.07, 0.09, 0.115], brackets: [53268, 106537, 173205, Infinity] },
    general: { 
        oasClawbackThreshold: 95000, 
        ageAmount: { maxAmount: 8790, netIncomeThreshold: 42335, reductionRate: 0.15 },
        pensionIncomeAmount: { maxAmount: 2000 } 
    },
    dividend: { grossUp: 1.38, federalCreditRate: 0.150198, provincialCreditRates: { ON: 0.10, QC: 0.117, BC: 0.12, AB: 0.10, SK: 0.11, MB: 0.087, NB: 0.14, NS: 0.0879, PE: 0.098, NL: 0.076, YT: 0.12, NT: 0.064, NU: 0.072 } }
};
var PROVINCES = ['ON', 'QC', 'BC', 'AB', 'SK', 'MB', 'NB', 'NS', 'PE', 'NL', 'YT', 'NT', 'NU'];

var getTaxParametersForYear = function (year, taxInflationRate, province) {
    var normalizedProvince = province ? province.toUpperCase() : 'ON';
    var baseYear = 2025;
    var parameters = deepCopy(taxData_2025);

    if (year <= baseYear) {
        if (year > 2025) parameters.federal.rates[0] = 0.14;
        return Object.assign(Object.assign(Object.assign({}, parameters.general), parameters.dividend), { federal: parameters.federal, provincial: parameters[normalizedProvince] });
    }
    
    var inflationFactor = Math.pow(1 + taxInflationRate / 100, year - baseYear);
    
    parameters.federal.bpa *= inflationFactor;
    parameters.federal.brackets = parameters.federal.brackets.map(function (limit) { return limit === Infinity ? Infinity : limit * inflationFactor; });
    
    if (year > 2025) parameters.federal.rates[0] = 0.14;
    
    PROVINCES.forEach(function (prov) {
        if (parameters[prov]) {
            parameters[prov].bpa *= inflationFactor;
            parameters[prov].brackets = parameters[prov].brackets.map(function (limit) { return limit === Infinity ? Infinity : limit * inflationFactor; });
            if (parameters[prov].surtax) {
                if (parameters[prov].surtax.threshold1) {
                    parameters[prov].surtax.threshold1 *= inflationFactor;
                }
                if (parameters[prov].surtax.threshold2) {
                    parameters[prov].surtax.threshold2 *= inflationFactor;
                }
            }
        }
    });

    parameters.general.oasClawbackThreshold *= inflationFactor;
    parameters.general.ageAmount.maxAmount *= inflationFactor;
    parameters.general.ageAmount.netIncomeThreshold *= inflationFactor;
    parameters.general.pensionIncomeAmount.maxAmount *= inflationFactor;
    
    return Object.assign(Object.assign({}, parameters.general), { dividend: parameters.dividend, federal: parameters.federal, provincial: parameters[normalizedProvince] });
};

var calculateBracketTax = function (income, brackets, rates) {
    var tax = 0, prevLimit = 0;
    var taxByBracket = [];
    for (var i = 0; i < brackets.length; i++) {
        var limit = brackets[i];
        if (income > prevLimit) {
            var taxableInBracket = Math.min(income, limit) - prevLimit;
            if (taxableInBracket > 0) {
                var taxForBracket = taxableInBracket * rates[i];
                tax += taxForBracket;
                taxByBracket.push({ from: prevLimit, to: limit, rate: rates[i], amount: taxableInBracket, tax: taxForBracket });
            }
        }
        if (income <= limit)
            break;
        prevLimit = limit;
    }
    return { total: tax, breakdown: taxByBracket };
};

var calculateTaxQC = function (incomeBreakdown, age, taxParams) {
    var provRules = taxParams.provincial;
    var canadianDividend = incomeBreakdown.canadianDividend || 0;
    var grossUpAmount = canadianDividend * (taxParams.dividend.grossUp - 1);
    var rrspWithdrawal = incomeBreakdown.rrspWithdrawal || 0;
    var capitalGains = incomeBreakdown.capitalGains || 0;
    var otherIncome = incomeBreakdown.otherIncome || 0;
    var taxableIncome = otherIncome + rrspWithdrawal + canadianDividend + grossUpAmount + capitalGains;

    var provTaxResult = calculateBracketTax(taxableIncome, provRules.brackets, provRules.rates);
    var provBpaCredit = Math.min(taxableIncome, provRules.bpa) * provRules.rates[0];
    var provincialDTC = (canadianDividend + grossUpAmount) * taxParams.dividend.provincialCreditRates.QC;
    
    var provAgeAmountCredit = 0;
    if (age >= 65 && provRules.ageAmount) {
        provAgeAmountCredit = provRules.ageAmount.maxAmount * 0.14;
    }
    var totalProvCredits = provBpaCredit + provAgeAmountCredit + provincialDTC;
    var totalProvTax = Math.max(0, provTaxResult.total - totalProvCredits);

    return {
        taxBeforeCredits: provTaxResult.total,
        taxByBracket: provTaxResult.breakdown,
        surtax: 0,
        credits: {
            bpa: provBpaCredit,
            age: provAgeAmountCredit,
            pension: 0, 
            dividend: provincialDTC,
            total: totalProvCredits
        },
        finalTax: totalProvTax
    };
};


var calculateTax = function (incomeBreakdown, age, taxParams, province) {
    var _a;
    var federal = taxParams.federal, ageAmount = taxParams.ageAmount, dividend = taxParams.dividend, pensionIncomeAmount = taxParams.pensionIncomeAmount;
    var provRules = taxParams.provincial;

    var rrspWithdrawal = incomeBreakdown.rrspWithdrawal || 0;
    var canadianDividend = incomeBreakdown.canadianDividend || 0;
    var capitalGains = incomeBreakdown.capitalGains || 0;
    var otherIncome = incomeBreakdown.otherIncome || 0;
    var grossUpAmount = canadianDividend * (dividend.grossUp - 1);
    var taxableIncome = otherIncome + rrspWithdrawal + canadianDividend + grossUpAmount + capitalGains;
    var eligiblePensionIncome = (age >= 65) ? rrspWithdrawal : 0;
    
    var fedTaxResult = calculateBracketTax(taxableIncome, federal.brackets, federal.rates);
    var fedBpaCredit = Math.min(taxableIncome, federal.bpa) * federal.rates[0];
    
    var ageAmountBase = 0;
    if (age >= 65) {
        var excessIncome = Math.max(0, taxableIncome - ageAmount.netIncomeThreshold);
        ageAmountBase = Math.max(0, ageAmount.maxAmount - excessIncome * ageAmount.reductionRate);
    }
    var ageAmountCredit = ageAmountBase * 0.15;
    
    var fedPensionAmountBase = Math.min(eligiblePensionIncome, pensionIncomeAmount.maxAmount);
    var fedPensionCredit = fedPensionAmountBase * 0.15;
    var federalDTC = (canadianDividend + grossUpAmount) * dividend.federalCreditRate;
    
    var totalFedCredits = fedBpaCredit + ageAmountCredit + fedPensionCredit + federalDTC;
    var totalFedTax = Math.max(0, fedTaxResult.total - totalFedCredits);

    var federalResult = {
        taxableIncome: taxableIncome,
        taxBeforeCredits: fedTaxResult.total,
        taxByBracket: fedTaxResult.breakdown,
        credits: {
            bpa: fedBpaCredit,
            age: ageAmountCredit,
            pension: fedPensionCredit,
            dividend: federalDTC,
            total: totalFedCredits
        },
        finalTax: totalFedTax
    };
    
    var totalProvTax = 0;
    var provincialResult = {};
    var fedMTR = (_a = federal.rates[federal.brackets.findIndex(function (b) { return taxableIncome <= b; })]) !== null && _a !== void 0 ? _a : federal.rates[federal.rates.length - 1];
    var provMTR = 0;
    if (province && province.toUpperCase() === 'QC') {
        var quebecAbatement = fedTaxResult.total * 0.165;
        totalFedTax = Math.max(0, totalFedTax - quebecAbatement);
        federalResult.finalTax = totalFedTax; 
        federalResult.quebecAbatement = quebecAbatement;

        provincialResult = calculateTaxQC(incomeBreakdown, age, taxParams);
        totalProvTax = provincialResult.finalTax;
        provMTR = (_a = provRules.rates[provRules.brackets.findIndex(function (b) { return taxableIncome <= b; })]) !== null && _a !== void 0 ? _a : provRules.rates[provRules.rates.length - 1];

    } else {
        var provTaxResult = calculateBracketTax(taxableIncome, provRules.brackets, provRules.rates);
        var baseProvTax = provTaxResult.total;
        var surtax = 0;
        
        if (provRules.surtax || provRules.healthSurtax) {
            baseProvTax += surtax;
        }
        
        var provBpaCredit = Math.min(taxableIncome, provRules.bpa) * provRules.rates[0];
        var provAgeAmountCredit = 0;
        if (age >= 65 && provRules.ageAmount) {
            if (province.toUpperCase() === 'ON' || province.toUpperCase() === 'BC' || province.toUpperCase() === 'AB') {
                 const provAgeRules = provRules.ageAmount;
                 const excessIncome = Math.max(0, taxableIncome - provAgeRules.netIncomeThreshold);
                 const ageAmountBase = Math.max(0, provAgeRules.maxAmount - excessIncome * provAgeRules.reductionRate);
                 provAgeAmountCredit = ageAmountBase * provRules.rates[0];
            }
        }
        
        var provPensionAmountBase = Math.min(eligiblePensionIncome, pensionIncomeAmount.maxAmount);
        var provPensionCredit = provPensionAmountBase * provRules.rates[0];
        var currentProvCreditRate = dividend.provincialCreditRates[province.toUpperCase()] || 0;
        var provincialDTC = (canadianDividend + grossUpAmount) * currentProvCreditRate;
        
        var totalProvCredits = provBpaCredit + provAgeAmountCredit + provPensionCredit + provincialDTC;
        totalProvTax = Math.max(0, baseProvTax - totalProvCredits);

        provincialResult = {
            taxBeforeCredits: baseProvTax,
            taxByBracket: provTaxResult.breakdown,
            surtax: surtax,
            credits: {
                bpa: provBpaCredit,
                age: provAgeAmountCredit,
                pension: provPensionCredit,
                dividend: provincialDTC,
                total: totalProvCredits
            },
            finalTax: totalProvTax
        };

        provMTR = (_a = provRules.rates[provRules.brackets.findIndex(function (b) { return taxableIncome <= b; })]) !== null && _a !== void 0 ? _a : provRules.rates[provRules.rates.length - 1];
        if (provRules.surtax) {
            var provTaxForMTR = calculateBracketTax(taxableIncome, provRules.brackets, provRules.rates).total;
            if (province === 'ON') {
                if (provTaxForMTR > provRules.surtax.threshold2) provMTR *= (1 + provRules.surtax.rate1 + provRules.surtax.rate2);
                else if (provTaxForMTR > provRules.surtax.threshold1) provMTR *= (1 + provRules.surtax.rate1);
            } else if (province === 'PE') {
                if (provTaxForMTR > provRules.surtax.threshold1) provMTR *= (1 + provRules.surtax.rate1);
            }
        }
    }
    var totalTax = totalFedTax + totalProvTax;
    return {
        totalTax: totalTax,
        marginalRate: fedMTR + provMTR,
        breakdown: {
            federal: federalResult,
            provincial: provincialResult,
            taxableIncome: taxableIncome,
        }
    };
};

var calculateTaxWithClawback = function (params) {
    var incomeBreakdown = params.incomeBreakdown, netIncomeForClawback = params.netIncomeForClawback, oasIncome = params.oasIncome, age = params.age, taxParameters = params.taxParameters, province = params.province;
    var oasClawback = 0;
    if (oasIncome > 0 && netIncomeForClawback > taxParameters.oasClawbackThreshold) {
        oasClawback = Math.min(oasIncome, (netIncomeForClawback - taxParameters.oasClawbackThreshold) * 0.15);
    }
    
    var finalIncomeBreakdown = Object.assign(Object.assign({}, incomeBreakdown), { otherIncome: (incomeBreakdown.otherIncome || 0) + oasClawback });
    
    var taxResult = calculateTax(finalIncomeBreakdown, age, taxParameters, province);
    
    return {
        totalTax: taxResult.totalTax,
        oasClawback: oasClawback,
        marginalRate: taxResult.marginalRate,
        details: Object.assign(Object.assign({}, taxResult.breakdown), { oasClawback: oasClawback })
    };
};

// ★★★ [신설] 부부 합산 세금 최적화 (Pension Splitting) 함수 ★★★
var optimizeJointTax = function(params) {
    var clientIncome = params.clientIncome; // { base, rrif, capitalGains, canDividend, usDividend, oas }
    var spouseIncome = params.spouseIncome; // { base, rrif, capitalGains, canDividend, usDividend, oas }
    var age = params.age;
    var taxParameters = params.taxParameters;
    var province = params.province;
    
    // 1. 싱글이거나 배우자 소득 정보가 없는 경우
    if (!spouseIncome) {
        var incomeBreakdown = {
            otherIncome: (clientIncome.base || 0) + (clientIncome.usDividend || 0),
            rrspWithdrawal: clientIncome.rrif || 0,
            canadianDividend: clientIncome.canDividend || 0,
            capitalGains: clientIncome.capitalGains || 0
        };
        var netIncomeForClawback = (clientIncome.base || 0) + (clientIncome.rrif || 0) + (clientIncome.capitalGains || 0) + (clientIncome.canDividend || 0) * 1.38 + (clientIncome.usDividend || 0) + (clientIncome.oas || 0);
        
        return calculateTaxWithClawback({
            incomeBreakdown: incomeBreakdown,
            netIncomeForClawback: netIncomeForClawback,
            oasIncome: clientIncome.oas || 0,
            age: age,
            taxParameters: taxParameters,
            province: province
        });
    }

    // 2. 부부 최적화 케이스 (Pension Splitting Loop)
    var eligiblePension = clientIncome.rrif || 0; 
    var minTotalTax = Infinity;
    var bestResult = null;
    
    // 65세 미만이면 스플릿 불가 (0%만 실행)
    var splitRatios = (age < 65) ? [0.0] : [0.0, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50];

    for (var i = 0; i < splitRatios.length; i++) {
        var ratio = splitRatios[i];
        var splitAmount = eligiblePension * ratio;

        // [본인] 소득 재구성
        var clientBreakdown = {
            otherIncome: (clientIncome.base || 0) + (clientIncome.usDividend || 0),
            rrspWithdrawal: eligiblePension - splitAmount,
            canadianDividend: clientIncome.canDividend || 0,
            capitalGains: clientIncome.capitalGains || 0
        };
        var clientNetIncome = (clientBreakdown.otherIncome) + clientBreakdown.rrspWithdrawal + clientBreakdown.capitalGains + clientBreakdown.canadianDividend * 1.38 + (clientIncome.oas || 0);
        
        var clientTaxRes = calculateTaxWithClawback({
            incomeBreakdown: clientBreakdown,
            netIncomeForClawback: clientNetIncome,
            oasIncome: clientIncome.oas || 0,
            age: age,
            taxParameters: taxParameters,
            province: province
        });

        // [배우자] 소득 재구성
        var spouseBreakdown = {
            otherIncome: (spouseIncome.base || 0) + (spouseIncome.usDividend || 0),
            rrspWithdrawal: (spouseIncome.rrif || 0) + splitAmount, // 받은 연금은 RRIF처럼 과세
            canadianDividend: spouseIncome.canDividend || 0,
            capitalGains: spouseIncome.capitalGains || 0
        };
        var spouseNetIncome = (spouseBreakdown.otherIncome) + spouseBreakdown.rrspWithdrawal + spouseBreakdown.capitalGains + spouseBreakdown.canadianDividend * 1.38 + (spouseIncome.oas || 0);
        
        var spouseTaxRes = calculateTaxWithClawback({
            incomeBreakdown: spouseBreakdown,
            netIncomeForClawback: spouseNetIncome,
            oasIncome: spouseIncome.oas || 0,
            age: age, // 배우자 나이도 본인 나이로 가정 (간소화)
            taxParameters: taxParameters,
            province: province
        });

        var currentTotalTax = clientTaxRes.totalTax + spouseTaxRes.totalTax;

        if (currentTotalTax < minTotalTax) {
            minTotalTax = currentTotalTax;
            bestResult = {
                totalTax: clientTaxRes.totalTax, // 본인 세금 반환 (주의: 부부합산액 아님, 시뮬레이션 주체 기준)
                spouseTax: spouseTaxRes.totalTax,
                oasClawback: clientTaxRes.oasClawback,
                marginalRate: clientTaxRes.marginalRate,
                details: clientTaxRes.details,
                splitRatio: ratio,
                splitAmount: splitAmount
            };
        }
    }
    
    return bestResult;
};
