import { updatePortfolioChart, updateChart } from './charts.js';
import { setCookie, getCookie } from './utils.js';
import { fetchStockData } from './stockData.js';
import { loadAIOpinion } from './ai.js';

// Function to set up all event handlers
/* export function setupEventHandlers() {
    setupAIButtonListener();
    setupTimeFrameButtons();
} */

// Event handler for AI button click
export function setupAIButtonListener() {
    const aiButton = document.getElementById('ask-ai-opinion-btn');
    if (aiButton) {
        console.log('AI button found');
        aiButton.addEventListener('click', function () {
            const stockSymbol = getCookie('stockSymbol');
            loadAIOpinion(stockSymbol,true);
        });
    }
}
// Event handler for time frame buttons (1M, 1Y, YTD, MAX)
export function setupTimeFrameButtons(data) {
        const currentUrl = window.location.href;
        console.log('Time frame buttons loaded');
        document.getElementById('1WBtn').addEventListener('click', function () {
            if (currentUrl.includes('/portfolio')) {
                updatePortfolioChart('1W', this);
            } else {
                console.log('1W button clicked');
                updateChart('1W', this, data);
            }
        });
        document.getElementById('1MBtn').addEventListener('click', function () {
            if (currentUrl.includes('/portfolio')) {
                updatePortfolioChart('1M', this);
            } else {
                updateChart('1M', this, data);
            }
        });
        document.getElementById('3MBtn').addEventListener('click', function () {
            if (currentUrl.includes('/portfolio')) {
                updatePortfolioChart('3M', this);
            } else {
                updateChart('3M', this, data);
            }
        });
        document.getElementById('6MBtn').addEventListener('click', function () {
            if (currentUrl.includes('/portfolio')) {
                updatePortfolioChart('6M', this);
            } else {
                updateChart('6M', this, data);
            }
        });
        document.getElementById('1YBtn').addEventListener('click', function () {
            console.log('1Y button clicked');
            if (currentUrl.includes('/portfolio')) {
                updatePortfolioChart('1Y', this);
            } else {
                updateChart('1Y', this,data);
            }
        });
        document.getElementById('ytdBtn').addEventListener('click', function () {
            console.log('YTD button clicked');
            if (currentUrl.includes('/portfolio')) {
                updatePortfolioChart('YTD', this);
            } else {
                updateChart('YTD', this, data);
            }
        });
        document.getElementById('maxBtn').addEventListener('click', function () {
            console.log('MAX button clicked');
            if (currentUrl.includes('/portfolio')) {
                updatePortfolioChart('MAX', this);
            } else {
                updateChart('MAX', this, data);
            }
        });
}

