import {createIncomeStatementChart} from './charts.js';
import {getActiveButton, setActiveButton, formatValue, formatToBillions} from './utils.js';
import { getCookie } from './utils.js';

const currentUrl = window.location.href;
const symbol = getCookie('stockSymbol');
//how to check if response is null
if (currentUrl.includes('/income_statement')) {
    console.log('income_statement')
    loadIncomeStatement(symbol);
    document.getElementById('year').addEventListener('click', function () {
        setActiveButton('year');
        loadIncomeStatement(symbol); // Replace 'AAPL' with the desired symbol
    });
    
    document.getElementById('quarter').addEventListener('click', function () {
        setActiveButton('quarter');
        loadIncomeStatement(symbol); // Replace 'AAPL' with the desired symbol
    });
}

// Function to fetch and display income statement data
export function loadIncomeStatement(symbol) {
    const activeButtonId = getActiveButton();
    console.log('Active Button ID:', activeButtonId); // For debugging

    fetch(`/api/income_statement?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            let incomeStatementData;
            let timePeriods;

            if (activeButtonId === 'year') {
                incomeStatementData = data.income_statement_yearly;
                timePeriods = Object.keys(incomeStatementData).sort();
            } else if (activeButtonId === 'quarter') {
                incomeStatementData = data.income_statement_quarterly;
                timePeriods = Object.keys(incomeStatementData).sort().slice(-5); // Get the last 5 quarters
            }

            // Get the fields (row headers) from the first time period's data
            const fields = Object.keys(incomeStatementData[timePeriods[0]]);

            // Build table headers (time periods)
            let tableHeader = '<tr><th>Field</th>';
            timePeriods.forEach(period => {
                tableHeader += `<th>${period}</th>`;
            });
            tableHeader += '</tr>';
            document.querySelector('thead tr').innerHTML = tableHeader;

            // Build table body (fields)
            let tableBody = '';
            fields.forEach(field => {
                let row = `<tr><td>${field}</td>`;
                timePeriods.forEach(period => {
                    const value = incomeStatementData[period][field] || 'N/A';
                    row += `<td>${formatValue(value)}</td>`;
                });
                row += '</tr>';
                tableBody += row;
            });
            const element = document.getElementById('income-statement-body');
            if (element) {
                // Safe to manipulate the element
                element.innerHTML = tableBody;
            } else {
                //console.error('Element with id "income-statement" not found.');
            }

            // Extract Revenue and Net Income data for the chart
            const revenueData = timePeriods.map(period => formatToBillions(incomeStatementData[period]['Total Revenue'] || 0));
            const netIncomeData = timePeriods.map(period => formatToBillions(incomeStatementData[period]['Net Income'] || 0));
            const profitMarginData = timePeriods.map(period => {
                const revenue = incomeStatementData[period]['Total Revenue'] || 0;
                const netIncome = incomeStatementData[period]['Net Income'] || 0;
                return revenue ? ((netIncome / revenue) * 100).toFixed(2) : 0; // Calculate profit margin as percentage
            });
            // Create the chart
            createIncomeStatementChart(timePeriods, revenueData, netIncomeData, profitMarginData);
        })
        .catch(error => console.error('Error fetching income statement:', error));
}