from yahooquery import Ticker
import yahooquery as yq
import yfinance as yf
from requests.exceptions import HTTPError


aapl = Ticker('qdve.de')

aapl.summary_detail
df = aapl.history(period='5y', interval='1d')
#print(aapl.news(5))
#print(aapl.summary_detail)
##print(df)

try:
    etf = yf.Ticker("WRK")
    info = etf.info
    # Check if info is not equal to {'trailingPegRatio': None}
    if info != {'trailingPegRatio': None}:
        print("ETF info is valid:", info)
    else:
        data = yq.search("qdve", first_quote=True)
        symbol = data['symbol']
        print(symbol)

    print("Printing info", etf.info)
except HTTPError as http_err:
    print(f"HTTP error occurred: {http_err}")
except Exception as err:
    print(f"Other error occurred: {err}")
    data = yq.search("qdve", first_quote=True)
    print(data)



data = yq.search("qdve")
#print(data)