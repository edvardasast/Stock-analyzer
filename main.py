from flask import Flask, render_template, jsonify, request
import yfinance as yf
import pandas as pd

app = Flask(__name__)

@app.route("/")
def home():
    return render_template("base.html")

@app.route("/metrics")
def metrics():
    return render_template("metrics.html")

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

# API route to get stock data
@app.route("/api/stock_data")
def get_stock_data():
    symbol = request.args.get('symbol').upper()
    range_param = request.args.get('range', '5Y')  # Default to 5Y if no range is provided

    if not symbol:
        return jsonify({"error": "Stock symbol is required"}), 400

    try:
        stock = yf.Ticker(symbol)
        stock_info = stock.info
        # Get the corresponding period for the selected range
        period = range_mapping.get(range_param, '5y')

        
        # Get the historical income statement (last 5 years)
        income_statement = stock.financials
    
        # Extract net income (Net Income Applicable to Common Shares)
        # The data is in reverse chronological order, so we get the last 5 years of net income
        net_incomes = income_statement.loc['Net Income'].values[:4]  # In USD

        # Convert the net income values to billions and round to 2 decimal places
        net_incomes_billion = [round(net_income / 1e9, 2) for net_income in net_incomes]
    
        # Calculate the 5-year average net income
        four_year_avg_net_income = round(sum(net_incomes_billion) / len(net_incomes_billion), 2)
        
        # Extract the net income and total revenue for the last 4 years
        # The data is in reverse chronological order, so we get the last 4 years
        net_incomes = income_statement.loc['Net Income'].values[:4]  # Net Income in USD
        revenues = income_statement.loc['Total Revenue'].values[:4]  # Total Revenue in USD
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
        
        # Convert to percentage and round to 2 decimal places
        cagr_percentage = round(cagr * 100, 2)

        # Get the cash flow statement
        cash_flow_statement = stock.cashflow
        #print(cash_flow_statement)
        # Extract the operating cash flow and capital expenditures for the last 4 years
        operating_cash_flows = cash_flow_statement.loc['Operating Cash Flow'].values[:4]
        capex = cash_flow_statement.loc['Capital Expenditure'].values[:4]

        # Calculate free cash flow for the last 4 years
        free_cash_flows = [op_cf + capex_val for op_cf, capex_val in zip(operating_cash_flows, capex)]

        # Convert free cash flow values to billions and round to 2 decimal places
        free_cash_flows_billion = [round(fcf / 1e9, 2) for fcf in free_cash_flows]

        #Dividends Paid
        dividend_paid = abs(cash_flow_statement.loc['Cash Dividends Paid'].values[0])

        # Calculate the 4-year average free cash flow
        avg_free_cash_flow = round(sum(free_cash_flows_billion) / len(free_cash_flows_billion), 2)
        stock_data = {
            # Market Cap, Revenue, Net Income
            'market_cap': round(stock_info.get('marketCap', 0) / 1e12, 2),  # Convert to Trillions
            'revenue': round(stock_info.get('totalRevenue', 0) / 1e9, 2),   # Convert to Billions
            'net_income': round(stock_info.get('netIncomeToCommon', 0) / 1e9, 2),  # Convert to Billions
            'four_year_avg_net_income': four_year_avg_net_income,  # Convert to Billions

            # Profitability Ratios
            'pe_ratio': round(stock_info.get('trailingPE', 'N/A'), 2),
            'ps_ratio': round(stock_info.get('priceToSalesTrailing12Months', 'N/A'), 2),
            'profit_margin': round(stock_info.get('profitMargins', 0) * 100, 2),  # Convert to percentage
            'four_year_profit_margin': round((total_net_income/total_revenue) * 100,2),  # Convert to percentage
            'gross_profit_margin': round(stock_info.get('grossMargins', 0) * 100, 2),  # Convert to percentage

            # Revenue Growth
            'three_year_revenue_growth': cagr_percentage,  # Convert to percentage

            # Free Cash Flow and Price Ratios
            'free_cash_flow': round(stock_info.get('freeCashflow', 0) / 1e9, 2),  # Convert to Billions
            'four_year_avg_fcf': avg_free_cash_flow,  # Convert to Billions
            'price_to_fcf': round(((stock_info.get('marketCap', 0) / 1e12)/(stock_info.get('freeCashflow', 0) / 1e9)) * 1000, 2),

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
        }

        # Price chart data (fetch historical price data for last month)
        hist = stock.history(period=period)
        #print(hist)
        # Convert the index to datetime and then format it to string dates
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
    stock = yf.Ticker(symbol)

    try:
        # Fetch income statement data
        financials = stock.financials.T  # Transpose to get years as rows
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
    stock = yf.Ticker(symbol)

    try:
        # Fetch balance sheet data
        balance = stock.balance_sheet  # Transpose to get years as rows
        # Transpose it so years are columns and metrics are rows
        balance = balance.T
        
        # Convert the index to strings to make it JSON serializable
        balance.index = balance.index.strftime('%Y-%m-%d')

        # Replace NaN values with 'N/A' (use .fillna method)
        balance = balance.fillna('N/A')

        # Convert DataFrame to dictionary for JSON serialization
        balance_sheet = balance.to_dict(orient="index")
        # Prepare response data
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
    stock = yf.Ticker(symbol)

    try:
        # Fetch the cash flow data (note: use stock.cashflow, not stock.cashflow())
        cash_flow = stock.cashflow.T  # Transpose to get years as rows

        # Convert the index (years) to strings for JSON serialization
        cash_flow.index = cash_flow.index.strftime('%Y-%m-%d')

        # Replace NaN values with 'N/A' (use .fillna method)
        cash_flow = cash_flow.fillna('N/A')

        # Convert DataFrame to dictionary for JSON serialization
        cash_flow_dict = cash_flow.to_dict(orient="index")

        # Prepare response data
        response = {
            "symbol": symbol,
            "cash_flow": cash_flow_dict
        }
        return jsonify(response)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/eight_pillars')
def eight_pillars():
    return render_template("eight_pillars.html")

@app.route('/api/eight_pillars')
def get_eight_pillars():
    symbol = request.args.get('symbol', 'AAPL').upper()  # Default to AAPL if no symbol provided
    stock = yf.Ticker(symbol)

    try:
        # Fetch 8pillars data (assuming it's available as stock.eight_pillars)
        eight_pillars = stock.eight_pillars.T  # Transpose to get years as rows

        # Convert the index (years) to strings for JSON serialization
        eight_pillars.index = eight_pillars.index.strftime('%Y-%m-%d')

        # Replace NaN values with 'N/A' (use .fillna method)
        eight_pillars = eight_pillars.fillna('N/A')

        # Convert DataFrame to dictionary for JSON serialization
        eight_pillars_dict = eight_pillars.to_dict(orient="index")

        # Prepare response data
        response = {
            "symbol": symbol,
            "eight_pillars": eight_pillars_dict
        }
        return jsonify(response)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


if __name__ == "__main__":
    app.run(debug=True)
