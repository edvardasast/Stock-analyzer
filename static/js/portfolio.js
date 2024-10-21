import { updatePortfolioChart } from './charts.js';
import { setCookie, getCookie, setActiveButton, formatDateToYYYYMMDD, formatLargeNumbers } from './utils.js';


const currentUrl = window.location.href;
const symbol = getCookie('stockSymbol');
let range = 'YTD'
//how to check if response is null
if (currentUrl.includes('/portfolio')) {
    document.getElementById('1MBtn').addEventListener('click', function () {
        setActiveButton('1M');
        updatePortfolioChart('1M', document.getElementById('1MBtn')); // Replace 'AAPL' with the desired symbol
    });

    document.getElementById('1YBtn').addEventListener('click', function () {
        setActiveButton('1Y');
        updatePortfolioChart('1Y', document.getElementById('1YBtn')); // Replace 'AAPL' with the desired symbol
    });

    document.getElementById('YTDBtn').addEventListener('click', function () {
        setActiveButton('YTD');
        updatePortfolioChart('YTD', document.getElementById('YTDBtn')); // Replace 'AAPL' with the desired symbol
    });

    document.getElementById('MAXBtn').addEventListener('click', function () {
        setActiveButton('MAX');
        updatePortfolioChart('MAX', document.getElementById('MAXBtn')); // Replace 'AAPL' with the desired symbol
    });
    loadPortfolio();
}
document.getElementById('upload_statement').addEventListener('click', function () {
    console
    document.getElementById('loading-container').style.display = 'flex';
    document.getElementById('portfolio_container').style.display = 'none';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = function (event) {
        const file = event.target.files[0];
        if (file) {
            const formData = new FormData();
            formData.append('file', file);

            fetch('/upload', {
                method: 'POST',
                body: formData
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        document.getElementById('loading-container').style.display = 'none';
                        document.getElementById('portfolio_container').style.display = 'block';
                        loadPortfolio(); // Refresh portfolio data
                    } else {
                        console.error('Error uploading file:', data.error);
                    }
                })
                .catch(error => console.error('Error uploading file:', error));
        }
    };
    input.click();
});

document.addEventListener('DOMContentLoaded', function () {
    const socket = io.connect('http://' + document.domain + ':' + location.port);

    socket.on('update', function (data) {
        const messageContainer = document.getElementById('message-container');
        let message = document.getElementById('update-message');

        if (!message) {
            // Create the element if it doesn't exist
            message = document.createElement('p');
            message.id = 'update-message';
            messageContainer.appendChild(message);
        }

        // Update the content of the element
        message.textContent = data.message;
    });
});
export function loadPortfolio() {
    document.getElementById('portfolio_container').style.display = 'none';
    document.getElementById('loading-container').style.display = 'flex';

    const portfolioContainer = document.getElementById('portfolio-container');
    portfolioContainer.innerHTML = '';  // Clear any existing content

    fetch('/api/portfolio')
        .then(response => response.json())
        .then(portfolioItems => {
            let total_invested = 0;
            let total_current = 0;
            let totalPortfolioValue = 0;
            let dividends = 0;
            const fetchPromises = [];

            Object.entries(portfolioItems).forEach(([ticker, data]) => {
                let investedAmount = 0;
                let stocksAmount = 0;

                if (Array.isArray(data)) {
                    data.forEach(event => {
                        const eventDate = new Date(event['Date']).toISOString().split('T')[0];
                        const amount = parseFloat(event['Total Amount'].replace('$', '').replace(',', ''));
                        const quantity = parseFloat(event['Quantity']);

                        switch (event['Type']) {
                            case 'BUY':
                            case 'BUY - LIMIT':
                            case 'BUY - MARKET':
                                investedAmount += amount;
                                stocksAmount += quantity;
                                break;
                            case 'SELL':
                            case 'SELL - MARKET':
                            case 'MERGER - CASH':
                            case 'SELL - LIMIT':
                            case 'SELL - STOP':
                                investedAmount -= amount;
                                stocksAmount -= quantity;
                                break;
                            case 'STOCK SPLIT':
                            case 'MERGER - STOCK':
                                stocksAmount += quantity;
                                break;
                            case 'DIVIDEND':
                                dividends += amount;
                                break;
                        }
                    });

                    total_invested += parseFloat(investedAmount);
                }

                if (stocksAmount > 0) {
                    const fetchPromise = fetch(`/api/ticker_info?symbol=${ticker}`)
                        .then(response => response.json())
                        .then(data => {
                            if (data.error) {
                                console.error(`Error from API: ${data.error}`);
                                return;
                            }

                            const ticker_name = data.info.longName;
                            const current_price = data.info.previousClose;
                            const currentValue = (stocksAmount * current_price).toFixed(2);
                            const growthLoss = ((currentValue - investedAmount) / investedAmount * 100).toFixed(2);
                            totalPortfolioValue += parseFloat(currentValue);

                            const companyWebsite = data.info.website;
                            const logoUrl = companyWebsite ? `${companyWebsite}/favicon.ico` : '/default-logo.png'; // Fallback logo

                            const currentValueClass = currentValue < investedAmount ? 'negative' : 'positive';
                            const growthLossClass = growthLoss < 0 ? 'negative' : 'positive';

                            return `
                                <div class="portfolio-item">
                                    <div class="portfolio-row">
                                        <div class="portfolio-column holding-column">
                                            <div class="company-logo company-logo-${ticker}">
                                                <img src="${logoUrl}" alt="${data.info.name} Logo" onerror="this.onerror=null;this.src='/default-logo.png';">
                                            </div>
                                            <div class="portfolio-name">
                                                <a id="ticker-link-${ticker}" data-ticker="${ticker}">
                                                    <h2>${ticker_name}</h2>
                                                </a>
                                                <p>${ticker}</p>
                                            </div>
                                        </div>
                                        <div class="portfolio-column">${investedAmount.toFixed(2)}</div>
                                        <div class="portfolio-column ${currentValueClass}">${currentValue}</div>
                                        <div class="portfolio-column ${growthLossClass}">${growthLoss}%</div>
                                        <div class="portfolio-column">${stocksAmount.toFixed(2)}</div>
                                        <div class="portfolio-column">${(investedAmount / stocksAmount).toFixed(2)}</div>
                                    </div>
                                </div>
                            `;
                        })
                        .catch(error => {
                            console.error('Error fetching ticker info:', error);
                        });

                    fetchPromises.push(fetchPromise);
                }
            });

            // Wait for all promises to resolve before updating the UI
            Promise.all(fetchPromises).then(portfolioItemsHTML => {
                portfolioItemsHTML.forEach(itemHTML => {
                    if (itemHTML) {
                        const portfolioItem = document.createElement('div');
                        portfolioItem.innerHTML = itemHTML;
                        portfolioContainer.appendChild(portfolioItem);
                    }
                });

                updateUIAfterLoad(totalPortfolioValue, total_invested, dividends);

                document.getElementById('loading-container').style.display = 'none';
                document.getElementById('portfolio_container').style.display = 'block';

                // Add event listeners for ticker links and time frame buttons
                addTickerLinkListeners();
            });
        })
        .catch(error => {
            console.error('Error fetching portfolio:', error);
            portfolioContainer.innerHTML = '<p>Failed to load portfolio. Please try again later.</p>';
        });
}

function updateUIAfterLoad(totalPortfolioValue, total_invested, dividends) {
    document.getElementById('total-portfolio-value').textContent = `$${totalPortfolioValue.toFixed(0)}`;
    document.getElementById('total-portfolio-invested').textContent = `$${total_invested.toFixed(0)}`;
    document.getElementById('portfolio-profit').textContent = `$${(totalPortfolioValue - total_invested).toFixed(0)}`;
    document.getElementById('portfolio-dividends').textContent = `$${dividends.toFixed(0)}`;
    const ytdButton = document.getElementById('YTDBtn');
    updatePortfolioChart("YTD", ytdButton);
}

function addTickerLinkListeners() {
    document.querySelectorAll('[id^=ticker-link-]').forEach(tickerLink => {
        tickerLink.addEventListener('click', function () {
            const ticker = this.getAttribute('data-ticker');
            setCookie('stockSymbol', ticker, 7);
            fetch(`/api/renew_data_cache?symbol=${ticker}`, { method: 'POST' })
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
        });
    });
}