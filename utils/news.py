import requests
from bs4 import BeautifulSoup
import time
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_cleaned_article_text(url, retries=3, delay=2):
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


# Example usage
""" if __name__ == "__main__":
    
    url = input("Please enter an Yahoo news URL...\n")
    article_text = get_cleaned_article_text(url)
    # print(article_text)
    with open("yahoonews/news.txt","w+", encoding="utf-8") as file:
        file.write(article_text) """



