from bs4 import BeautifulSoup
from openai import OpenAI
import requests
import time
import os
from dotenv import load_dotenv
import logging



# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


load_dotenv()
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable not set")
client = OpenAI(
  api_key=OPENAI_API_KEY,  # this is also the default, it can be omitted
)
class NewsDownloader:
    def __init__(self, socketio):
        self.socketio = socketio

    def download_news(self, symbol, news_list, model):
        print("Downloading news for ", symbol)

        downloaded_news = []

        for news in news_list:
            self.socketio.emit('update', {'message': f"Fetching news article {news['title']}"})
            url = news['link'] if isinstance(news, dict) else news.link
            print("News URL ", url)
            news_text = self.get_cleaned_article_text(url)
            news_summary = self.get_ai_summary(news_text, symbol, model)
            downloaded_news.append(news_summary)
        logging.info("News downloaded successfully.")
        logging.info(downloaded_news)

        return downloaded_news
    def get_cleaned_article_text(self, url, retries=3, delay=2):
        """
        Fetches and parses the content of the specified URL, with retries, logging, and error handling.
        Filters out paragraphs with unwanted content like '©' or '(Reporting by)' and returns clean text.
        """

        headers = {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'accept-language': 'en-US,en;q=0.8',
            'cache-control': 'max-age=0',
            'cookie': 'A1=d=AQABBKflGWcCENA-MtlOtw5D9D_13R9ZXz0FEgEBAQE3G2cjZ1keyyMA_eMAAA&S=AQAAAos85rZJKwUetiDk-IFQPEI; A3=d=AQABBKflGWcCENA-MtlOtw5D9D_13R9ZXz0FEgEBAQE3G2cjZ1keyyMA_eMAAA&S=AQAAAos85rZJKwUetiDk-IFQPEI; _cb=CYsgJlVCP64DCJ9F4; _chartbeat2=.1729750441943.1729751235350.1.CJ-OSssu3PXD_l6baCidHNnz00t6.4',
            'priority': 'u=0, i',
            'referer': 'https://finance.yahoo.com/',
            'sec-ch-ua': '"Chromium";v="130", "Brave";v="130", "Not?A_Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-user': '?1',
            'sec-gpc': '1',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
        }

        # Attempt to fetch content with retries
        for attempt in range(retries):
            try:
                logging.info(f"Fetching content from {url} (Attempt {attempt + 1})")
                response = requests.get(url, headers=headers, timeout=10)
                if response.status_code == 200:
                    logging.info("Content successfully fetched.")
                    soup = BeautifulSoup(response.content, "lxml")

                    # Find the specific div with class "body yf-5ef8bf"
                    div_content = soup.find('div', class_='body yf-5ef8bf')
                    if div_content:
                        # Extract text from paragraph (<p>) tags, ignoring links and unnecessary elements
                        text_elements = []
                        for p in div_content.find_all('p'):
                            text = p.get_text(separator=' ', strip=True)
                            # Filter out paragraphs that start with "©" or contain "(Reporting by"
                            if not text.startswith("©") and "(Reporting by" not in text:
                                text_elements.append(text)

                        # Join the text content from each paragraph, separated by two newlines for readability
                        cleaned_text = '\n\n'.join(text_elements)
                        logging.info("Text extraction and cleaning completed successfully.", cleaned_text)
                        logging.info("Text extraction and cleaning completed successfully.")
                        return cleaned_text
                    else:
                        logging.warning("No content found in the specified div.")
                        return "No content found in the specified div."
                else:
                    logging.warning(f"Received status code {response.status_code}. Retrying...")
            except requests.exceptions.RequestException as e:
                logging.error(f"Request failed: {e}")
            time.sleep(delay)

        logging.error("Failed to fetch content after retries.")
        return "Failed to retrieve content from the URL."

    def get_ai_summary(self, prompt, symbol, model):
          # Call the OpenAI API for chat models
            system_message = (
                f"You are a professional financial analyst and stocks trader. "
                f"Based on the following financial {type} form for ({symbol}), provide a detailed summary"
                f"{prompt}"
            )
            user_message = (
                f"Your response should include all key information that could help to predict company shares growth or decline."
            )
            response = client.chat.completions.create(
                model=model,  # Ensure the correct chat model is used
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_message}
                ],
                max_tokens=10000,
                temperature=0,
                n=1,
            )
            # Extract token usage information
            prompt_tokens = response.usage.prompt_tokens
            completion_tokens = response.usage.completion_tokens
            total_tokens = response.usage.total_tokens
            print(f"{type} Tokens used: Prompt tokens: {prompt_tokens} Completion tokens: {completion_tokens} Total: {total_tokens}")

            # Access the response
            summary = response.choices[0].message.content.strip()
            return summary
