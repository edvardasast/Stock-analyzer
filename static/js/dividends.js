import { getCookie } from './utils.js';


const currentUrl = window.location.href;
const symbol = getCookie('stockSymbol');
//how to check if response is null
if (currentUrl.includes('/dividends')) {
    loadDividends(symbol);
}

export function loadDividends() {
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