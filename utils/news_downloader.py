from bs4 import BeautifulSoup
from openai import OpenAI
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC  # Import expected_conditions


load_dotenv()
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable not set")
client = OpenAI(
  api_key=OPENAI_API_KEY,  # this is also the default, it can be omitted
)
headers = {
    'accept': '*/*',
    'accept-encoding': 'gzip, deflate, br',
    'accept-language': 'en-US,en;q=0.9',
    'referer': 'https://www.google.com',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36 Edg/85.0.564.44'
}
def download_news(symbol, news_list, model):
    print("Downloading news for ", symbol)
    # Set up Chrome options
    chrome_options = Options()
    #chrome_options.add_argument("--headless")  # Run Chrome in headless mode
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    driver_path = "chromedriver/chromedriver.exe"
    # Initialize the Chrome driver
    driver = webdriver.Chrome(service=Service(driver_path), options=chrome_options)

    downloaded_news = []
    """ for news in news_list:
        url = news['link'] if isinstance(news, dict) else news.link
        print("News URL ", url)
        
        # Use Selenium to fetch the page content
        driver.get(url)
        try:
            WebDriverWait(driver, 20).until(
                EC.presence_of_all_elements_located((By.TAG_NAME, "article"))
            )
        except Exception as e:
            print(f"Error waiting for articles to load: {e}")
            #print(driver.page_source)  # Print the page source for debugging
            continue
        
        page_source = driver.page_source
        soup = BeautifulSoup(page_source, 'html.parser')
        articles = soup.find_all('article')
        
        downloaded_news.append(soup)
    with open(f"{symbol}_articles.html", "w", encoding="utf-8") as file:
        for article in downloaded_news:
            file.write(str(article))
            file.write("\n\n")
        print("Soup news ", articles)
    # Close the driver
    driver.quit() """
    
    return downloaded_news
def get_ai_summary(prompt, symbol, model):
      # Call the OpenAI API for chat models
        system_message = (
            f"You are a professional financial analyst and stocks trader. "
            f"Based on the following financial {type} form for ({symbol}), provide a detailed summary"
            f"{prompt}"
        )
        user_message = (
            f"Your response must be minimum 10000 tokens length and should include all key information. Financial data are not required to be included in the summary."
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
