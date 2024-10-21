import { getCookie } from './utils.js';


const currentUrl = window.location.href;
const symbol = getCookie('stockSymbol');
//how to check if response is null
if (currentUrl.includes('/analyst_estimates')) {
    loadAnalystEstimates(symbol);
}

// Function to fetch and display analyst estimates
export function loadAnalystEstimates(symbol) {
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