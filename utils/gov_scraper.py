import requests
from bs4 import BeautifulSoup

def get_gov_yearly_report(symbol):
    sec_url = f'https://efts.sec.gov/LATEST/search-index?keysTyped={symbol}'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9,lt-LT;q=0.8,lt;q=0.7,de-DE;q=0.6,de;q=0.5,ru-RU;q=0.4,ru;q=0.3,es-ES;q=0.2,es;q=0.1,zh-MO;q=0.1,zh;q=0.1',
        'Cache-Control': 'max-age=0'
    }
    response = requests.get(sec_url, headers=headers)
    response.raise_for_status()
    data = response.json()
    # Extract _id from response
    _id = data['hits']['hits'][0]['_id']
    sec_link = f'https://www.sec.gov/edgar/browse/?CIK={_id}'
    print(f"SEC link: {sec_link}")
    # Step 1: Send a GET request to the sec_link
    response = requests.get(sec_link, headers=headers)
    print(response)
    # Step 2: Parse the HTML content
    soup = BeautifulSoup(response.content, 'html.parser')
    # Step 3: Find the link to the 10-K annual report
    # This assumes that the link has the text '10-K'. Modify this as needed.
    annual_report_link = soup.find('a', text='10-K')
    if annual_report_link is not None:
        annual_report_href = annual_report_link['href']
        print(f"10-K annual report link found: {annual_report_href}")
    #https://www.sec.gov/ix?doc=/Archives/edgar/data/789019/000095017024087843/msft-20240630.htm
    else:
        print("10-K annual report link not found")
        return annual_report_href
    

    