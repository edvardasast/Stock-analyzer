import { getCookie } from './utils.js';


const currentUrl = window.location.href;
const symbol = getCookie('stockSymbol');
//how to check if response is null
if (currentUrl.includes('/analyst_estimates')) {
    loadAnnualReports(symbol);
}

// Function to fetch AI opinion and display it
export function loadAnnualReports(stockSymbol) {
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