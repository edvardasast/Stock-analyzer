import { updateChart } from './charts.js';
import { setupTimeFrameButtons } from './eventHandlers.js';
import { getCookie } from './utils.js';


let upgradesDowngradesData = [];
let range = 'YTD'

const currentUrl = window.location.href;
const symbol = getCookie('stockSymbol');
//how to check if response is null
if (currentUrl.includes('/recommendations')) {
    loadRecommendations(symbol);
}
// Function to fetch and display stock recommendations
export function loadRecommendations(symbol) {
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
            setupTimeFrameButtons(upgradesDowngradesData);
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