import { updatePortfolioChart } from './charts.js';
import { setCookie, getCookie, setActiveButton, formatDateToYYYYMMDD, formatLargeNumbers } from './utils.js';


const currentUrl = window.location.href;
const symbol = getCookie('stockSymbol');
let range = 'YTD'
let sortOrder = 'desc'; // Default sorting order
let currentSortBy = 'invested';
let portfolioData = [];

//how to check if response is null
if (currentUrl.includes('/portfolio')) {
    // Add event listeners for sorting buttons
    document.getElementById('sort-invested').addEventListener('click', function () {
        toggleSortOrder('invested');
        sortAndRenderPortfolio('invested');
    });
    document.getElementById('sort-current-value').addEventListener('click', function () {
        toggleSortOrder('currentValue');
        sortAndRenderPortfolio('currentValue');
    });
    document.getElementById('sort-changes').addEventListener('click', function () {
        toggleSortOrder('changes');
        sortAndRenderPortfolio('changes');
    });
    document.getElementById('sort-shares').addEventListener('click', function () {
        toggleSortOrder('shares');
        sortAndRenderPortfolio('shares');
    });
    document.getElementById('sort-dividends').addEventListener('click', function () {
        toggleSortOrder('dividends');
        sortAndRenderPortfolio('dividends');
    });
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
    updateSortIcons();
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
}



function toggleSortOrder(sortBy) {
    if (currentSortBy === sortBy) {
        sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortBy = sortBy;
        sortOrder = 'desc'; // Default to descending when changing sort criteria
    }
    updateSortIcons();
}
function updateSortIcons() {
    console.log('updateSortIcons');
    const sortButtons = document.querySelectorAll('#sorting-buttons .portfolio-column');
    sortButtons.forEach(button => {
        const icon = button.querySelector('i');
        if (icon) { // Check if the icon element exists
            icon.className = 'fas fa-sort'; // Reset all icons to default

            if (button.id === `sort-${currentSortBy}`) {
                console.log('button.id found ', button.id);
                icon.className = sortOrder === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
            }
        }
    });
}
export function loadPortfolio(sortBy = 'invested') {
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
            let totalDividends = 0;
            const fetchPromises = [];
            portfolioData = [];


            Object.entries(portfolioItems).forEach(([ticker, data]) => {
                let investedAmount = 0;
                let stocksAmount = 0;
                let dividends = 0;
                const tickerEvents = [];
                if (Array.isArray(data)) {
                    data.forEach(event => {
                        const eventDate = new Date(event['Date']).toISOString().split('T')[0];
                        const amount = parseFloat(event['Total Amount'].replace('$', '').replace(',', ''));
                        const quantity = parseFloat(event['Quantity']);
                        // Create event object
                        const eventObject = {
                            date: eventDate,
                            type: event['Type'],
                            amount: amount,
                            quantity: quantity,
                            ticker: ticker // Assuming ticker is available in the scope
                        };
                        tickerEvents.push(eventObject);
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
                                totalDividends += amount;
                                dividends += amount;
                                break;
                        }
                    });

                    total_invested += parseFloat(investedAmount);
                }

                if (stocksAmount > 0.1) {
                    const fetchPromise = fetch(`/api/ticker_info?symbol=${ticker}`)
                        .then(response => response.json())
                        .then(data => {
                            if (data.error) {
                                console.error(`Error from API: ${data.error}`);
                                return;
                            }

                            const ticker_name = data.info.longName;
                            const current_price = data.info.previousClose;
                            const currentValue = (stocksAmount * current_price).toFixed(0);
                            const growthLoss = ((currentValue - investedAmount) / investedAmount * 100).toFixed(0);
                            totalPortfolioValue += parseFloat(currentValue);

                            const companyWebsite = data.info.website;
                            const logoUrl = companyWebsite ? `${companyWebsite}/favicon.ico` : '/default-logo.png'; // Fallback logo

                            const currentValueClass = currentValue < investedAmount ? 'negative' : 'positive';
                            const growthLossClass = growthLoss < 0 ? 'negative' : 'positive';

                            portfolioData.push({
                                tickerEvents,
                                ticker,
                                ticker_name,
                                investedAmount,
                                currentValue,
                                growthLoss,
                                stocksAmount,
                                dividends,
                                logoUrl,
                                currentValueClass,
                                growthLossClass
                            });
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
                                        <div class="portfolio-column">${investedAmount.toFixed(0)}</div>
                                        <div class="portfolio-column ${currentValueClass}">${currentValue}</div>
                                        <div class="portfolio-column ${growthLossClass}">${growthLoss}%</div>
                                        <div class="portfolio-column">${stocksAmount.toFixed(0)}</div>
                                         <div class="portfolio-column">${dividends.toFixed(0)}</div>
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
            Promise.all(fetchPromises).then(() => {
                sortAndRenderPortfolio(sortBy);
                updateUIAfterLoad(totalPortfolioValue, total_invested, totalDividends);

                document.getElementById('loading-container').style.display = 'none';
                document.getElementById('portfolio_container').style.display = 'block';

            });
        })
        .catch(error => {
            console.error('Error fetching portfolio:', error);
            portfolioContainer.innerHTML = '<p>Failed to load portfolio. Please try again later.</p>';
        });
}


function fetchEventsForTicker(ticker, container) {
    // Filter events for the specific ticker
    const events = portfolioData.filter(event => event.ticker === ticker);
    console.log('events', events);
    if (events.length > 0) {
        container.innerHTML = ''; // Clear any existing content
        const tableHeader = `
            <table class="event-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Quantity</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            </table>
        `;
        container.innerHTML += tableHeader;

        const tableBody = container.querySelector('.event-table tbody');
        events.forEach(event => {
            console.log('event', event);
            event.tickerEvents.forEach(event => {
                const eventHTML = `
                <tr>
                    <td>${event.date}</td>
                    <td>${event.type}</td>
                    <td>${event.amount}</td>
                    <td>${event.quantity}</td>
                </tr>
            `;
            tableBody.innerHTML += eventHTML;
            });
        });
    } else {
        container.innerHTML = '<p>No events found for this ticker.</p>';
    }
}

function sortAndRenderPortfolio(sortBy) {
    const portfolioContainer = document.getElementById('portfolio-container');
    portfolioContainer.innerHTML = '';  // Clear any existing content

    // Sort portfolio data based on the selected criteria
    portfolioData.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
            case 'invested':
                comparison = b.investedAmount - a.investedAmount;
                break;
            case 'currentValue':
                comparison = b.currentValue - a.currentValue;
                break;
            case 'changes':
                comparison = b.growthLoss - a.growthLoss;
                break;
            case 'shares':
                comparison = b.stocksAmount - a.stocksAmount;
                break;
            case 'dividends':
                comparison = b.dividends - a.dividends;
                break;
            default:
                comparison = 0;
        }
        return sortOrder === 'asc' ? -comparison : comparison;
    });

    // Generate HTML for sorted portfolio items
    portfolioData.forEach(item => {
        const portfolioItemHTML = `
            <div class="portfolio-item">
                <div class="portfolio-row">
                    <div class="portfolio-column holding-column">
                        <div class="company-logo company-logo-${item.ticker}">
                            <img src="${item.logoUrl}" alt="${item.ticker_name} Logo" onerror="this.onerror=null;this.src='/default-logo.png';">
                        </div>
                        <div class="portfolio-name">
                            <a id="ticker-link-${item.ticker}" data-ticker="${item.ticker}">
                                <h2>${item.ticker_name}</h2>
                            </a>
                            <p>${item.ticker}</p>
                        </div>
                    </div>
                    <div class="portfolio-column">${item.investedAmount.toFixed(0)}</div>
                    <div class="portfolio-column ${item.currentValueClass}">${item.currentValue}</div>
                    <div class="portfolio-column ${item.growthLossClass}">${item.growthLoss}%</div>
                    <div class="portfolio-column">${item.stocksAmount.toFixed(0)}</div>
                    <div class="portfolio-column">${item.dividends.toFixed(0)}</div>
                    <div class="portfolio-column">${(item.investedAmount / item.stocksAmount).toFixed(2)}</div>
                </div>
                <div class="portfolio-events" id="events-${item.ticker}" style="display: none;"></div>
            </div>
        `;

        const portfolioItem = document.createElement('div');
        portfolioItem.innerHTML = portfolioItemHTML;
        portfolioContainer.appendChild(portfolioItem);

        // Add event listener for expanding/collapsing events
        portfolioItem.querySelector('.portfolio-row').addEventListener('click', function () {
            const eventsContainer = document.getElementById(`events-${item.ticker}`);
            if (eventsContainer.style.display === 'none') {
                eventsContainer.style.display = 'block';
                fetchEventsForTicker(item.ticker, eventsContainer);
            } else {
                eventsContainer.style.display = 'none';
            }
        });
    });

    // Add event listeners for ticker links
    addTickerLinkListeners();
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