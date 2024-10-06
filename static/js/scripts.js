let chart;  // Declare chart globally
let symbol = ''
function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000)); // Set expiration date
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/"; // Set cookie with expiration
}

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

function fetchStockData(symbol) {

    fetch(`/api/stock_data?symbol=${symbol}`)
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
                document.getElementById("c-name").textContent =  data.company_name;
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
            // Find and pass the 5Yr button by its ID to updateChart function
            const fiveYearButton = document.getElementById('fiveYearBtn');
            updateChart("5Y", fiveYearButton, symbol);
        })
        .catch(error => console.error("Error fetching data:", error));
}

// Function to fetch and display stock recommendations
function loadRecommendations(symbol) {
    fetch(`/api/recomendations?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error(`Error from API: ${data.error}`);
                document.getElementById('recommendations').innerHTML = `<p>Error: ${data.error}</p>`;
                return;
            }

            // Display Symbol
            document.getElementById('symbol-name').textContent = symbol;

            // Display Recommendations Summary
            const recommendationsSummary = data.recomendations_summary;
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
            const recommendations = data.recomendations;
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
                let upgradesHtml = '<table><thead><tr><th>Date</th><th>Firm</th><th>To Grade</th><th>From Grade</th><th>Action</th></tr></thead><tbody>';
                upgradesDowngrades.forEach(upgrade => {
                    upgradesHtml += `
                        <tr>
                            <td>${new Date(upgrade.GradeDate).toLocaleDateString()}</td>
                            <td>${upgrade.Firm}</td>
                            <td>${upgrade.ToGrade}</td>
                            <td>${upgrade.FromGrade}</td>
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


function updateChart(range, button) {
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
                            mode: 'nearest',  // Shows tooltip for nearest data point
                            intersect: false  // Show tooltip even if not hovering directly on point
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

// Function to fetch and display income statement data
function loadIncomeStatement(symbol) {
    fetch(`/api/income_statement?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            const incomeStatement = data.income_statement;

            // Get the years (column headers)
            const years = Object.keys(incomeStatement).reverse();

            // Get the fields (row headers) from the first year's data
            const fields = Object.keys(incomeStatement[years[0]]);

            // Build table headers (years)
            let tableHeader = '<tr><th>Field</th>';
            years.forEach(year => {
                tableHeader += `<th>${year}</th>`;
            });
            tableHeader += '</tr>';
            document.querySelector('thead tr').innerHTML = tableHeader;

            // Build table body (fields)
            let tableBody = '';
            fields.forEach(field => {
                let row = `<tr><td>${field}</td>`;
                years.forEach(year => {
                    const value = incomeStatement[year][field] || 'N/A';
                    row += `<td>${formatValue(value)}</td>`;
                });
                row += '</tr>';
                tableBody += row;
            });
            const element = document.getElementById('income-statement-body');
            if (element) {
                // Safe to manipulate the element
                element.innerHTML = tableBody
            } else {
                //console.error('Element with id "income-statement" not found.');
            }
            //document.getElementById('income-statement-body').innerHTML = tableBody;
        })
        .catch(error => console.error('Error fetching income statement:', error));
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
    fetch(`/api/balance_sheet?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            const balanceSheet = data.balance_sheet;  // Use the correct property name 'balance_sheet'

            // Get the years (column headers) and reverse them to display the most recent year first
            const years = Object.keys(balanceSheet).reverse();

            // Get the fields (row headers) from the first year
            const fields = Object.keys(balanceSheet[years[0]]);

            // Build the table headers (years as columns)
            let tableHeader = '<tr><th>Field</th>';
            years.forEach(year => {
                tableHeader += `<th>${year}</th>`;
            });
            tableHeader += '</tr>';
            document.querySelector('thead').innerHTML = tableHeader;  // Fixed to update 'thead' instead of just 'thead tr'

            // Build the table body (fields as rows)
            let tableBody = '';
            fields.forEach(field => {
                let row = `<tr><td>${field}</td>`;  // Start the row with the field name
                years.forEach(year => {
                    const value = balanceSheet[year][field] || 'N/A';  // Safely access field value
                    row += `<td>${formatValue(value)}</td>`;  // Add each year's value for the field
                });
                row += '</tr>';  // Close the row
                tableBody += row;  // Append the row to the table body
            });
            const element = document.getElementById('balance-sheet-body');
            if (element) {
                // Safe to manipulate the element
                element.innerHTML = tableBody
            } else {
                //console.error('Element with id "balance-sheet" not found.');
            }
            //document.getElementById('balance-sheet-body').innerHTML = tableBody;  // Update the table body
        })
        .catch(error => console.error('Error fetching balance sheet:', error));
}


// Function to fetch and display balance sheet data
function loadCashFlow(symbol) {
    fetch(`/api/cash_flow?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            const cashFlow = data.cash_flow;  // Use the correct property name 'balance_sheet'

            // Get the years (column headers) and reverse them to display the most recent year first
            const years = Object.keys(cashFlow).reverse();

            // Get the fields (row headers) from the first year
            const fields = Object.keys(cashFlow[years[0]]);

            // Build the table headers (years as columns)
            let tableHeader = '<tr><th>Field</th>';
            years.forEach(year => {
                tableHeader += `<th>${year}</th>`;
            });
            tableHeader += '</tr>';
            document.querySelector('thead').innerHTML = tableHeader;  // Fixed to update 'thead' instead of just 'thead tr'

            // Build the table body (fields as rows)
            let tableBody = '';
            fields.forEach(field => {
                let row = `<tr><td>${field}</td>`;  // Start the row with the field name
                years.forEach(year => {
                    const value = cashFlow[year][field] || 'N/A';  // Safely access field value
                    row += `<td>${formatValue(value)}</td>`;  // Add each year's value for the field
                });
                row += '</tr>';  // Close the row
                tableBody += row;  // Append the row to the table body
            });
            const element = document.getElementById('cash-flow-body');
            if (element) {
                // Safe to manipulate the element
                element.innerHTML = tableBody
            } else {
                //console.error('Element with id "cash-flow" not found.');
            }
            //document.getElementById('cash-flow-body').innerHTML = tableBody;  // Update the table body
        })
        .catch(error => console.error('Error fetching cash flow:', error));
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
function loadAIOpinion(stockSymbol) {
    fetch(`/api/ai_opinion?symbol=${stockSymbol}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Error fetching AI opinion:', data.error);
                document.getElementById('ai-opinion').innerHTML = `<p>Error: ${data.error}</p>`;
            } else {
                const aiOpinion = data.ai_opinion;
                document.getElementById('ai-opinion').innerHTML = `<p>${aiOpinion}</p>`;
            }
        })
        .catch(error => {
            console.error('Error fetching AI opinion:', error);
            document.getElementById('ai-opinion').innerHTML = `<p>Error: ${error.message}</p>`;
        });
}


// Function to handle the button click event
function askAIOpinion() {
    const stockSymbol = getCookie('stockSymbol');  // Fetch from cookies
    if (stockSymbol) {
        loadAIOpinion(stockSymbol);
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

document.addEventListener('DOMContentLoaded', function() {
    const currentUrl = window.location.href;
    const stockSymbol = getCookie('stockSymbol');  // Fetch from cookies
    console.log(stockSymbol)
    fetchStockData(stockSymbol); // Fetch stock data
    if (document.getElementById('symbol-name')) {
        // Safe to manipulate the element
        document.getElementById('symbol-name').textContent = stockSymbol;
    } else {
        //console.error('Element with id "cash-flow" not found.');
    }
    if (document.getElementById('stock-symbol')) {
        // Safe to manipulate the element
        document.getElementById('stock-symbol').value = stockSymbol;
    } else {
        //console.error('Element with id "cash-flow" not found.');
    }
    if (currentUrl.includes('/dividends')) {
        loadDividends();
    }
    else if (currentUrl.includes('/news')) {
        loadNews(); // Load news articles
    }
    else if (currentUrl.includes('/recomendations')) {
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
    }
    else if (currentUrl.includes('/balance_sheet')) {
        loadBalanceSheet(stockSymbol); // Load balance sheet data
    }
    else if (currentUrl.includes('/income_statement')) {
        loadIncomeStatement(stockSymbol);   // Load income statement data
    }
    else if (currentUrl.includes('/stock_data')) {
        loadAnnualReports(stockSymbol);  // Load Annual Reports opinion
    }
});