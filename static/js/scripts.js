let chart;  // Declare chart globally

function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000)); // Set expiration date
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/"; // Set cookie with expiration
}

document.getElementById("load-metrics").addEventListener("click", function() {
    const stockSymbol = document.getElementById("stock-symbol").value.trim();
    
    if (stockSymbol) {
        // Save stock symbol to cookies for 7 days
        setCookie('stockSymbol', stockSymbol.toUpperCase(), 7);
        
        // Redirect to the Metrics page with the stock symbol
        window.location.href = `/metrics`;
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
               console.log(data)
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

            } else {
                //console.error('Element with id "metrics elements not found" not found.');
            }
              

            // Find and pass the 5Yr button by its ID to updateChart function
            const fiveYearButton = document.getElementById('fiveYearBtn');
            updateChart("5Y", fiveYearButton, symbol);
        })
        .catch(error => console.error("Error fetching data:", error));
}

function updateChart(range, button, stockSymbol) {
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


// Call this function when the page loads with the stock symbol
document.addEventListener("DOMContentLoaded", function() {
    const stockSymbol =  getCookie('stockSymbol');  // Fetch from cookies
    console.log(stockSymbol)
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
    
    fetchStockData(stockSymbol);
    loadIncomeStatement(stockSymbol);
    loadBalanceSheet(stockSymbol);
    loadCashFlow(stockSymbol);
});