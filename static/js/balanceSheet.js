import {createBalanceSheetChart} from './charts.js';
import {getActiveButton, setActiveButton, formatValue, formatToBillions} from './utils.js';
import { getCookie } from './utils.js';


const currentUrl = window.location.href;
const symbol = getCookie('stockSymbol');
//how to check if response is null
if (currentUrl.includes('/balance_sheet')) {
    loadBalanceSheet(symbol);
    document.getElementById('year').addEventListener('click', function () {
        setActiveButton('year');
        console.log('loadBalanceSheet')
        loadBalanceSheet(symbol); // Replace 'AAPL' with the desired symbol
    });
    
    document.getElementById('quarter').addEventListener('click', function () {
        setActiveButton('quarter');
        loadBalanceSheet(symbol); // Replace 'AAPL' with the desired symbol
    });
}



export function loadBalanceSheet(symbol) {
    console.log("Load Balance Sheet")
    const activeButtonId = getActiveButton();
    fetch(`/api/balance_sheet?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }
            let balanceSheetData;
            let timePeriods;

            if (activeButtonId === 'year') {
                console.log('Year button clicked');
                balanceSheetData = data.balance_sheet_yearly;
                timePeriods = Object.keys(balanceSheetData).sort();
            } else if (activeButtonId === 'quarter') {
                console.log('Quarter button clicked');
                balanceSheetData = data.balance_sheet_quarterly;
                timePeriods = Object.keys(balanceSheetData).sort().slice(-5); // Get the last 5 quarters
            }

            // Get the fields (row headers) from the first time period's data
            const fields = Object.keys(balanceSheetData[timePeriods[0]]);

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
                    const value = balanceSheetData[period][field] || 'N/A';
                    row += `<td>${formatValue(value)}</td>`;
                });
                row += '</tr>';
                tableBody += row;
            });
            const element = document.getElementById('balance-sheet-body');
            if (element) {
                // Safe to manipulate the element
                element.innerHTML = tableBody;
            } else {
                //console.error('Element with id "income-statement" not found.');
            }
            // Extract Revenue and Net Income data for the chart
            const assetsData = timePeriods.map(period => formatToBillions(balanceSheetData[period]['Total Assets'] || 0));
            const liabilitiesData = timePeriods.map(period => formatToBillions(balanceSheetData[period]['Total Liabilities Net Minority Interest'] || 0));
            const debtToAssetsData = timePeriods.map(period => {
                const assetsData = balanceSheetData[period]['Total Assets'] || 0;
                const liabilitiesData = balanceSheetData[period]['Total Liabilities Net Minority Interest'] || 0;
                return assetsData ? ((liabilitiesData / assetsData) * 100).toFixed(2) : 0; // Calculate profit margin as percentage
            });
            // Create the chart
            createBalanceSheetChart(timePeriods, assetsData, liabilitiesData, debtToAssetsData);
        })
        .catch(error => console.error('Error fetching balance sheet:', error));
}