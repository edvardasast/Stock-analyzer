import { loadNews } from './news.js';
import { setCookie, getCookie, formatDateToYYYYMMDD } from './utils.js';
import { loadRecommendations } from './recommendations.js';
import { loadBalanceSheet } from './balanceSheet.js';
import { loadIncomeStatement } from './incomeStatement.js';
import { loadCashFlow } from './cashFlow.js';
import { loadEightPillars } from './eightPillars.js';
import { loadDividends } from './dividends.js';
import { loadAnalystEstimates } from './analystEstimates.js';
import { loadAnnualReports } from './annualReports.js';
import { loadPortfolio } from './portfolio.js';

document.addEventListener('DOMContentLoaded', function () {
    const currentUrl = window.location.href;
    const stockSymbol = getCookie('stockSymbol');  // Fetch from cookies
    console.log(stockSymbol)
    //fetchStockData(stockSymbol); // Fetch stock data
    if (document.getElementById('symbol-name')) {
        // Safe to manipulate the element
        document.getElementById('symbol-name').textContent = stockSymbol;
    } else {
        //console.error('Element with id "cash-flow" not found.');
    }
    if (document.getElementById('stock-symbol')) {
        // Safe to manipulate the element
        document.getElementById("load-metrics").addEventListener("click", function () {
            const stockSymbol = document.getElementById("stock-symbol").value.trim();

            if (stockSymbol) {
                // Save stock symbol to cookies for 7 days
                setCookie('stockSymbol', stockSymbol.toUpperCase(), 7);
                fetch(`/api/renew_data_cache?symbol=${stockSymbol}`, { method: 'POST' })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            console.log('Data cache renewed successfully');
                        } else {
                            console.error('Error renewing data cache:', data.error);
                        }
                    })
                    .catch(error => {
                        console.error('Error renewing data cache:', error);
                    });
                // Redirect to the Metrics page with the stock symbol
                window.location.href = `/stock_data`;
            } else {
                alert("Please enter a valid stock symbol.");
            }
        });
        document.getElementById('stock-symbol').value = stockSymbol;
    } else {
        //console.error('Element with id "cash-flow" not found.');
    }
});