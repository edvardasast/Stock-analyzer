import { formatDateToYYYYMMDD } from './utils.js';
import { getCookie, findPriceForDate } from './utils.js';

// Global chart reference
let portfolioChart;
let chart;

// Function to update the portfolio chart based on the selected time frame
export function updatePortfolioChart(timeFrame, button) {
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
    // Format the date to YYYY-MM-DD before sending
    let formattedDate = formatDateToYYYYMMDD(historyStartDate);
    fetch(`/api/portfolio_events?date=${formattedDate}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error(`Error from API: ${data.error}`);
                return;
            }
            const historyDates = data.history.map(entry => entry.date);
            const historyValues = data.history.map(entry => entry.totalValue);
            const historyInvested = data.history.map(entry => entry.totalInvested);
            const historyDividends = data.history.map(entry => entry.dividends || 0);
            // Only update the chart after processing all the data
            if (historyDates.length > 0 && historyValues.length > 0) {
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
                        },
                        {
                            label: 'Dividends', // Label for the new dataset
                            data: historyDividends, // Data for the new dataset
                            borderColor: 'rgba(255, 159, 64, 1)', // Styling for the new dataset
                            backgroundColor: 'rgba(255, 159, 64, 0.2)',
                            fill: false,
                            tension: 0.1,
                            yAxisID: 'y1', // Use a second y-axis for profit margin
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
                                    display: true
                                }
                            },
                            y: {
                                ticks: {
                                    callback: function (value) {
                                        return `$${value / 1000}K`; // Append '%' for profit margin
                                    }
                                },
                                title: {
                                    display: true
                                },
                                beginAtZero: false
                            },
                            y1: {
                                beginAtZero: true,
                                position: 'right', // Position the y1 axis on the right
                                ticks: {
                                    callback: function (value) {
                                        return `$${value}`; // Append '%' for profit margin
                                    }
                                }
                            }
                        }
                    }
                });
            } else {
                console.error('No valid data to display in chart');
            }
        })
        .catch(error => {
            console.error('Error fetching portfolio events:', error);
        });
}
// Function to update any chart (used for specific stock data, recommendations)
export function updateChart(range, button, upgradesDowngradesData) {
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

            // Filter upgradesDowngradesData based on the date condition
            const filteredUpgradesDowngradesData = upgradesDowngradesData.filter(event => {
                const eventDate = new Date(event.GradeDate);
                const lastDate = new Date(data["price_chart"].dates[0]);
                return eventDate > lastDate;
            });
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
                            annotations: (filteredUpgradesDowngradesData && filteredUpgradesDowngradesData.length > 0)
                                ? filteredUpgradesDowngradesData.map((event, index) => {
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

// Create Income Statement Chart
export function createIncomeStatementChart(labels, revenueData, netIncomeData, profitMarginData) {
    const ctx = document.getElementById('financialChart').getContext('2d');
    if (chart) {
        chart.destroy();  // Properly destroy the chart instance
        chart = null;  // Reset chart variable
    }
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Revenue',
                    data: revenueData,
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Net Income',
                    data: netIncomeData,
                    backgroundColor: 'rgba(153, 102, 255, 0.5)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Profit Margin (%)',
                    data: profitMarginData,
                    type: 'line',
                    backgroundColor: 'rgba(255, 159, 64, 0.2)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 2,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return `$${value}B`; // Billions label for Revenue/Net Income
                        }
                    }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    ticks: {
                        callback: function (value) {
                            return `${value}%`; // Percentage label for Profit Margin
                        }
                    }
                }
            }
        }
    });
}

// Create Balance Sheet Chart
export function createBalanceSheetChart(labels, assetsData, liabilitiesData, debtToAssetsData) {
    const ctx = document.getElementById('financialChart').getContext('2d');
    // If chart exists, destroy it before creating a new one
    if (chart) {
        chart.destroy();  // Properly destroy the chart instance
        chart = null;  // Reset chart variable
    }
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Assets',
                    data: assetsData,
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Liabilities',
                    data: liabilitiesData,
                    backgroundColor: 'rgba(153, 102, 255, 0.5)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Debt to Assets (%)',
                    data: debtToAssetsData,
                    type: 'line',
                    backgroundColor: 'rgba(255, 159, 64, 0.2)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 2,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return `$${value}B`; // Billions label for Assets/Liabilities
                        }
                    }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    ticks: {
                        callback: function (value) {
                            return `${value}%`; // Percentage label for Debt to Assets
                        }
                    }
                }
            }
        }
    });
}

// Create Cash Flow Chart
export function createCashFlowChart(labels, operatingData, investingData, financingData) {
    const ctx = document.getElementById('financialChart').getContext('2d');
    if (chart) {
        chart.destroy();  // Properly destroy the chart instance
        chart = null;  // Reset chart variable
    }
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Operating Cash Flow',
                    data: operatingData,
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Investing Cash Flow',
                    data: investingData,
                    backgroundColor: 'rgba(153, 102, 255, 0.5)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Financing Cash Flow',
                    data: financingData,
                    backgroundColor: 'rgba(255, 159, 64, 0.5)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return `$${value}B`; // Billions label for Cash Flows
                        }
                    }
                }
            }
        }
    });
}
