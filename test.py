import yfinance as yf

msft = yf.Ticker("MSFT")

# Stock data

# Analyst recommendations
print("Stock analyst recommendations: ")
msft.analyst_price_targets
print("MSFT analyst price targets: ", msft.analyst_price_targets)


tech = yf.Sector('technology')
software = yf.Industry('software-infrastructure')

# Common information
print("Tech common information: ")
tech.key
print("Tech key: ", tech.key)
tech.name
print("Tech name: ", tech.name)
tech.symbol
print("Tech symbol: ", tech.symbol)
tech.ticker
print("Tech ticker: ", tech.ticker)
tech.overview
print("Tech overview: ", tech.overview)
tech.top_companies
print("Tech top companies: ", tech.top_companies)
tech.research_reports
print("Tech research reports: ", tech.research_reports)

# Sector information
tech.top_etfs
print("Tech top etfs: ", tech.top_etfs)
tech.top_mutual_funds
print("Tech top mutual funds: ", tech.top_mutual_funds)
tech.industries
print("Tech industries: ", tech.industries)

# Industry information
software.sector_key
print("Software sector key: ", software.sector_key)
software.sector_name
print("Software sector name: ", software.sector_name)
software.top_performing_companies
print("Software top performing companies: ", software.top_performing_companies)
software.top_growth_companies
print("Software top growth companies: ", software.top_growth_companies)