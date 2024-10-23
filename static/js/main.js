import { loadPortfolio, loadDividends, loadNews, loadCashFlow, loadBalanceSheet, loadIncomeStatement, loadEightPillars } from './portfolio.js';
import { fetchStockData, loadRecommendations, loadAnalystEstimates } from './stockData.js';
import { updatePortfolioChart, updateChart, createIncomeStatementChart, createBalanceSheetChart, createCashFlowChart } from './charts.js';
import { setupEventHandlers } from './eventHandlers.js';
import { getCookie, setCookie } from './utils.js';

document.addEventListener('DOMContentLoaded', function () {
    const currentUrl = window.location.href;
    const stockSymbol = getCookie('stockSymbol');

    // Determine which functionality to execute based on the URL
    if (currentUrl.includes('/portfolio')) {
        loadPortfolio();
    } else if (currentUrl.includes('/stock_data')) {
        fetchStockData(stockSymbol);
        const ytdButton = document.getElementById('YTDBtn');
        updateChart('YTD', ytdButton, []);
        loadAnnualReports(stockSymbol);  // Additional feature to load annual reports
    } else if (currentUrl.includes('/dividends')) {
        loadDividends();
    } else if (currentUrl.includes('/news')) {
        loadNews();
    } else if (currentUrl.includes('/recommendations')) {
        loadRecommendations(stockSymbol);
    } else if (currentUrl.includes('/analyst_estimates')) {
        loadAnalystEstimates(stockSymbol);
    } else if (currentUrl.includes('/cash_flow')) {
        loadCashFlow(stockSymbol);
    } else if (currentUrl.includes('/balance_sheet')) {
        loadBalanceSheet(stockSymbol);
    } else if (currentUrl.includes('/income_statement')) {
        loadIncomeStatement(stockSymbol);
    } else if (currentUrl.includes('/8pillars')) {
        loadEightPillars(stockSymbol);
    } else if (currentUrl.includes('/ai')) {
        //loadAIOpinion(stockSymbol, 'False'); // Load AI Opinion section
    }

    // Setup general event handlers for button clicks and links
    setupEventHandlers();

    // Initialize additional elements for specific stock data page
    if (document.getElementById('symbol-name')) {
        document.getElementById('symbol-name').textContent = stockSymbol;
    }

    if (document.getElementById('stock-symbol')) {
        document.getElementById("load-metrics").addEventListener("click", function () {
            const stockSymbolInput = document.getElementById("stock-symbol").value.trim();
            if (stockSymbolInput) {
                setCookie('stockSymbol', stockSymbolInput.toUpperCase(), 7);
                fetch(`/api/renew_data_cache?symbol=${stockSymbolInput}`, { method: 'POST' })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            console.log('Data cache renewed successfully');
                        } else {
                            console.error('Error renewing data cache:', data.error);
                        }
                    })
                    .catch(error => console.error('Error renewing data cache:', error));
                window.location.href = `/stock_data`;
            } else {
                alert("Please enter a valid stock symbol.");
            }
        });
        document.getElementById('stock-symbol').value = stockSymbol;
    }
});
