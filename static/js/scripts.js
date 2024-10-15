let chart;  // Declare chart globally
let symbol = ''
let range = 'YTD'
let upgradesDowngradesData = [];
let totalInvsted = 0;
function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000)); // Set expiration date
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/"; // Set cookie with expiration
}



function getCookie(name) {
    const decodedCookie = decodeURIComponent(document.cookie);
    const cookieArray = decodedCookie.split(';');
    for (let i = 0; i < cookieArray.length; i++) {
        let cookie = cookieArray[i].trim();
        if (cookie.indexOf(name + "=") === 0) {
            return cookie.substring(name.length + 1, cookie.length);
        }
    }
    return "";
}


let portfolioChart; // Declare a variable to store the chart instance

// Function to load the portfolio data
// Function to load the portfolio data
function loadPortfolio() {
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
            let companyWebsite = "";
            const fetchPromises = [];

            Object.entries(portfolioItems).forEach(([ticker, data]) => {
                let investedAmount = 0;
                let stocksAmount = 0;

                if (Array.isArray(data)) {
                    data.forEach(event => {
                        const eventDate = new Date(event['Date']).toISOString().split('T')[0];
                        if (event['Type'] === 'BUY' || event['Type'] === 'BUY - MARKET') {
                            investedAmount += parseFloat(event['Total Amount'].replace('$', '').replace(',', ''));
                            stocksAmount += parseFloat(event['Quantity']);
                        } else if (event['Type'] === 'STOCK SPLIT') {
                            stocksAmount += parseFloat(event['Quantity']);
                        } else if (event['Type'] === 'SELL' || event['Type'] === 'SELL - MARKET' || event['Type'] === 'MERGER - CASH' || event['Type'] === 'SELL - LIMIT') {
                            investedAmount -= parseFloat(event['Total Amount'].replace('$', '').replace(',', ''));
                            stocksAmount -= parseFloat(event['Quantity']);
                        } else if (event['Type'] === 'MERGER - STOCK') {
                            stocksAmount += parseFloat(event['Quantity']);
                        } else if (event['Type'] === 'DIVIDEND') {
                            dividends += parseFloat(event['Total Amount'].replace('$', '').replace(',', ''));
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

                            companyWebsite = data.info.website;
                            const currentValueClass = currentValue < investedAmount ? 'negative' : 'positive';
                            const growthLossClass = growthLoss < 0 ? 'negative' : 'positive';
                            let logoUrlStart = `${companyWebsite}/favicon.ico`;
                            
                            const portfolioContent = `
                                <div class="portfolio-item">
                                    <div class="portfolio-row">
                                        <div class="portfolio-column holding-column">
                                            <div class="company-logo company-logo-${ticker}">
                                                <img src="${logoUrlStart}" alt="${data.info.name} Logo">
                                            </div>
                                            <div class="portfolio-name">
                                                <h2>${ticker_name}</h2>
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
                            return portfolioContent;
                        });

                    fetchPromises.push(fetchPromise);
                }
            });

            // Wait for all promises to resolve before updating the UI
            Promise.all(fetchPromises).then(portfolioItemsHTML => {
                portfolioItemsHTML.forEach(itemHTML => {
                    const portfolioItem = document.createElement('div');
                    portfolioItem.innerHTML = itemHTML;
                    portfolioContainer.appendChild(portfolioItem);
                });
                const ytdButton = document.getElementById('YTDBtn');
                updatePortfolioChart("YTD", ytdButton);

                // Update total portfolio values
                document.getElementById('total-portfolio-value').textContent = `$${totalPortfolioValue.toFixed(2)}`;
                document.getElementById('total-portfolio-invested').textContent = `$${total_invested.toFixed(2)}`;
                const portfolioProfit = totalPortfolioValue - total_invested;
                document.getElementById('portfolio-profit').textContent = `$${portfolioProfit.toFixed(2)}`;
                document.getElementById('portfolio-dividends').textContent = `$${dividends.toFixed(2)}`;


                // Add event listeners for time frame buttons
                document.getElementById('1MBtn').addEventListener('click', function () {
                    updatePortfolioChart('1M', this);
                });
                document.getElementById('1YBtn').addEventListener('click', function () {
                    updatePortfolioChart('1Y', this);
                });
                document.getElementById('YTDBtn').addEventListener('click', function () {
                    updatePortfolioChart('YTD', this);
                });
                document.getElementById('MAXBtn').addEventListener('click', function () {
                    updatePortfolioChart('MAX', this);
                });
                document.getElementById('loading-container').style.display = 'none';
                document.getElementById('portfolio_container').style.display = 'block';
            });
        })
        .catch(error => {
            console.error('Error fetching portfolio:', error);
            portfolioContainer.innerHTML = '<p>Failed to load portfolio. Please try again later.</p>';
        });
}
function formatDateToYYYYMMDD(date) {
    let year = date.getFullYear();
    let month = ('0' + (date.getMonth() + 1)).slice(-2); // Months are zero-based
    let day = ('0' + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
}
function updatePortfolioChart(timeFrame, button) {
    const now = new Date();
    let historyStartDate;  // Declare startDate without initializing
    // Calculate startDate based on selected timeFrame
    if (timeFrame === '1M') {
        historyStartDate = new Date(now.setMonth(now.getMonth() - 1));  // Last 1 month
    } else if (timeFrame === '1Y') {
        historyStartDate = new Date(now.setFullYear(now.getFullYear() - 1));  // Last 1 year
    } else if (timeFrame === 'YTD') {
        historyStartDate = new Date(now.getFullYear(), 0, 1);  // Year to Date
    } else {
        historyStartDate = new Date(0);  // MAX, include all data
    }
    // Function to update the selected button
    if (button) {
        // Remove 'active' class from all buttons
        const buttons = document.querySelectorAll('#timeRangeButtons .btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        //console.log("Button")
        // Add 'active' class to the clicked button
        button.classList.add('active');
    }
    const ctx = document.getElementById('portfolioChart').getContext('2d');
    //console.log("Update Portfolio Chart");

    // Destroy previous chart if it exists
    if (portfolioChart) {
        portfolioChart.destroy();
    }

    const dates = [];
    const values = [];
    const dataset = [];

    // Format the date to YYYY-MM-DD before sending
    let formattedDate = formatDateToYYYYMMDD(historyStartDate);
    fetch(`/api/portfolio_events?date=${formattedDate}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error(`Error from API: ${data.error}`);
                return;
            }
            //console.log(data);
            const endDate = new Date(); // Current date
            let totalInvested = 0;
            if (data.holdings && data.holdings.length > 0) {
                data.holdings.forEach(event => {
                    try {
                        const eventDate = new Date(event['date']);
                        if (event['type'] === 'BUY' || event['type'] === 'BUY - MARKET') {
                            totalInvested += parseFloat(event['total_amount']);
                            if (!isNaN(eventDate) && eventDate >= historyStartDate) {
                                dates.push(eventDate.toISOString().split('T')[0]);
                                values.push(totalInvested);
                            }
                        } else if (event['type'] === 'SELL' || event['type'] === 'SELL - MARKET' || event['type'] === 'MERGER - CASH') {
                            totalInvested -= parseFloat(event['total_amount']);
                            if (!isNaN(eventDate) && eventDate >= historyStartDate) {
                                dates.push(eventDate.toISOString().split('T')[0]);
                                values.push(totalInvested);
                            }
                        }
                    } catch (error) {
                        console.error(`Error parsing date: ${event['date']}`, error);
                    }
                });
                const historyDates = data.history.map(entry => entry.date);
                const historyValues = data.history.map(entry => entry.totalValue);
                const historyInvested = data.history.map(entry => entry.totalInvested);

                // Only update the chart after processing all the data
                if (dates.length > 0 && values.length > 0) {
                    portfolioChart = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: historyDates,
                            datasets: [{
                                label: 'Invested',
                                data: historyInvested,
                                borderColor: 'rgba(75, 192, 192, 1)',
                                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                                fill: false,
                                tension: 0,
                                pointRadius: 0,  // Set point radius to 0 to hide points
                                pointHoverRadius: 0,  // Ensure points don’t appear on hover
                            },
                            {
                                label: 'Current Value', // Label for the new dataset
                                data: historyValues, // Data for the new dataset
                                borderColor: 'rgba(21, 88, 38, 1)', // Styling for the new dataset
                                backgroundColor: 'rgba(21, 88, 38, 0.2)',
                                fill: true,
                                tension: 0.1,
                                pointRadius: 0,  // Set point radius to 0 to hide points
                                pointHoverRadius: 0,  // Ensure points don’t appear on hover
                            }]
                        },
                        options: {
                            scales: {
                                x: {
                                    type: 'time',
                                    time: {
                                        unit: 'month'
                                    },
                                    title: {
                                        display: true,
                                        text: 'Date'
                                    }
                                },
                                y: {
                                    title: {
                                        display: true,
                                        text: 'Value'
                                    },
                                    beginAtZero: false
                                }
                            }
                        }
                    });
                } else {
                    console.error('No valid data to display in chart');
                }
            } else {
                console.error('No portfolio data received from API');
            }
        })
        .catch(error => {
            console.error('Error fetching portfolio events:', error);
        });
}





function fetchStockData(symbol) {

    fetch(`/api/stock_data?symbol=${symbol}&range=${range}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }
            const element = document.getElementById('market-cap');
            if (element) {
                // Safe to manipulate the element
                // Left Column Data
                document.getElementById("market-cap").textContent = `$${data.market_cap}T`;
                document.getElementById("revenue").textContent = `$${data.revenue}B`;
                document.getElementById("net-income").textContent = `$${data.net_income}B`;
                document.getElementById("4yr_avg_net_income").textContent = `$${data.four_year_avg_net_income}B`;
                document.getElementById("pe").textContent = data.pe_ratio;
                document.getElementById("ps-ratio").textContent = data.ps_ratio;
                document.getElementById("profit-margin").textContent = `${data.profit_margin}%`;
                document.getElementById("4yr-profit-margin").textContent = `${data.four_year_profit_margin}%`;
                document.getElementById("gross-profit-margin").textContent = `${data.gross_profit_margin}%`;
                document.getElementById("3yr-revenue-growth").textContent = `${data.three_year_revenue_growth}%`;

                // Middle Column Data
                document.getElementById("fcf").textContent = `$${data.free_cash_flow}B`;
                document.getElementById("4yr-fcf").textContent = `$${data.four_year_avg_fcf}B`;
                document.getElementById("price-to-fcf").textContent = data.price_to_fcf;
                document.getElementById("dividend-yield").textContent = `${data.dividend_yield}%`;
                document.getElementById("dividends-paid").textContent = `$${data.dividends_paid}B`;
                document.getElementById("5yr-avg-dividend-yield").textContent = `${data.five_year_average_dividend_yield}%`;
                document.getElementById("ev-earnings").textContent = data.ev_to_earnings;
                document.getElementById("roa").textContent = data.roa ? `${data.roa}%` : 'N/A';
                document.getElementById("roe").textContent = data.roe ? `${data.roe}%` : 'N/A';

                //Company Name and Description
                document.getElementById("company_description").textContent = data.company_description;
                document.getElementById("company_name").textContent = data.company_name;


                // Set company information
                document.getElementById("c-name").textContent = data.company_name;
                document.getElementById('currency-info').textContent = `Currency in ${data.currency}`;
                document.getElementById('current-price').textContent = `$${data.current_price}`;
                document.getElementById('price-change').textContent = `${data.price_change_percentage > 0 ? '\u2191' : '\u2193'} $${data.price_change} (${data.price_change_percentage}%)`;
                document.getElementById('price-change').className = `change ${data.price_change_percentage > 0 ? 'positive' : 'negative'}`;
                document.getElementById('industry').textContent = data.industry;
                document.getElementById('sector').textContent = data.sector;


                // Set company logo using favicon
                const companyWebsite = data.website;
                console.log(companyWebsite)
                if (companyWebsite) {
                    const logoUrl = `${companyWebsite}/favicon.ico`;
                    document.getElementById('company-logo').src = logoUrl;
                }

            } else {
                //console.error('Element with id "metrics elements not found" not found.');
            }
        })
        .catch(error => console.error("Error fetching data:", error));
}

// Function to fetch and display stock recommendations
function loadRecommendations(symbol) {
    fetch(`/api/recommendations?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error(`Error from API: ${data.error}`);
                document.getElementById('recommendations').innerHTML = `<p>Error: ${data.error}</p>`;
                return;
            }
            //Update chart
            upgradesDowngradesData = data.upgrades_downgrades;
            const ytdButton = document.getElementById('ytdBtn');
            updateChart(range, ytdButton, upgradesDowngradesData);
            document.getElementById('symbol-name').textContent = symbol;

            // Display Recommendations Summary
            const recommendationsSummary = data.recommendations_summary;
            console.log(recommendationsSummary)
            if (recommendationsSummary && recommendationsSummary.length > 0) {
                let summaryHtml = '<table><thead><tr><th>Period</th><th>Strong Buy</th><th>Buy</th><th>Hold</th><th>Sell</th><th>Strong Sell</th></tr></thead><tbody>';
                recommendationsSummary.forEach(summary => {
                    summaryHtml += `
                        <tr>
                            <td>${summary.period}</td>
                            <td>${summary.strongBuy}</td>
                            <td>${summary.buy}</td>
                            <td>${summary.hold}</td>
                            <td>${summary.sell}</td>
                            <td>${summary.strongSell}</td>
                        </tr>`;
                });
                summaryHtml += '</tbody></table>';
                document.getElementById('recommendations-summary').innerHTML = summaryHtml;
            } else {
                document.getElementById('recommendations-summary').innerHTML = '<p>No recommendations summary available.</p>';
            }

            // Display Recommendations
            const recommendations = data.recommendations;
            if (recommendations && recommendations.length > 0) {
                let recommendationsHtml = '<table><thead><tr><th>Period</th><th>Strong Buy</th><th>Buy</th><th>Hold</th><th>Sell</th><th>Strong Sell</th></tr></thead><tbody>';
                recommendations.forEach(recommendation => {
                    recommendationsHtml += `
                        <tr>
                            <td>${recommendation.period}</td>
                            <td>${recommendation.strongBuy}</td>
                            <td>${recommendation.buy}</td>
                            <td>${recommendation.hold}</td>
                            <td>${recommendation.sell}</td>
                            <td>${recommendation.strongSell}</td>
                        </tr>`;
                });
                recommendationsHtml += '</tbody></table>';
                document.getElementById('recommendations').innerHTML = recommendationsHtml;
            } else {
                document.getElementById('recommendations').innerHTML = '<p>No recommendations available.</p>';
            }

            // Display Upgrades/Downgrades
            const upgradesDowngrades = data.upgrades_downgrades;
            if (upgradesDowngrades && upgradesDowngrades.length > 0) {
                let upgradesHtml = '<table><thead><tr><th>Date</th><th>Firm</th><th>From Grade</th><th>To Grade</th><th>Action</th></tr></thead><tbody>';
                upgradesDowngrades.forEach(upgrade => {
                    upgradesHtml += `
                        <tr>
                            <td>${new Date(upgrade.GradeDate).toLocaleDateString()}</td>
                            <td>${upgrade.Firm}</td>
                            <td>${upgrade.FromGrade}</td>
                            <td>${upgrade.ToGrade}</td>
                            <td>${upgrade.Action}</td>
                        </tr>`;
                });
                upgradesHtml += '</tbody></table>';
                document.getElementById('upgrades-downgrades').innerHTML = upgradesHtml;
            } else {
                document.getElementById('upgrades-downgrades').innerHTML = '<p>No upgrades/downgrades available.</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching recommendations:', error);
            document.getElementById('recommendations').innerHTML = `<p>Error: ${error.message}</p>`;
        });
}

function updateChart(range, button, upgradesDowngradesData) {
    console.log("Update Chart")
    const stockSymbol = getCookie('stockSymbol');
    if (button) {
        // Remove 'active' class from all buttons
        const buttons = document.querySelectorAll('#timeRangeButtons .btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        console.log("Button")
        // Add 'active' class to the clicked button
        button.classList.add('active');
    }

    // Fetch stock data for the selected range
    fetch(`/api/stock_data?symbol=${stockSymbol}&range=${range}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            // If chart exists, destroy it before creating a new one
            if (chart) {
                chart.destroy();  // Properly destroy the chart instance
                chart = null;  // Reset chart variable
            }

            // Re-create the canvas context
            const canvas = document.getElementById('priceChart');
            const ctx = canvas.getContext('2d');

            // Create a new chart with updated data
            chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data["price_chart"].dates,
                    datasets: [{
                        label: `${stockSymbol} Stock Price`,
                        data: data["price_chart"].prices,
                        backgroundColor: 'rgba(21, 88, 38, 1)',  // Fill color under the line
                        pointRadius: 0,  // Set point radius to 0 to hide points
                        bortedcolor: 'rgba(21, 150, 38, 1)',
                        borderWidth: 5,
                        pointHoverRadius: 0,  // Ensure points don’t appear on hover
                        fill: true,  // Enable filling under the line
                    }]
                },
                options: {
                    responsive: true,
                    hover: {
                        mode: 'nearest',  // Shows the nearest point’s tooltip
                        intersect: false  // Allows hovering anywhere on the chart
                    },
                    plugins: {
                        tooltip: {
                            mode: 'nearest',
                            intersect: false
                        },
                        annotation: {
                            annotations: (upgradesDowngradesData && upgradesDowngradesData.length > 0)
                                ? upgradesDowngradesData.map((event, index) => {
                                    const xValue = event.GradeDate;
                                    const yValue = findPriceForDate(event.GradeDate, data["price_chart"]);

                                    // Log the x and y values to the console for debugging
                                    console.log(`Point Annotation ${index}: xValue = ${xValue}, yValue = ${yValue}`);

                                    // Define colors based on the event action
                                    let pointColor, borderColor, labelBackgroundColor;
                                    switch (event.Action.toLowerCase()) {
                                        case 'up':
                                            pointColor = 'rgba(0, 128, 0, 1)'; // Green for upgrades
                                            borderColor = 'rgba(0, 128, 0, 1)';
                                            labelBackgroundColor = 'rgba(0, 128, 0, 0.8)';
                                            break;
                                        case 'strong-buy':
                                            pointColor = 'rgba(0, 128, 0, 1)'; // Green for upgrades
                                            borderColor = 'rgba(0, 128, 0, 1)';
                                            labelBackgroundColor = 'rgba(0, 128, 0, 0.8)';
                                            break;
                                        case 'down':
                                            pointColor = 'rgba(255, 0, 0, 1)'; // Red for downgrades
                                            borderColor = 'rgba(255, 0, 0, 1)';
                                            labelBackgroundColor = 'rgba(255, 0, 0, 0.8)';
                                            break;
                                        case 'sell':
                                            pointColor = 'rgba(255, 0, 0, 1)'; // Red for downgrades
                                            borderColor = 'rgba(255, 0, 0, 1)';
                                            labelBackgroundColor = 'rgba(255, 0, 0, 0.8)';
                                            break;
                                        case 'main':
                                            pointColor = 'rgba(255, 165, 0, 1)'; // Orange for maintaining the rating
                                            borderColor = 'rgba(255, 165, 0, 1)';
                                            labelBackgroundColor = 'rgba(255, 165, 0, 0.8)';
                                            break;
                                        case 'reit':
                                            pointColor = 'rgba(255, 165, 0, 1)'; // Orange for maintaining the rating
                                            borderColor = 'rgba(255, 165, 0, 1)';
                                            labelBackgroundColor = 'rgba(255, 165, 0, 0.8)';
                                            break;
                                        default:
                                            pointColor = 'rgba(128, 128, 128, 1)'; // Gray for unknown actions
                                            borderColor = 'rgba(128, 128, 128, 1)';
                                            labelBackgroundColor = 'rgba(128, 128, 128, 0.8)';
                                            break;
                                    }

                                    return {
                                        type: 'point',
                                        xValue: xValue,
                                        yValue: yValue,
                                        backgroundColor: pointColor, // Use the dynamic color for the point marker
                                        radius: 5, // Size of the point
                                        borderColor: borderColor,
                                        borderWidth: 2,
                                        label: {
                                            content: `${event.Firm}: ${event.ToGrade} from ${event.FromGrade}`,
                                            enabled: true,
                                            position: 'top',
                                            backgroundColor: labelBackgroundColor, // Use the dynamic color for the label
                                            font: {
                                                size: 10,
                                            },
                                        }
                                    };
                                })
                                : [] // Fallback to an empty array if recommendations.upgrades_downgrades is null or empty
                        }
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'day'
                            },
                            ticks: {
                                color: '#fff'  // Ensure labels are visible on a dark background
                            },
                            grid: {
                                display: false  // Removes grid from y-axis
                            },
                        },
                        y: {
                            beginAtZero: false,
                            ticks: {
                                color: '#fff'  // Ensure labels are visible on a dark background
                            },
                            grid: {
                                display: false  // Removes grid from y-axis
                            },
                        }
                    }
                }
            });
        })
        .catch(error => console.error("Error fetching data:", error));
}
function findPriceForDate(date, priceChart) {
    const index = priceChart.dates.indexOf(date);
    return index !== -1 ? priceChart.prices[index] : null;
}

// Function to get the active button in the button group
function getActiveButton() {
    const activeButton = document.querySelector('#timeRangeButtons .btn.active');
    return activeButton ? activeButton.id : null;
}
// Helper function to format values in billions of dollars
function formatToBillions(value) {
    return (value / 1e9).toFixed(2); // Convert to billions and format to 2 decimal places
}
// Function to fetch and display income statement data
function loadIncomeStatement(symbol) {
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

// Function to set the active button
function setActiveButton(buttonId) {
    const buttons = document.querySelectorAll('#timeRangeButtons .btn');
    buttons.forEach(button => {
        if (button.id === buttonId) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}
function createIncomeStatementChart(labels, revenueData, netIncomeData, profitMarginData) {
    const ctx = document.getElementById('financialChart');
    if (!ctx) {
        console.error('Canvas element with id "financialChart" not found.');
        return;
    }
    // Destroy the existing chart instance if it exists
    if (chart) {
        chart.destroy();
    }
    chart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Revenue',
                    data: revenueData,
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderRadius: 5,
                    borderWidth: 1,
                },
                {
                    label: 'Net Income',
                    data: netIncomeData,
                    backgroundColor: 'rgba(153, 102, 255, 0.5)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderRadius: 5,
                    borderWidth: 1,
                },
                {
                    label: 'Profit Margin (%)',
                    data: profitMarginData,
                    type: 'line', // Use a line chart for profit margin
                    backgroundColor: 'rgba(255, 159, 64, 0.2)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 2,
                    yAxisID: 'y1', // Use a second y-axis for profit margin
                },
            ],
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    beginAtZero: true,
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return `$${value}B`; // Append '$' and 'B' for billions
                        }
                    }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right', // Position the y1 axis on the right
                    ticks: {
                        callback: function(value) {
                            return `${value}%`; // Append '%' for profit margin
                        }
                    }
                }
            },
        },
    });
}

function formatValue(value) {
    // Helper function to format large numbers like billions and millions
    if (typeof value === 'number') {
        if (Math.abs(value) >= 1e9) {
            return `$${(value / 1e9).toFixed(2)}B`;  // Convert to billions
        } else if (Math.abs(value) >= 1e6) {
            return `$${(value / 1e6).toFixed(2)}M`;  // Convert to millions
        } else {
            return `$${value.toFixed(2)}`;
        }
    }
    return value;  // Return non-number values as is
}



// Function to fetch and display balance sheet data
function loadBalanceSheet(symbol) {
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
                balanceSheetData = data.balance_sheet_yearly;
                timePeriods = Object.keys(balanceSheetData).sort();
            } else if (activeButtonId === 'quarter') {
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
function createBalanceSheetChart(labels, assetsData, liabilitiesData, debtToAssetsData) {
    const ctx = document.getElementById('financialChart');
    if (!ctx) {
        console.error('Canvas element with id "financialChart" not found.');
        return;
    }
    // Destroy the existing chart instance if it exists
    if (chart) {
        chart.destroy();
    }
    chart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Assets',
                    data: assetsData,
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderRadius: 5,
                    borderWidth: 1,
                },
                {
                    label: 'Liabilities',
                    data: liabilitiesData,
                    backgroundColor: 'rgba(153, 102, 255, 0.5)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderRadius: 5,
                    borderWidth: 1,
                },
                {
                    label: 'Debt to Assets (%)',
                    data: debtToAssetsData,
                    type: 'line', // Use a line chart for profit margin
                    backgroundColor: 'rgba(255, 159, 64, 0.2)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 2,
                    yAxisID: 'y1', // Use a second y-axis for profit margin
                },
            ],
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    beginAtZero: true,
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return `$${value}B`; // Append '$' and 'B' for billions
                        }
                    }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right', // Position the y1 axis on the right
                    ticks: {
                        callback: function(value) {
                            return `${value}%`; // Append '%' for profit margin
                        }
                    }
                }
            },
        },
    });
}


// Function to fetch and display balance sheet data
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
function createCashFlowChart(labels, operatingData, investingData, financinggData) {
    console.log(labels)
    const ctx = document.getElementById('financialChart');
    if (!ctx) {
        console.error('Canvas element with id "financialChart" not found.');
        return;
    }
    // Destroy the existing chart instance if it exists
    if (chart) {
        chart.destroy();
    }
    chart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Operating',
                    data: operatingData,
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderRadius: 5,
                    borderWidth: 1,
                },
                {
                    label: 'Investing',
                    data: investingData,
                    backgroundColor: 'rgba(153, 102, 255, 0.5)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderRadius: 5,
                    borderWidth: 1,
                },
                {
                    label: 'Financing',
                    data: financinggData,
                    backgroundColor: 'rgba(255, 159, 64, 0.5)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderRadius: 5,
                    borderWidth: 2,
                },
            ],
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    beginAtZero: true,
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return `$${value}B`; // Append '$' and 'B' for billions
                        }
                    }
                }
            },
        },
    });
}
// Function to fetch and display 8 Pillars data
function loadEightPillars(symbol) {
    fetch(`/api/8pillars?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error(`Error from API: ${data.error}`);
                document.getElementById('pillars-data').innerHTML = `<p>Error: ${data.error}</p>`;
            } else {
                displayPillarsData(data.eight_pillars);
            }
        })
        .catch(error => {
            console.error('Error fetching 8 Pillars data:', error);
            document.getElementById('pillars-data').innerHTML = `<p>Error: ${error.message}</p>`;
        });
}

// Function to display 8 Pillars data
function displayPillarsData(pillarsData) {
    const criteria = {
        "PE Ratio < 22.5": value => value < 22.5,
        "ROIC > 10": value => value > 10,
        "Revenue Growth": value => value > 0,
        "Net Income Growth": value => value > 0,
        "Shares Outstanding Change": value => value <= 0,  // Assuming stable or decreasing
        "LTL / 4 Yr FCF < 5": value => value < 5,  // Assuming manageable debt
        "Free Cash Flow Growth": value => value > 0,
        "Price to Free Cash Flow": value => value < 22.5  // Assuming reasonable P/FCF
    };
    const units = {
        "PE Ratio < 22.5": "",
        "ROIC > 10": "%",
        "Revenue Growth": "%",
        "Net Income Growth": "%",
        "Shares Outstanding Change": "%",
        "LTL / 4 Yr FCF < 5": "",
        "Free Cash Flow Growth": "%",
        "Price to Free Cash Flow": ""
    };

    let html = '<div class="pillar">';
    for (const [metric, value] of Object.entries(pillarsData)) {
        if (criteria[metric]) {
            const isMet = criteria[metric](value);
            const statusIcon = isMet ? 'class="metric-good"' : 'class="metric-bad"';
            const unit = units[metric] || "";
            html += `<div ${statusIcon}><div class="title"><span>${metric}</span></div><div class="value"><span>${value}${unit}</span></div></div>`;
        } else {
            console.error(`No criteria function found for metric: ${metric}`);
        }
    }
    html += '</div></div>';
    document.getElementById('pillars-data').innerHTML = html;
}
// Function to fetch and display analyst estimates
function loadAnalystEstimates(symbol) {
    fetch(`/api/analyst_estimates?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error(`Error from API: ${data.error}`);
                document.getElementById('analyst-estimates').innerHTML = `<p>Error: ${data.error}</p>`;
                return;
            }

            document.getElementById('symbol-name').textContent = symbol;

            // Display Price Targets
            const priceTargets = data.analyst_price_targets;
            if (priceTargets) {
                let priceTargetHtml = `
                    <div class="price-targets">
                    <p>Low: $${priceTargets.low}</p>
                    <p>High: $${priceTargets.high}</p>
                    <p>Median: $${priceTargets.median}</p>
                    <p>Mean: $${priceTargets.mean}</p></div>
                `;
                document.getElementById('price-targets').innerHTML = priceTargetHtml;
            }

            // Display Earnings Estimate
            const earningsEstimate = data.earnings_estimate;
            if (earningsEstimate && Array.isArray(earningsEstimate)) {
                let earningsHtml = '<table><thead><tr><th>Growth</th><th>High</th><th>Low</th><th>Avg</th><th>Year Ago EPS</th><th>Analysts</th></tr></thead><tbody>';

                earningsEstimate.forEach(estimate => {
                    earningsHtml += `
                        <tr>
                            <td>${(estimate.growth * 100).toFixed(2)}%</td>  <!-- Convert growth to percentage -->
                            <td>${estimate.high}</td>
                            <td>${estimate.low}</td>
                            <td>${estimate.avg}</td>
                            <td>${estimate.yearAgoEps}</td>
                            <td>${estimate.numberOfAnalysts}</td>
                        </tr>`;
                });

                earningsHtml += '</tbody></table>';
                document.getElementById('earnings-estimate').innerHTML = earningsHtml;
            }

            // Display Revenue Estimate
            const revenueEstimate = data.revenue_estimate;
            if (revenueEstimate && Array.isArray(revenueEstimate)) {
                let revenueHtml = '<table><thead><tr><th>Growth</th><th>High</th><th>Low</th><th>Avg</th><th>Year Ago Revenue</th><th>Analysts</th></tr></thead><tbody>';

                revenueEstimate.forEach(estimate => {
                    revenueHtml += `
                        <tr>
                            <td>${(estimate.growth * 100).toFixed(2)}%</td>  <!-- Convert growth to percentage -->
                            <td>$${(estimate.high / 1e9).toFixed(2)}B</td>
                            <td>$${(estimate.low / 1e9).toFixed(2)}B</td>
                            <td>$${(estimate.avg / 1e9).toFixed(2)}B</td>  <!-- Convert to billions -->
                            <td>$${(estimate.yearAgoRevenue / 1e9).toFixed(2)}B</td>
                            <td>${estimate.numberOfAnalysts}</td>
                        </tr>`;
                });

                revenueHtml += '</tbody></table>';
                document.getElementById('revenue-estimate').innerHTML = revenueHtml;
            }

            // Display Earnings History
            const earningsHistory = data.earnings_history;
            if (earningsHistory && Array.isArray(earningsHistory)) {
                let earningsHistoryHtml = '<table><thead><tr><th>EPS Actual</th><th>EPS Estimate</th><th>EPS Difference</th><th>Surprise %</th></tr></thead><tbody>';

                earningsHistory.forEach(history => {
                    earningsHistoryHtml += `
                        <tr>
                            <td>${history.epsActual}</td>
                            <td>${history.epsEstimate}</td>
                            <td>${history.epsDifference}</td>
                            <td>${(history.surprisePercent * 100).toFixed(2)}%</td>
                        </tr>`;
                });

                earningsHistoryHtml += '</tbody></table>';
                document.getElementById('earnings-history').innerHTML = earningsHistoryHtml;
            }

            // Display EPS Trend
            const epsTrend = data.eps_trend;
            if (epsTrend && Array.isArray(epsTrend)) {
                let epsTrendHtml = '<table><thead><tr><th>7 Days Ago</th><th>30 Days Ago</th><th>60 Days Ago</th><th>90 Days Ago</th><th>Current</th></tr></thead><tbody>';

                epsTrend.forEach(trend => {
                    epsTrendHtml += `
                        <tr>
                            <td>${trend.current}</td>
                            <td>${trend['7daysAgo']}</td>
                            <td>${trend['30daysAgo']}</td>
                            <td>${trend['60daysAgo']}</td>
                            <td>${trend['90daysAgo']}</td>
                        </tr>`;
                });

                epsTrendHtml += '</tbody></table>';
                document.getElementById('eps-trend').innerHTML = epsTrendHtml;
            }

            // Display EPS Revisions
            const epsRevisions = data.eps_revisions;
            if (epsRevisions && Array.isArray(epsRevisions)) {
                let epsRevisionsHtml = '<table><thead><tr><th>Up (Last 7 Days)</th><th>Down (Last 7 Days)</th><th>Up (Last 30 Days)</th><th>Down (Last 30 Days)</th></tr></thead><tbody>';

                epsRevisions.forEach(revision => {
                    epsRevisionsHtml += `
            <tr>
                <td>${revision.upLast7days !== null ? revision.upLast7days : 'N/A'}</td>
                <td>${revision.downLast7days !== null ? revision.downLast7days : 'N/A'}</td>
                <td>${revision.upLast30days !== null ? revision.upLast30days : 'N/A'}</td>
                <td>${revision.downLast30days !== null ? revision.downLast30days : 'N/A'}</td>
            </tr>`;
                });

                epsRevisionsHtml += '</tbody></table>';
                document.getElementById('eps-revisions').innerHTML = epsRevisionsHtml;
            }


            // Display Growth Estimates
            const growthEstimates = data.growth_estimates;
            if (growthEstimates && Array.isArray(growthEstimates)) {
                let growthHtml = '<table><thead><tr><th>Stock Growth</th><th>Index Growth</th><th>Industry Growth</th><th>Sector Growth</th></tr></thead><tbody>';

                growthEstimates.forEach(estimate => {
                    growthHtml += `
            <tr>
                <td>${(estimate.stock * 100).toFixed(2)}%</td> <!-- Convert to percentage -->
                <td>${(estimate.index * 100).toFixed(2)}%</td> <!-- Convert to percentage -->
                <td>${estimate.industry !== "N/A" ? estimate.industry : 'N/A'}</td>
                <td>${estimate.sector !== "N/A" ? estimate.sector : 'N/A'}</td>
            </tr>`;
                });

                growthHtml += '</tbody></table>';
                document.getElementById('growth-estimates').innerHTML = growthHtml;
            }

        })
        .catch(error => {
            console.error('Error fetching analyst estimates:', error);
            document.getElementById('analyst-estimates').innerHTML = `<p>Error: ${error.message}</p>`;
        });
}

// Function to fetch AI opinion and display it
function loadAnnualReports(stockSymbol) {
    fetch(`/api/annual_reports?symbol=${stockSymbol}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Error fetching AI opinion:', data.error);
                document.getElementById('ai-opinion').innerHTML = `<p>Error: ${data.error}</p>`;
            } else {
                const annualReportsButton = document.getElementById('annual-reports');
                if (annualReportsButton) {
                    annualReportsButton.href = data.link;  // Set the href attribute with the returned link
                    annualReportsButton.target = '_blank';  // Open the link in a new tab
                    console.log(`Annual reports link set to: ${data.link}`);
                }
            }
        })
        .catch(error => {
            console.error('Error fetching AI opinion:', error);
            document.getElementById('ai-opinion').innerHTML = `<p>Error: ${error.message}</p>`;
        });
}

// Function to fetch AI opinion and display it
function loadAIOpinion(stockSymbol, force) {
    document.getElementById('loading-container').style.display = 'flex';
    // Get selected information
    const includeFinancialData = document.getElementById('financial-data').checked;
    const includeYearlyReports = document.getElementById('yearly-reports').checked;
    const includeQuarterlyReports = document.getElementById('quarterly-reports').checked;
    const includeNews = document.getElementById('news').checked;
    const gptModel = document.getElementById('gpt-model').value;

    // Create query parameters
    const queryParams = new URLSearchParams({
        symbol: stockSymbol,
        financial_data: includeFinancialData,
        yearly_reports: includeYearlyReports,
        quarterly_reports: includeQuarterlyReports,
        news: includeNews,
        model: gptModel
    });
    fetch(`/api/ai_opinion?${queryParams.toString()}&force_refresh=${force}}`)
        .then(response => response.json())
        .then(data => {
            //console.log('API Response:', data); // Log the entire response object
            if (data.error) {
                console.error('Error fetching AI opinion:', data.error);
                document.getElementById('financial-health').innerHTML = `<p>Error: ${data.error}</p>`;
            } else {
                let aiOpinion;
                try {
                    aiOpinion = JSON.parse(data.ai_opinion);
                } catch (e) {
                    console.error('Error parsing ai_opinion:', e);
                    document.getElementById('financial-health').innerHTML = `<p>Error: Invalid AI opinion format</p>`;
                    return;
                }
                document.getElementById('loading-container').style.display = 'none';
                document.getElementById('company-situation').style.display = 'block';
                document.getElementById('investment-attractiveness').style.display = 'block';
                // Check if company_situation and investment_attractiveness exist
                if (aiOpinion.company_situation && aiOpinion.investment_attractiveness) {
                    document.getElementById("financial-health").textContent = aiOpinion.company_situation.financial_health || 'N/A';
                    document.getElementById("market-position").textContent = aiOpinion.company_situation.market_position || 'N/A';
                    document.getElementById("growth-prospects").textContent = aiOpinion.company_situation.growth_prospects || 'N/A';
                    document.getElementById("competitors").textContent = aiOpinion.company_situation.main_competitors || 'N/A';
                    document.getElementById("potential_opportunities").textContent = aiOpinion.company_situation.potential_opportunities || 'N/A';
                    document.getElementById("potential-risks").textContent = aiOpinion.company_situation.potential_risks || 'N/A';
                    document.getElementById("rating").textContent = aiOpinion.investment_attractiveness.rating + "/10" || 'N/A';
                    document.getElementById("multibagger-potential").textContent = aiOpinion.investment_attractiveness.multibagger_potential + "/10" || 'N/A';
                    document.getElementById("growth_potential").textContent = aiOpinion.investment_attractiveness.growth_estimate + '%' || 'N/A';
                    document.getElementById("shares-valuation").textContent = aiOpinion.investment_attractiveness.shares_valuation || 'N/A';
                } else {
                    console.error('Unexpected response structure:', data);
                    document.getElementById('financial-health').innerHTML = `<p>Error: Unexpected response structure</p>`;
                }
                //document.getElementById('ai-opinion').innerHTML = `<p>${aiOpinion}</p>`;
            }
        })
        .catch(error => {
            console.error('Error fetching AI opinion:', error);
            document.getElementById('financial-health').innerHTML = `<p>Error: ${error.message}</p>`;
        });
}


// Function to handle the button click event
function askAIOpinion() {
    const stockSymbol = getCookie('stockSymbol');  // Fetch from cookies
    if (stockSymbol) {
        loadAIOpinion(stockSymbol, 'True');
    } else {
        console.error('Stock symbol not found.');
        document.getElementById('ai-opinion').innerHTML = `<p>Error: Stock symbol not found.</p>`;
    }
}

// Function to handle the button click event
function loadNews() {
    const newsContainer = document.getElementById('news-container');
    const symbol = getCookie('stockSymbol');  // Fetch from cookies
    fetch(`/api/news?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            const newsItems = data.news;
            newsItems.forEach(news => {
                const newsItem = document.createElement('div');
                newsItem.className = 'news-item';

                let thumbnailUrl = '';
                if (news.thumbnail && news.thumbnail.resolutions) {
                    const thumbnail = news.thumbnail.resolutions.find(res => res.tag === '140x140');
                    if (thumbnail) {
                        thumbnailUrl = thumbnail.url;
                    }
                }

                const newsContent = `
                    ${thumbnailUrl ? `<img src="${thumbnailUrl}" alt="${news.title}">` : ''}
                    <div class="news-content">
                        <h2><a href="${news.link}" target="_blank">${news.title}</a></h2>
                        <p>Published by ${news.publisher} on ${new Date(news.providerPublishTime * 1000).toLocaleDateString()}</p>
                    </div>
                `;

                newsItem.innerHTML = newsContent;
                newsContainer.appendChild(newsItem);
            });
        })
        .catch(error => {
            console.error('Error fetching news:', error);
            newsContainer.innerHTML = '<p>Failed to load news articles. Please try again later.</p>';
        });
}

function loadDividends() {
    const symbol = getCookie('stockSymbol');  // Fetch from cookies
    fetch(`/api/dividends?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Error fetching dividends data:', data.error);
                const dividendsContainer = document.getElementById('dividends-container');
                if (dividendsContainer) {
                    dividendsContainer.innerHTML = `<p>Error: ${data.error}</p>`;
                }
                return;
            }

            const dividends = data.dividends;
            const labels = Object.keys(dividends).map(date => new Date(date).toLocaleDateString());
            const values = Object.values(dividends);

            const ctx = document.getElementById('dividends-chart').getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Dividends',
                        data: values,
                        backgroundColor: 'rgba(21, 88, 38, 1)',
                        bortedcolor: 'rgba(21, 150, 38, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        })
        .catch(error => {
            console.error('Error fetching dividends data:', error);
            const dividendsContainer = document.getElementById('dividends-container');
            if (dividendsContainer) {
                dividendsContainer.innerHTML = `<p>Error: ${error.message}</p>`;
            }
        });
}

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
    if (currentUrl.includes('/dividends')) {
        loadDividends();
    }
    else if (currentUrl.includes('/portfolio')) {
        document.getElementById('upload_statement').addEventListener('click', function () {
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
        loadPortfolio(); // Load portfolio
    }
    else if (currentUrl.includes('/news')) {
        loadNews(); // Load news articles
    }
    else if (currentUrl.includes('/recommendations')) {
        loadRecommendations(stockSymbol); // Load stock recommendations
    }
    else if (currentUrl.includes('/analyst_estimates')) {
        loadAnalystEstimates(stockSymbol); // Load analyst estimates
    }
    else if (currentUrl.includes('/8pillars')) {
        loadEightPillars(stockSymbol);  // Load 8 Pillars data
    }
    else if (currentUrl.includes('/cash_flow')) {
        loadCashFlow(stockSymbol); // Load cash flow data
        // Add event listeners to the buttons
        document.getElementById('year').addEventListener('click', function() {
            setActiveButton('year');
            loadCashFlow(stockSymbol); // Replace 'AAPL' with the desired symbol
        });

        document.getElementById('quarter').addEventListener('click', function() {
            setActiveButton('quarter');
            loadCashFlow(stockSymbol); // Replace 'AAPL' with the desired symbol
        });
    }
    else if (currentUrl.includes('/balance_sheet')) {
        // Add event listeners to the buttons
        document.getElementById('year').addEventListener('click', function() {
            setActiveButton('year');
            loadBalanceSheet(stockSymbol); // Replace 'AAPL' with the desired symbol
        });

        document.getElementById('quarter').addEventListener('click', function() {
            setActiveButton('quarter');
            loadBalanceSheet(stockSymbol); // Replace 'AAPL' with the desired symbol
        });
        loadBalanceSheet(stockSymbol); // Load balance sheet data
    }
    else if (currentUrl.includes('/income_statement')) {
        // Add event listeners to the buttons
        document.getElementById('year').addEventListener('click', function() {
            setActiveButton('year');
            loadIncomeStatement(stockSymbol); // Replace 'AAPL' with the desired symbol
        });

        document.getElementById('quarter').addEventListener('click', function() {
            setActiveButton('quarter');
            loadIncomeStatement(stockSymbol); // Replace 'AAPL' with the desired symbol
        });
        loadIncomeStatement(stockSymbol);   // Load income statement data
    }
    else if (currentUrl.includes('/ai')) {
        loadAIOpinion(stockSymbol, 'False');   // Load income statement data
    }
    else if (currentUrl.includes('/stock_data')) {
        fetchStockData(stockSymbol); // Fetch stock data
        const ytdButton = document.getElementById('ytdBtn');
        updateChart(range, ytdButton, []);
        loadAnnualReports(stockSymbol);  // Load Annual Reports opinion
    }
});