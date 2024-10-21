import {createCashFlowChart} from './charts.js';
import {getActiveButton, setActiveButton, formatValue, formatToBillions} from './utils.js';
import { getCookie } from './utils.js';

const currentUrl = window.location.href;
const symbol = getCookie('stockSymbol');
//how to check if response is null
if (currentUrl.includes('/cash_flow')) {
    loadCashFlow(symbol);
    document.getElementById('year').addEventListener('click', function () {
        setActiveButton('year');
        loadCashFlow(symbol); // Replace 'AAPL' with the desired symbol
    });
    
    document.getElementById('quarter').addEventListener('click', function () {
        setActiveButton('quarter');
        loadCashFlow(symbol); // Replace 'AAPL' with the desired symbol
    });
}
export // Function to fetch and display balance sheet data
function loadCashFlow(symbol) {
    const activeButtonId = getActiveButton();
    fetch(`/api/cash_flow?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }
            let cashFlowData;
            let timePeriods;

            if (activeButtonId === 'year') {
                cashFlowData = data.cash_flow_yearly;
                timePeriods = Object.keys(cashFlowData).sort();
            } else if (activeButtonId === 'quarter') {
                cashFlowData = data.cash_flow_quarterly;
                timePeriods = Object.keys(cashFlowData).sort().slice(-5); // Get the last 5 quarters
            }

            // Get the fields (row headers) from the first time period's data
            const fields = Object.keys(cashFlowData[timePeriods[0]]);

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
                    const value = cashFlowData[period][field] || 'N/A';
                    row += `<td>${formatValue(value)}</td>`;
                });
                row += '</tr>';
                tableBody += row;
            });
            const element = document.getElementById('cash-flow-body');
            if (element) {
                // Safe to manipulate the element
                element.innerHTML = tableBody;
            } else {
                //console.error('Element with id "income-statement" not found.');
            }
            // Extract Revenue and Net Income data for the chart
            const operatingData = timePeriods.map(period => formatToBillions(cashFlowData[period]['Operating Cash Flow'] || 0));
            const investingData = timePeriods.map(period => formatToBillions(cashFlowData[period]['Investing Cash Flow'] || 0));
            const financinggData = timePeriods.map(period => formatToBillions(cashFlowData[period]['Financing Cash Flow'] || 0));
            // Create the chart
            createCashFlowChart(timePeriods, operatingData, investingData, financinggData);
            // Update the table body
        })
        .catch(error => console.error('Error fetching cash flow:', error));
}