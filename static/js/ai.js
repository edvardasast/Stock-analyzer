import { setupAIButtonListener } from './eventHandlers.js';
import { getCookie } from './utils.js';

setupAIButtonListener();
let savedResponse = localStorage.getItem('aiResponse');
const currentUrl = window.location.href;
//how to check if response is null
if (currentUrl.includes('/ai')) {
    if (localStorage.getItem('ticker') != getCookie('stockSymbol')) {
        savedResponse = null;
    }
    if (savedResponse == null) {
        console.log('Response is null');
    } else {
        const aiOpinion = JSON.parse(savedResponse); // Parse the saved response
        showData(aiOpinion);
    }
}

export function loadAIOpinion(stockSymbol, force) {
    console.log('Load AI Opinion', force);
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
            let aiOpinion;
            try {
                aiOpinion = JSON.parse(data.ai_opinion);
            } catch (e) {
                console.error('Error parsing ai_opinion:', e);
                document.getElementById('financial-health').innerHTML = `<p>Error: Invalid AI opinion format</p>`;
                return;
            }
            localStorage.setItem('aiResponse', JSON.stringify(aiOpinion));
            localStorage.setItem('ticker', stockSymbol)
            //console.log('API Response:', data); // Log the entire response object
            if (data.error) {
                console.error('Error fetching AI opinion:', data.error);
                document.getElementById('financial-health').innerHTML = `<p>Error: ${data.error}</p>`;
            } else {
                showData(aiOpinion);
            }
        })
        .catch(error => {
            console.error('Error fetching AI opinion:', error);
            document.getElementById('financial-health').innerHTML = `<p>Error: ${error.message}</p>`;
        });
}
function showData(aiOpinion) {
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
        console.error('Unexpected response structure:', aiOpinion);
        document.getElementById('financial-health').innerHTML = `<p>Error: Unexpected response structure</p>`;
    }
    //document.getElementById('ai-opinion').innerHTML = `<p>${aiOpinion}</p>`;
}