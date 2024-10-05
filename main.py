from flask import Flask, render_template, jsonify, request
import yfinance as yf
import pandas as pd

app = Flask(__name__)

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

@app.route('/8pillars')
def eight_pillars():
    return render_template("8pillars.html")

@app.route('/api/8pillars')
def get_eight_pillars():
    symbol = request.args.get('symbol', 'AAPL').upper()  # Default to AAPL if no symbol provided
    stock = yf.Ticker(symbol)

    try:
        # Fetch necessary data
        financials = stock.financials
        balance_sheet = stock.balance_sheet
        cash_flow = stock.cashflow
        info = stock.info
        #balance_sheet.to_csv(f'{symbol}_balance_sheet.csv')
        #financials.to_csv(f'{symbol}_financials.csv')
        #cash_flow.to_csv(f'{symbol}_cash_flow.csv')
        #info.to_csv(f'{symbol}_info.csv')
        
        # Calculate 8 Pillars
        eight_pillars = {
            "PE Ratio": round(info.get('forwardPE', 'N/A'),2),
            "ROIC %": calculate_roic(financials, balance_sheet),
            "Revenue Growth": calculate_growth(financials.loc['Total Revenue']),
            "Net Income Growth": calculate_growth(financials.loc['Net Income']),
            "Shares Outstanding Change %": calculate_shares_change(balance_sheet),
            "Long-term Debt B": round(convert_series_to_dict(balance_sheet.loc['Long Term Debt'].iloc[0]) / 1e9, 2),
            "Free Cash Flow Growth": calculate_growth(cash_flow.loc['Free Cash Flow']),
            "Price to Free Cash Flow": calculate_price_to_free_cash_flow(info, cash_flow)
        }
        print("Outstanding shares", balance_sheet.loc['Common Stock'])
        # Prepare response data
        response = {
            "symbol": symbol,
            "eight_pillars": eight_pillars
        }
        return jsonify(response)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

def calculate_roic(financials, balance_sheet):
    print("Calling ROIC")
    # Get the latest fiscal period (most recent column)
    latest_period = financials.columns[0]
    # Helper function to get item from DataFrame
    def get_item(df, possible_labels):
        for label in possible_labels:
            if label in df.index:
                return df.loc[label][latest_period]
        return None  # Return None if none of the labels are found
    
    # Calculate NOPAT
    try:
        # Possible labels for Operating Income
        operating_income_labels = ['Operating Income', 'EBIT']
        operating_income = get_item(financials, operating_income_labels)
        if operating_income is None:
            print("Operating Income not found in income statement.")
            return None
        
        # Possible labels for Income Before Tax
        income_before_tax_labels = ['Income Before Tax', 'Pretax Income', 'Earnings Before Tax', 'EBT']
        income_before_tax = get_item(financials, income_before_tax_labels)
        if income_before_tax is None:
            print("Income Before Tax not found in income statement.")
            return None
        
        # Possible labels for Income Tax Expense
        income_tax_expense_labels = ['Income Tax Expense', 'Provision for Income Taxes', 'Tax Provision']
        income_tax_expense = get_item(financials, income_tax_expense_labels)
        if income_tax_expense is None:
            print("Income Tax Expense not found in income statement.")
            return None
        
        # Effective Tax Rate
        if income_before_tax != 0:
            effective_tax_rate = income_tax_expense / income_before_tax
        else:
            effective_tax_rate = 0
        
        # NOPAT
        nopat = operating_income * (1 - effective_tax_rate)
    except KeyError as e:
        print(f"Key error in income statement data: {e}")
        return None
    except Exception as e:
        print(f"Error calculating NOPAT: {e}")
        return None
    
    # Calculate Invested Capital
    try:
        # Possible labels for Total Equity
        total_equity_labels = ['Total Stockholder Equity', "Total Shareholder's Equity", "Stockholders Equity"]
        total_equity = get_item(balance_sheet, total_equity_labels)
        if total_equity is None:
            print("Total Equity not found in balance sheet.")
            return None
        
        # Possible labels for Short-Term Debt
        short_term_debt_labels = ['Short Long Term Debt', 'Short Term Debt', 'Current Portion of Long Term Debt']
        short_term_debt = get_item(balance_sheet, short_term_debt_labels)
        if short_term_debt is None:
            short_term_debt = 0  # Assume zero if not found
        
        # Possible labels for Long-Term Debt
        long_term_debt_labels = ['Long Term Debt', 'Long-Term Debt']
        long_term_debt = get_item(balance_sheet, long_term_debt_labels)
        if long_term_debt is None:
            long_term_debt = 0  # Assume zero if not found
        
        total_debt = short_term_debt + long_term_debt
        
        # Possible labels for Cash and Equivalents
        cash_labels = ['Cash', 'Cash And Cash Equivalents']
        cash = get_item(balance_sheet, cash_labels)
        if cash is None:
            cash = 0  # Assume zero if not found
        
        short_term_investments_labels = ['Short Term Investments', 'Short-Term Investments']
        short_term_investments = get_item(balance_sheet, short_term_investments_labels)
        if short_term_investments is None:
            short_term_investments = 0  # Assume zero if not found
        
        cash_and_equivalents = cash + short_term_investments
        
        # Invested Capital
        invested_capital = total_equity + total_debt - cash_and_equivalents
    except KeyError as e:
        print(f"Key error in balance sheet data: {e}")
        return None
    except Exception as e:
        print(f"Error calculating Invested Capital: {e}")
        return None
    
    # Handle potential division by zero
    if invested_capital == 0:
        print("Invested Capital is zero, cannot calculate ROIC.")
        return None
    # Calculate ROIC
    roic = (nopat / invested_capital) * 100  # Convert to percentage

    # Output the results
    print(f"Fiscal Period Ending: {latest_period.date()}")
    print(f"NOPAT: ${nopat:,.2f}")
    print(f"Invested Capital: ${invested_capital:,.2f}")
    print(f"ROIC: {roic:.2f}%")

    return round(roic, 2)
    

def calculate_shares_change(balance_sheet):
    try:
        shares_outstanding = balance_sheet.loc['Common Stock']
        print("Share iloc -1 ", shares_outstanding.iloc[-1])
        shares_change = round((((shares_outstanding.iloc[0] - shares_outstanding.iloc[-1]) / shares_outstanding.iloc[-1]) * 100), 2)
        return convert_series_to_dict(shares_change) if isinstance(shares_change, pd.Series) else shares_change
    except:
        return 'N/A'
    
def calculate_growth(series):
    try:
        growth = (series.iloc[0] - series.iloc[-1]) / series.iloc[-1]
        return convert_series_to_dict(round(growth,2)) if isinstance(round(growth,2), pd.Series) else round(growth,2)
    except:
        return 'N/A'

def calculate_price_to_free_cash_flow(info, cash_flow):
    try:
        market_cap = info.get('marketCap', 0)
        free_cash_flow = cash_flow.loc['Free Cash Flow'].iloc[0]
        price_to_fcf = market_cap / free_cash_flow
        return round(price_to_fcf,2)
    except:
        return 'N/A'

def convert_series_to_dict(data):
    if isinstance(data, pd.Series):
        return {str(key): value for key, value in data.items()}
    elif isinstance(data, float) or isinstance(data, int):  # Handle single float/int values
        return data
    else:
        return 'N/A'  # In case of unknown types

if __name__ == "__main__":
    app.run(debug=True)
