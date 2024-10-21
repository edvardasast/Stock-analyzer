import { getCookie } from './utils.js';


const currentUrl = window.location.href;
const symbol = getCookie('stockSymbol');
//how to check if response is null
if (currentUrl.includes('/news')) {
    loadNews(symbol);
}
// Function to handle the button click event
export function loadNews() {
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