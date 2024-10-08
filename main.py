from flask import Flask, render_template, jsonify, request, session
from flask_session import Session
import requests
import yfinance as yf
import pandas as pd
import tempfile
from openai import OpenAI
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')

# Configure session to use filesystem (instead of signed cookies)
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_FILE_DIR'] = tempfile.gettempdir()
app.config['SESSION_PERMANENT'] = False  # Ensure sessions are not permanent
Session(app)

# Global cache to store yfinance data
data_cache = {}

# OpenAI API Key
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
client = OpenAI(
  api_key=OPENAI_API_KEY,  # this is also the default, it can be omitted
)
# Check if the keys are loaded
if not app.secret_key:
    raise ValueError("No SECRET_KEY set for Flask application. Please set it in your .env file.")
if not OPENAI_API_KEY:
    raise ValueError("No OPENAI_API_KEY found. Please set it in your .env file.")

@app.route("/")
def home():
    return render_template("base.html")

@app.route("/stock_data")
def metrics():
    return render_template("stock_data.html")

# Map ranges to yfinance period parameters
range_mapping = {
    '1W': '5d',  # 5 days for 1 week
    '1M': '1mo',
    '3M': '3mo',
    '6M': '6mo',
    'YTD': 'ytd',
    '1Y': '1y',
    '5Y': '5y',
    '10Y': '10y',
    'MAX': 'max'
}

def calculate_cagr(revenue_start, revenue_end, years):
    return ((revenue_end / revenue_start) ** (1 / years)) - 1

@app.route('/api/renew_data_cache', methods=['POST'])
def renew_data_cache():
    try:
        symbol = request.args.get('symbol').upper()
        # Logic to renew data_cache
        global data_cache
        data_cache = {}  # Clear the existing cache
        fetch_stock_data(symbol)  # Fetch data for AAPL to populate the cache
        return jsonify({"success": True})
    except Exception as e:
        print("Error renewing data cache:", e)
        return jsonify({"error": str(e)}), 500

def fetch_stock_data(symbol):
    if symbol in data_cache:
        return data_cache[symbol]
    print("Fully Fetching stock data...", symbol)
    stock = yf.Ticker(symbol)
    data_cache[symbol] = {
        'info': stock.info,
        'financials': stock.financials,
        'balance_sheet': stock.balance_sheet,
        'cash_flow': stock.cashflow,
        'history': stock.history(period='5Y'),
        'analyst_price_targets': stock.analyst_price_targets,
        'earnings_estimate': stock.earnings_estimate,
        'revenue_estimate': stock.revenue_estimate,
        'earnings_history': stock.earnings_history,
        'eps_trend': stock.eps_trend,
        'eps_revisions': stock.eps_revisions,
        'growth_estimates': stock.growth_estimates,
        'recommendations': stock.recommendations,
        'recommendations_summary': stock.recommendations_summary,
        'upgrades_downgrades': stock.upgrades_downgrades,
        'news': stock.news,
        'fast_info': stock.fast_info,
        'dividends': stock.dividends
    }
    #print("Revenue Estimate", stock.revenue_estimate)
    #print("Earnings Estimate", stock.earnings_estimate)
    #print("analyst_price_targets", stock.analyst_price_targets)
    return data_cache[symbol]

@app.route("/api/stock_data")
def get_stock_data():
    symbol = request.args.get('symbol').upper()
    print("Fetching stock data...", symbol)
    range_param = request.args.get('range', 'YTD')  # Default to 5Y if no range is provided

    if not symbol:
        return jsonify({"error": "Stock symbol is required"}), 400

    try:
        stock_data = fetch_stock_data(symbol)
        stock_info = stock_data['info']
        financials = stock_data['financials']
        balance_sheet = stock_data['balance_sheet']
        cash_flow_statement = stock_data['cash_flow']
        fast_info = stock_data['fast_info']
        # Get the corresponding period for the selected range
        period = range_mapping.get(range_param, 'YTD')

        # Extract net income and total revenue for the last 4 years
        net_incomes = financials.loc['Net Income'].values[:4]  # Net Income in USD
        revenues = financials.loc['Total Revenue'].values[:4]  # Total Revenue in USD

        # Convert the values to billions and round to 2 decimal places
        net_incomes_billion = [round(net_income / 1e9, 2) for net_income in net_incomes]
        revenues_billion = [round(revenue / 1e9, 2) for revenue in revenues]

        # Calculate the 4-year total net income and total revenue
        total_net_income = round(sum(net_incomes_billion), 2)
        total_revenue = round(sum(revenues_billion), 2)

        # Ensure there are enough data points to calculate the 3-year compound growth
        if len(revenues) < 4:
            return {"error": "Not enough data to calculate 3-year compound revenue growth."}

        # Most recent year (Year 3) and 3 years ago (Year 0)
        revenue_current = revenues[0]  # Most recent revenue
        revenue_3_years_ago = revenues[2]  # Revenue from 3 years ago

        # Convert to billions
        revenue_current_billion = revenue_current / 1e9
        revenue_3_years_ago_billion = revenue_3_years_ago / 1e9

        # Calculate the 3-Year Compound Revenue Growth
        cagr = calculate_cagr(revenue_3_years_ago_billion, revenue_current_billion, 3)
        cagr_percentage = round(cagr * 100, 2)  # Convert to percentage

        # Extract the operating cash flow and capital expenditures for the last 4 years
        operating_cash_flows = cash_flow_statement.loc['Operating Cash Flow'].values[:4]
        capex = cash_flow_statement.loc['Capital Expenditure'].values[:4]

        # Calculate free cash flow for the last 4 years
        free_cash_flows = [op_cf + capex_val for op_cf, capex_val in zip(operating_cash_flows, capex)]
        free_cash_flows_billion = [round(fcf / 1e9, 2) for fcf in free_cash_flows]  # Convert to billions

        # Dividends Paid
        if 'Cash Dividends Paid' in cash_flow_statement.index:
            dividend_paid = abs(cash_flow_statement.loc['Cash Dividends Paid'].values[0])
        else:
            dividend_paid = 0
        # Calculate the 4-year average free cash flow
        avg_free_cash_flow = round(sum(free_cash_flows_billion) / len(free_cash_flows_billion), 2)

        stock_data = {
            # Market Cap, Revenue, Net Income
            'market_cap': round(stock_info.get('marketCap', 0) / 1e12, 2),  # Convert to Trillions
            'revenue': round(stock_info.get('totalRevenue', 0) / 1e9, 2),   # Convert to Billions
            'net_income': round(stock_info.get('netIncomeToCommon', 0) / 1e9, 2),  # Convert to Billions
            'four_year_avg_net_income': round(sum(net_incomes_billion) / len(net_incomes_billion), 2),  # Convert to Billions

            # Profitability Ratios
            'pe_ratio': round(stock_info.get('trailingPE', 'N/A'), 2),
            'ps_ratio': round(stock_info.get('priceToSalesTrailing12Months', 'N/A'), 2),
            'profit_margin': round(stock_info.get('profitMargins', 0) * 100, 2),  # Convert to percentage
            'four_year_profit_margin': round((total_net_income / total_revenue) * 100, 2),  # Convert to percentage
            'gross_profit_margin': round(stock_info.get('grossMargins', 0) * 100, 2),  # Convert to percentage

            # Revenue Growth
            'three_year_revenue_growth': cagr_percentage,  # Convert to percentage

            # Free Cash Flow and Price Ratios
            'free_cash_flow': round(stock_info.get('freeCashflow', 0) / 1e9, 2),  # Convert to Billions
            'four_year_avg_fcf': avg_free_cash_flow,  # Convert to Billions
            'price_to_fcf': round(((stock_info.get('marketCap', 0) / 1e12) / (stock_info.get('freeCashflow', 0) / 1e9)) * 1000, 2),

            # Dividends and Yields
            'dividend_yield': round(stock_info.get('dividendYield', 0) * 100, 2),  # Convert to percentage
            'dividends_paid': round(dividend_paid / 1e9, 2),  # Convert to Billions
            'five_year_average_dividend_yield': round(stock_info.get('fiveYearAvgDividendYield', 0), 2),  # Convert to percentage

            # EV Ratios
            'ev_to_earnings': round(stock_info.get('enterpriseValue') / stock_info.get('netIncomeToCommon'), 2),  # Convert values and calculate
            'ev_to_fcf': stock_info.get('enterpriseValueToFreeCashFlow', 'N/A'),
            'ev_to_five_year_earnings': stock_info.get('evToFiveYearEarnings', 'N/A'),
            'ev_to_five_year_fcf': stock_info.get('evToFiveYearFcf', 'N/A'),

            # Return on Assets, Equity, Invested Capital
            'roa': round(stock_info.get('returnOnAssets', 0) * 100, 2),  # Convert to percentage
            'roe': round(stock_info.get('returnOnEquity', 0) * 100, 2),  # Convert to percentage
            'company_description': stock_info.get('longBusinessSummary', 'N/A'),
            'company_name': stock_info.get('longName', 'N/A'),
            'current_price': round(fast_info['last_price'], 2),
            'price_change': round(fast_info['last_price'] - stock_info.get('regularMarketPreviousClose', 'N/A'), 2),
            'price_change_percentage': round(((fast_info['last_price']-stock_info.get('regularMarketPreviousClose'))/stock_info.get('regularMarketPreviousClose')*100) ,2),
            'currency': stock_info.get('currency', 'N/A'),
            'website': stock_info.get('website', 'N/A'),
            'industry': stock_info.get('industry', 'N/A'),
            'sector': stock_info.get('sector', 'N/A'),
        }
        # Fetch historical price data for the selected period
        stock = yf.Ticker(symbol)
        hist = stock.history(period=period)
        hist.index = pd.to_datetime(hist.index)
        stock_data['price_chart'] = {
            'dates': hist.index.strftime('%Y-%m-%d').tolist(),
            'prices': hist['Close'].tolist()
        }

        return jsonify(stock_data)

    except Exception as e:
        return jsonify({"error": f"Error fetching data for {symbol}: {str(e)}"}), 500

@app.route('/income_statement')
def income_statement():
    return render_template("income_statement.html")

@app.route('/api/income_statement')
def get_income_statement():
    symbol = request.args.get('symbol', 'AAPL').upper()  # Default to AAPL if no symbol provided
    stock_data = fetch_stock_data(symbol)

    try:
        # Fetch income statement data
        financials = stock_data['financials'].T  # Transpose to get years as rows
        financials.index = financials.index.strftime('%Y-%m-%d')  # Convert the index to strings

        # Get all the available fields from financials
        income_statement = {}
        for year in financials.index:
            # Convert each row to a dictionary (field: value) for that year
            income_statement[year] = financials.loc[year].to_dict()

        # Prepare response data
        response = {
            "symbol": symbol,
            "income_statement": income_statement
        }
        return jsonify(response)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/balance_sheet')
def balance_sheet():
    return render_template("balance_sheet.html")

@app.route('/api/balance_sheet')
def get_balance_sheet():
    symbol = request.args.get('symbol', 'AAPL').upper()  # Default to AAPL if no symbol provided
    stock_data = fetch_stock_data(symbol)

    try:
        # Fetch balance sheet data
        balance = stock_data['balance_sheet'].T  # Transpose to get years as rows
        balance.index = balance.index.strftime('%Y-%m-%d')  # Convert the index to strings
        balance = balance.fillna('N/A').infer_objects(copy=False)  # Replace NaN values with 'N/A'

        # Convert DataFrame to dictionary for JSON serialization
        balance_sheet = balance.to_dict(orient="index")
        response = {
            "symbol": symbol,
            "balance_sheet": balance_sheet
        }
        return jsonify(response)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/cash_flow')
def cash_flow():
    return render_template("cash_flow.html")

@app.route('/api/cash_flow')
def get_cash_flow():
    symbol = request.args.get('symbol', 'AAPL').upper()  # Default to AAPL if no symbol provided
    stock_data = fetch_stock_data(symbol)

    try:
        # Fetch the cash flow data
        cash_flow = stock_data['cash_flow'].T  # Transpose to get years as rows
        cash_flow.index = cash_flow.index.strftime('%Y-%m-%d')  # Convert the index to strings
        cash_flow = cash_flow.fillna('N/A').infer_objects(copy=False)  # Replace NaN values with 'N/A'

        # Convert DataFrame to dictionary for JSON serialization
        cash_flow_dict = cash_flow.to_dict(orient="index")
        response = {
            "symbol": symbol,
            "cash_flow": cash_flow_dict
        }
        return jsonify(response)
    except Exception as e:
        return jsonify({"error": str(e)}), 400
def safe_round(value, decimals=2):
        # Function to safely round values, converting NaN to "N/A"
        return round(value, decimals) if isinstance(value, (int, float)) and not (value != value) else "N/A"  # value != value checks for NaN

@app.route('/8pillars')
def eight_pillars():
    return render_template("8pillars.html")

@app.route('/api/8pillars')
def get_eight_pillars():
    symbol = request.args.get('symbol', 'AAPL').upper()  # Default to AAPL if no symbol provided
    stock_data = fetch_stock_data(symbol)
    
    try:
        financials = stock_data['financials']
        balance_sheet = stock_data['balance_sheet']
        cash_flow = stock_data['cash_flow']
        info = stock_data['info']

        # Calculate 8 Pillars
        eight_pillars = {
            "PE Ratio < 22.5": safe_round(info.get('forwardPE', 'N/A'), 2),
            "ROIC > 10": calculate_roic(financials, balance_sheet),
            "Revenue Growth": calculate_growth(financials.loc['Total Revenue']),
            "Net Income Growth": calculate_growth(financials.loc['Net Income']),
            "Shares Outstanding Change": calculate_shares_change(balance_sheet),
            "LTL / 4 Yr FCF < 5": safe_round(calculate_ltl(balance_sheet, cash_flow), 2),
            "Free Cash Flow Growth": calculate_growth(cash_flow.loc['Free Cash Flow']),
            "Price to Free Cash Flow": calculate_price_to_free_cash_flow(info, cash_flow)
        }

        response = {
            "symbol": symbol,
            "eight_pillars": eight_pillars
        }
        return jsonify(response)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

def calculate_roic(financials, balance_sheet):
    latest_period = financials.columns[0]

    def get_item(df, possible_labels):
        for label in possible_labels:
            if label in df.index:
                return df.loc[label][latest_period]
        return None

    try:
        operating_income = get_item(financials, ['Operating Income', 'EBIT'])
        income_before_tax = get_item(financials, ['Income Before Tax', 'Pretax Income', 'Earnings Before Tax', 'EBT'])
        income_tax_expense = get_item(financials, ['Income Tax Expense', 'Provision for Income Taxes', 'Tax Provision'])

        if not all([operating_income, income_before_tax, income_tax_expense]):
            return 'N/A'

        effective_tax_rate = income_tax_expense / income_before_tax if income_before_tax != 0 else 0
        nopat = operating_income * (1 - effective_tax_rate)

        total_equity = get_item(balance_sheet, ['Total Stockholder Equity', "Total Shareholder's Equity", "Stockholders Equity"])
        short_term_debt = get_item(balance_sheet, ['Short Long Term Debt', 'Short Term Debt', 'Current Portion of Long Term Debt']) or 0
        long_term_debt = get_item(balance_sheet, ['Long Term Debt', 'Long-Term Debt']) or 0
        cash = get_item(balance_sheet, ['Cash', 'Cash And Cash Equivalents']) or 0
        short_term_investments = get_item(balance_sheet, ['Short Term Investments', 'Short-Term Investments']) or 0

        invested_capital = total_equity + short_term_debt + long_term_debt - (cash + short_term_investments)

        if invested_capital == 0:
            return 'N/A'

        roic = (nopat / invested_capital) * 100
        return round(roic, 2)
    except Exception as e:
        return 'N/A'

def calculate_shares_change(balance_sheet):
    try:
        shares_outstanding = balance_sheet.loc['Share Issued']
        shares_change = safe_round((((shares_outstanding.iloc[0] - shares_outstanding.iloc[-1]) / shares_outstanding.iloc[-1]) * 100), 2)
        return shares_change
    except:
        return 'N/A'
def calculate_ltl(balance_sheet,cash_flow):
    try:
        # Extract the operating cash flow and capital expenditures for the last 4 years
        operating_cash_flows = cash_flow.loc['Operating Cash Flow'].values[:4]
        capex = cash_flow.loc['Capital Expenditure'].values[:4]
        debt = balance_sheet.loc['Long Term Debt'].iloc[0]
        # Calculate free cash flow for the last 4 years
        free_cash_flows = [op_cf + capex_val for op_cf, capex_val in zip(operating_cash_flows, capex)]
        free_cash_flows_billion = [fcf for fcf in free_cash_flows]  # Convert to billions

        # Calculate the 4-year average free cash flow
        avg_free_cash_flow = round(sum(free_cash_flows_billion), 2)

        ltl = debt / avg_free_cash_flow
        return ltl
    except:
        return 'N/A'

def calculate_growth(series):
    try:
        growth = (series.iloc[0] - series.iloc[3]) / series.iloc[3]
        return safe_round(growth * 100, 2)  # Convert to percentage
    except:
        return 'N/A'

def calculate_price_to_free_cash_flow(info, cash_flow):
    try:
        market_cap = info.get('marketCap', 0)
        free_cash_flow = cash_flow.loc['Free Cash Flow'].iloc[0]
        price_to_fcf = market_cap / free_cash_flow
        return safe_round(price_to_fcf, 2)
    except:
        return 'N/A'

@app.route('/recomendations')
def recomendations():
    return render_template("recomendations.html")
@app.route('/api/recomendations')
def get_recomendations():
    symbol = request.args.get('symbol').upper()  # Default to AAPL if no symbol provided
    print("Fetching recomendations...", symbol)
    stock_data = fetch_stock_data(symbol)

    try:
       # Fetch recomendations
        recomendations = stock_data['recommendations']
        recomendations_summary = stock_data['recommendations_summary']
        upgrades_downgrades = stock_data['upgrades_downgrades']
        upgrades_downgrades = upgrades_downgrades.iloc[:5]

        recomendations = recomendations.fillna("N/A").infer_objects(copy=False)
        recomendations_summary = recomendations_summary.fillna("N/A").infer_objects(copy=False)
        upgrades_downgrades = upgrades_downgrades.fillna("N/A").infer_objects(copy=False)

        recomendations.index = pd.to_datetime(recomendations.index, errors='coerce')
        recomendations_summary.index = pd.to_datetime(recomendations_summary.index, errors='coerce')
        upgrades_downgrades.index = pd.to_datetime(upgrades_downgrades.index, errors='coerce')

        # Add GradeDate from the index
        upgrades_downgrades['GradeDate'] = upgrades_downgrades.index.strftime('%Y-%m-%d')

        # Convert DataFrames to dictionaries
        recomendations = recomendations.to_dict(orient='records')
        recomendations_summary = recomendations_summary.to_dict(orient='records')
        upgrades_downgrades = upgrades_downgrades.to_dict(orient='records')

        # Prepare response data
        response = {
            "symbol": symbol,
            "recomendations": recomendations,
            "recomendations_summary": recomendations_summary,
            "upgrades_downgrades": upgrades_downgrades
        }
        return jsonify(response)
    except Exception as e:
        print("Error ", e)
        return jsonify({"error": str(e)}), 400    

@app.route('/analyst_estimates')
def analyst_estimates():
    return render_template("analyst_estimates.html")

@app.route('/api/analyst_estimates')
def get_analyst_estimates():
    symbol = request.args.get('symbol').upper()  # Default to AAPL if no symbol provided
    print("Fetching analyst estimates...", symbol)
    stock_data = fetch_stock_data(symbol)

    try:
       # Fetch analyst estimates
        analyst_price_targets = stock_data['analyst_price_targets']
        earnings_estimate = stock_data['earnings_estimate']
        revenue_estimate = stock_data['revenue_estimate']
        earnings_history = stock_data['earnings_history']
        eps_trend = stock_data['eps_trend']
        eps_revisions = stock_data['eps_revisions']
        growth_estimates = stock_data['growth_estimates']
        recomendations = stock_data['recommendations']
        recomendations_summary = stock_data['recommendations_summary']
        upgrades_downgrades = stock_data['upgrades_downgrades']

        earnings_estimate = earnings_estimate.fillna("N/A").infer_objects(copy=False)
        revenue_estimate = revenue_estimate.fillna("N/A").infer_objects(copy=False)
        earnings_history = earnings_history.fillna("N/A").infer_objects(copy=False)
        eps_trend = eps_trend.fillna("N/A").infer_objects(copy=False)
        growth_estimates = growth_estimates.fillna("N/A").infer_objects(copy=False)

        earnings_estimate.index = pd.to_datetime(earnings_estimate.index, errors='coerce')
        revenue_estimate.index = pd.to_datetime(revenue_estimate.index, errors='coerce')
        earnings_history.index = pd.to_datetime(earnings_history.index, errors='coerce')
        eps_trend.index = pd.to_datetime(eps_trend.index, errors='coerce')
        growth_estimates.index = pd.to_datetime(growth_estimates.index, errors='coerce')


        # Convert DataFrames to dictionaries
        earnings_estimate = earnings_estimate.to_dict(orient='records')
        revenue_estimate = revenue_estimate.to_dict(orient='records')
        earnings_history = earnings_history.to_dict(orient='records')
        eps_trend = eps_trend.to_dict(orient='records')
        eps_revisions = eps_revisions.to_dict(orient='records')
        growth_estimates = growth_estimates.to_dict(orient='records')



        # Prepare response data
        response = {
            "symbol": symbol,
            "analyst_price_targets": analyst_price_targets,
            "earnings_estimate": earnings_estimate,
            "revenue_estimate": revenue_estimate,
            "earnings_history": earnings_history,
            "eps_trend": eps_trend,
            "eps_revisions": eps_revisions,
            "growth_estimates": growth_estimates
        }
        return jsonify(response)
    except Exception as e:
        print("Error ", e)
        return jsonify({"error": str(e)}), 400
    
@app.route('/ai')
def ai_opinion():
    return render_template("ai.html")

@app.route('/api/ai_opinion')
def get_ai_opinion():
    symbol = request.args.get('symbol', 'AAPL').upper()  # Default to AAPL if no symbol provided
    stock_data = fetch_stock_data(symbol)

    try:
        # Fetch necessary stock data
        financials = stock_data.get('financials', {})
        balance_sheet = stock_data.get('balance_sheet', {})
        cash_flow = stock_data.get('cash_flow', {})
        stock_info = stock_data.get('stock_info', {})

        # Prepare data to send to OpenAI
        prompt = (
            f"Financials: {financials}\n"
            f"Balance Sheet: {balance_sheet}\n"
            f"Cash Flow: {cash_flow}\n"
            f"Stock Info: {stock_info}\n"
        )

        system_message = (
            f"You are a professional financial analyst and stocks trader. "
            f"Based on the following financial data for ({symbol}), provide a detailed financial analysis "
            f"and investment recommendation. Include discussions on its financial health, market position, growth prospects, "
            f"and any potential risks.When you provide multibagger potential calculate it for the 2 following years\n\n"
            f"Key Financial Metrics:\n"
            f"{prompt}"
        )
        user_message = (
            f"Provide short view about company situation. "
            f"Provide final decision in following format: ***Investment Attractiveness: 1/10 ***Multibagger Potential: 1/10 ***Shares: Overvalued/Undervalued. "
            f"Your answer must fit into 150 words."
        )

        # Call the OpenAI API for chat models
        
        response = client.chat.completions.create(
            model='gpt-4o',  # Ensure the correct chat model is used
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            max_tokens=1000,
            temperature=0.7,
            n=1,
        )
        # Extract token usage information
        prompt_tokens = response.usage.prompt_tokens
        completion_tokens = response.usage.completion_tokens
        total_tokens = response.usage.total_tokens
        print(f"Tokens used: Prompt tokens: {prompt_tokens} Completion tokens: {completion_tokens} Total: {total_tokens}")

        # Access the response
        ai_opinion = response.choices[0].message.content.strip().replace("***", "<br>")
        # Prepare response data
        response_data = {
            "symbol": symbol,
            "ai_opinion": ai_opinion
        }
        return jsonify(response_data)
    except Exception as e:
        print("Error ", e)
        return jsonify({"error": str(e)}), 400

@app.route('/news')
def news():
    return render_template("news.html")
@app.route('/api/news')
def get_news():
    symbol = request.args.get('symbol', 'AAPL').upper()  # Default to AAPL if no symbol provided
    stock_data = fetch_stock_data(symbol)

    try:
        # Fetch news data
        news = stock_data['news']
        response_data = {
            "symbol": symbol,
            "news": news
        }
        return jsonify(response_data)
    except Exception as e:
        print("Error ", e)
        return jsonify({"error": str(e)}), 400
@app.route('/dividends')
def dividends():
    return render_template("dividends.html")
@app.route('/api/dividends')
def get_dividends():
    print("Fetching dividends...")
    symbol = request.args.get('symbol', 'AAPL').upper()  # Default to AAPL if no symbol provided
    stock_data = fetch_stock_data(symbol)

    try:
        # Fetch dividends data
        dividends = stock_data['dividends']
        dividends_dict = {str(date): value for date, value in dividends.items()}
        response_data = {
            "symbol": symbol,
            "dividends": dividends_dict
        }
        return jsonify(response_data)
    except Exception as e:
        print("Error ", e)
        return jsonify({"error": str(e)}), 400

@app.route('/api/annual_reports')
def get_annualReports():
    symbol = request.args.get('symbol', 'AAPL').upper()  # Default to AAPL if no symbol provided
    try:
        # Make request to SEC API with headers
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
        response_data = {
            "symbol": symbol,
            "link": sec_link
        }
        return jsonify(response_data)
    except Exception as e:
        print("Error ", e)
        return jsonify({"error": str(e)}), 400
    

if __name__ == "__main__":
    app.run(debug=True)