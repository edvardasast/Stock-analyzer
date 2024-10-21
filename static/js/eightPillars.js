import { getCookie } from './utils.js';


const currentUrl = window.location.href;
const symbol = getCookie('stockSymbol');
//how to check if response is null
if (currentUrl.includes('/8pillars')) {
    loadEightPillars(symbol);
}

export function loadEightPillars(symbol) {
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