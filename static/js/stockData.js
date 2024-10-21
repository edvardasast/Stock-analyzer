import { getCookie } from './utils.js';
import { updateChart } from './charts.js';
import { loadAnnualReports } from './annualReports.js'; 
import { setupTimeFrameButtons } from './eventHandlers.js';



const currentUrl = window.location.href;
const symbol = getCookie('stockSymbol');
let range = 'YTD'
//how to check if response is null
if (currentUrl.includes('/stock_data')) {
    fetchStockData(symbol);
    const ytdButton = document.getElementById('ytdBtn');
    setupTimeFrameButtons([]);
    updateChart(range, ytdButton, []);
    loadAnnualReports(symbol);
}
export function fetchStockData(symbol) {

    fetch(`/api/stock_data?symbol=${symbol}&range=${range}`)
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
                document.getElementById("market-cap").textContent = `$${data.market_cap}`;
                document.getElementById("revenue").textContent = `$${data.revenue}`;
                document.getElementById("net-income").textContent = `$${data.net_income}`;
                document.getElementById("4yr_avg_net_income").textContent = `$${data.four_year_avg_net_income}`;
                document.getElementById("pe").textContent = data.pe_ratio;
                document.getElementById("ps-ratio").textContent = data.ps_ratio;
                document.getElementById("profit-margin").textContent = `${data.profit_margin}%`;
                document.getElementById("4yr-profit-margin").textContent = `${data.four_year_profit_margin}%`;
                document.getElementById("gross-profit-margin").textContent = `${data.gross_profit_margin}%`;
                document.getElementById("3yr-revenue-growth").textContent = `${data.three_year_revenue_growth}%`;

                // Middle Column Data
                document.getElementById("fcf").textContent = `$${data.free_cash_flow}`;
                document.getElementById("4yr-fcf").textContent = `$${data.four_year_avg_fcf}`;
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
