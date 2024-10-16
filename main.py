import os
import tempfile
from apscheduler.schedulers.background import BackgroundScheduler
import atexit
import logging
from flask import Flask, render_template, jsonify, request, session
from flask_session import Session
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy import inspect
import requests
import yfinance as yf
import pandas as pd
import threading
import numpy as np
import yahooquery as yq
from datetime import datetime
from werkzeug.utils import secure_filename
from openai import OpenAI
from dotenv import load_dotenv

# Custom modules (ensure these are available in your project)
from utils.gov_scraper import get_yearly_report, get_quarterly_report
from utils.news_downloader import download_news

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')

# Session configuration
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_FILE_DIR'] = tempfile.gettempdir()
app.config['SESSION_PERMANENT'] = False
Session(app)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Upload folder configuration
UPLOAD_FOLDER = 'data'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


pd.set_option('future.no_silent_downcasting', True)

# OpenAI API Key
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
client = OpenAI(
  api_key=OPENAI_API_KEY,  # this is also the default, it can be omitted
)
# Validate API keys
if not app.secret_key:
    raise ValueError("No SECRET_KEY set for Flask application. Please set it in your .env file.")
if not OPENAI_API_KEY:
    raise ValueError("No OPENAI_API_KEY found. Please set it in your .env file.")

# Global cache to store yfinance data
data_cache = {}

# Initialize the scheduler
#scheduler = BackgroundScheduler()

# Map ranges to yfinance period parameters
RANGE_MAPPING = {
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

# Database Models
class StockHolding(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.String(20), nullable=False)
    ticker = db.Column(db.String(10), nullable=False)
    type = db.Column(db.String(20), nullable=False)
    quantity = db.Column(db.Float, nullable=False)
    price_per_share = db.Column(db.Float, nullable=False)
    total_amount = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(10), nullable=False)
    fx_rate = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            'date': self.date,
            'ticker': self.ticker,
            'type': self.type,
            'quantity': self.quantity,
            'price_per_share': self.price_per_share,
            'total_amount': self.total_amount,
            'currency': self.currency,
            'fx_rate': self.fx_rate
        }

# Add the StockInfo model
class StockInfo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    ticker = db.Column(db.String(10), nullable=False, unique=True)
    info = db.Column(JSON, nullable=False)

    def __repr__(self):
        return f"<StockInfo {self.ticker}>"

    def to_dict(self):
        return {
            'ticker': self.ticker,
            'info': self.info
        }
class StockHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    ticker = db.Column(db.String(10), nullable=False)
    date = db.Column(db.String(20), nullable=False)
    close = db.Column(db.Float, nullable=False)
    high = db.Column(db.Float, nullable=False)
    low = db.Column(db.Float, nullable=False)
    open = db.Column(db.Float, nullable=False)
    volume = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            'ticker': self.ticker,
            'date': self.date,
            'close': self.close,
            'high': self.high,
            'low': self.low,
            'open': self.open,
            'volume': self.volume
        }
# Helper Functions
def migrate_history_data():
    stock_infos = StockInfo.query.all()
    for stock_info in stock_infos:
        history = stock_info.history
        if history:
            for entry in history:
                stock_history = StockHistory(
                    ticker=stock_info.ticker,
                    date=entry['Date'],
                    close=entry['Close'],
                    high=entry['High'],
                    low=entry['Low'],
                    open=entry['Open'],
                    volume=entry['Volume']
                )
                db.session.add(stock_history)
    db.session.commit()
    print("Migration completed.")

def update_stock_info():
    with app.app_context():
        print("Updating stock info for all portfolio tickers...")
        logging.info("Updating stock info for all portfolio tickers...")
        # Fetch all unique tickers from the portfolio
        tickers = db.session.query(StockHolding.ticker).distinct().all()
        tickers = [t[0] for t in tickers]  # Extract ticker strings
        first_date_str = db.session.query(StockHolding).first().date
        first_date = datetime.strptime(first_date_str, '%Y-%m-%dT%H:%M:%S.%fZ').strftime('%Y-%m-%d')
        print("first: ", first_date)
        enddate = datetime.now().strftime('%Y-%m-%d')
        print("end: ", enddate)
        #enddate = datetime.strptime(first_date, "%Y-%m-%d").date()
        #startdate = enddate - datetime.timedelta(days=365*5) # for 5 years
        for ticker in tickers:
            print(f"Updating info for {ticker}")
            try:
                stock = yf.Ticker(ticker)
                info = stock.info
                history = stock.history(start=first_date, end=enddate, interval="1d")
                history = history.reset_index()
                history['Date'] = history['Date'].apply(lambda x: x.isoformat())

                # Convert the DataFrame to a list of dictionaries (JSON serializable)
                history_dict = history.to_dict(orient='records')
                # Handle NaN values in history data
                history_dict = replace_nan(history_dict)
                for _, entry in history.iterrows():
                    stock_history_entry = StockHistory.query.filter_by(ticker=ticker, date=entry['Date']).first()
                    if stock_history_entry:
                        # Update existing entry
                        stock_history_entry.close = entry['Close']
                        stock_history_entry.high = entry['High']
                        stock_history_entry.low = entry['Low']
                        stock_history_entry.open = entry['Open']
                        stock_history_entry.volume = entry['Volume']
                    else:
                        # Create new entry
                        stock_history_entry = StockHistory(
                            ticker=ticker,
                            date=entry['Date'],
                            close=entry['Close'],
                            high=entry['High'],
                            low=entry['Low'],
                            open=entry['Open'],
                            volume=entry['Volume']
                        )
                        db.session.add(stock_history_entry)
                db.session.commit()
                if info:
                    # Check if StockInfo entry exists
                    stock_info_entry = StockInfo.query.filter_by(ticker=ticker).first()
                    if stock_info_entry:
                        # Update existing entry
                        stock_info_entry.info = info
                    else:
                        # Create new entry
                        stock_info_entry = StockInfo(ticker=ticker, info=info)
                        db.session.add(stock_info_entry)
                    db.session.commit()
                    #print(f"Updated info for {ticker}")
                else:
                    print(f"No info found for {ticker}")
            except Exception as e:
                print(f"Error updating info for {ticker}: {e}")
                pass
        print(f"Stock info update finished")   
# Add the job to the scheduler
""" scheduler.add_job(func=update_stock_info, trigger="interval", minutes=5)
def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
# Function to start the scheduler in a separate thread
def start_scheduler():
    logging.info("Starting scheduler...")
    scheduler.start()
    print("Scheduler started.")
    atexit.register(shutdown_scheduler) """

def calculate_cagr(revenue_start, revenue_end, years):
    return ((revenue_end / revenue_start) ** (1 / years)) - 1

def replace_nan(obj):
    if isinstance(obj, float) and np.isnan(obj):
        return None
    elif isinstance(obj, dict):
        return {k: replace_nan(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [replace_nan(i) for i in obj]
    return obj

def safe_round(value, decimals=2):
    if isinstance(value, (int, float)) and not np.isnan(value):
        return round(value, decimals)
    else:
        return "N/A"

def fetch_stock_data(symbol):
    if symbol in data_cache:
        return data_cache[symbol]
    print("Fetching stock data...", symbol)
    stock = yf.Ticker(symbol)
    stock_info = stock.info
    if not stock_info:
        raise ValueError(f"No data found for symbol: {symbol}")
    if stock_info == {'trailingPegRatio': None}:
        correctTicker = yq.search(symbol, first_quote=True)
        symbol = correctTicker['symbol']
        stock = yf.Ticker(symbol)
        stock_info = stock.info

    data_cache[symbol] = {
        'info': stock_info,
        'financials': stock.financials,
        'quarterly_financials': stock.quarterly_financials,
        'balance_sheet': stock.balance_sheet,
        'quarterly_balance_sheet': stock.quarterly_balance_sheet,
        'cash_flow': stock.cashflow,
        'quarterly_cash_flow': stock.quarterly_cashflow,
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
    etf = yf.Ticker('QDVE.DE')
    data = etf.funds_data
    print("ETF data: ", data.description)
    print("ETF data: ", data.fund_overview)
    print("ETF data: ", data.fund_operations)
    print("ETF data: ", data.asset_classes)
    print("ETF data: ", data.top_holdings)
    print("ETF data: ", data.equity_holdings)
    print("ETF data: ", data.bond_holdings)
    print("ETF data: ", data.bond_ratings)
    print("ETF data: ", data.sector_weightings)
    
    #print("Stock data fetched.", stock.quarterly_financials)
    return data_cache[symbol]

def parse_and_store_statement(file_path):
    df = pd.read_csv(file_path)
    # Clean up column names to match database fields
    df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_').str.replace('/', '_')
    
    # Ensure 'ticker' is read as a string and handle NaN values
    df['ticker'] = df['ticker'].fillna('').astype(str)
    df['ticker'] = df['ticker'].apply(lambda x: x.upper())
    
    # Handle other potential NaN values in the DataFrame
    df['date'] = df['date'].fillna('')
    df['type'] = df['type'].fillna('')
    df['currency'] = df['currency'].fillna('')
    df['quantity'] = df['quantity'].fillna(0)
    df['price_per_share'] = df['price_per_share'].fillna(0)
    df['total_amount'] = df['total_amount'].fillna(0)
    df['fx_rate'] = df['fx_rate'].fillna(0)
    
    # Clean numerical fields to remove currency symbols and commas
    def clean_numeric(value):
        if isinstance(value, str):
            # Remove currency symbols and commas
            value = value.replace('$', '').replace(',', '').replace('€', '').replace('£', '').replace('‚Ç¨', '')
        try:
            return float(value)
        except ValueError:
            return 0.0  # or handle it as you see fit
    db.session.query(StockHolding).delete()
    for index, row in df.iterrows():
        try:
            holding = StockHolding(
                date=row['date'],
                ticker=row['ticker'],
                type=row['type'],
                quantity=clean_numeric(row['quantity']),
                price_per_share=clean_numeric(row['price_per_share']),
                total_amount=clean_numeric(row['total_amount']),
                currency=row['currency'],
                fx_rate=clean_numeric(row['fx_rate'])
            )
            db.session.add(holding)
        except Exception as e:
            print(f"Error processing row {index}: {e}")
    db.session.commit()
    print("Portfolio data saved to the database.")


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
        print("Error calculating ROIC:", e)
        return 'N/A'

def calculate_shares_change(balance_sheet):
    try:
        shares_outstanding = balance_sheet.loc['Share Issued']
        shares_change = safe_round((((shares_outstanding.iloc[0] - shares_outstanding.iloc[-1]) / shares_outstanding.iloc[-1]) * 100), 2)
        return shares_change
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

def calculate_ltl(balance_sheet, cash_flow):
    try:
        operating_cash_flows = cash_flow.loc['Operating Cash Flow'].values[:4]
        capex = cash_flow.loc['Capital Expenditure'].values[:4]
        debt = balance_sheet.loc['Long Term Debt'].iloc[0]
        free_cash_flows = [op_cf + capex_val for op_cf, capex_val in zip(operating_cash_flows, capex)]
        avg_free_cash_flow = sum(free_cash_flows)
        ltl = debt / avg_free_cash_flow
        return safe_round(ltl, 2)
    except:
        return 'N/A'

# Routes
@app.route('/api/clear_table', methods=['GET'])
def clear_table():
    table_name = request.args.get('table_name')

    if not table_name:
        return jsonify({"error": "Missing required parameter: table_name"}), 400

    # Check if the table exists
    inspector = inspect(db.engine)
    if table_name not in inspector.get_table_names():
        return jsonify({"error": f"Table '{table_name}' does not exist"}), 400

    # Clear the table
    try:
        table = db.Table(table_name, db.metadata, autoload_with=db.engine)
        db.session.execute(table.delete())
        db.session.commit()
        return jsonify({"message": f"Table '{table_name}' cleared successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/stock_history', methods=['GET'])
def get_stock_history():
    ticker = request.args.get('ticker')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if not ticker or not start_date or not end_date:
        return jsonify({"error": "Missing required parameters"}), 400
    if ticker == 'ALL':
        history = StockHistory.query.filter(
            StockHistory.date >= start_date,
            StockHistory.date <= end_date
        ).all()
    else:
        history = StockHistory.query.filter(
            StockHistory.ticker == ticker,
            StockHistory.date >= start_date,
            StockHistory.date <= end_date
        ).all()

    return jsonify([entry.to_dict() for entry in history])
@app.route('/api/stock_holdings', methods=['GET'])
def get_stock_holdings():
    ticker = request.args.get('ticker')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if not ticker or not start_date or not end_date:
        return jsonify({"error": "Missing required parameters"}), 400
    if ticker == 'ALL':
        holdings = StockHolding.query.filter(
            StockHolding.date >= start_date,
            StockHolding.date <= end_date
        ).all()
    else:
        holdings = StockHolding.query.filter(
            StockHolding.ticker == ticker,
            StockHolding.date >= start_date,
            StockHolding.date <= end_date
        ).all()

    return jsonify([entry.to_dict() for entry in holdings])
@app.route("/")
def home():
    return render_template("base.html")

@app.route("/stock_data")
def metrics():
    return render_template("stock_data.html")

@app.route('/database_view')
def database_view():
    return render_template("database_view.html")
@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file:
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        parse_and_store_statement(file_path)
        return jsonify({'success': True}), 200

@app.route('/portfolio')
def portfolio():
    return render_template("my_portfolio.html")

@app.route('/api/portfolio')
def get_portfolio():
    print("Fetching portfolio data from database...")
    holdings = StockHolding.query.all()
    if holdings:
        data = {}
        for holding in holdings:
            ticker = holding.ticker
            if ticker not in data:
                data[ticker] = []
            # Prepare the holding dictionary to match the JSON format
            holding_dict = {
                "Date": holding.date if holding.date else None,
                "Ticker": holding.ticker if holding.ticker else None,
                "Type": holding.type if holding.type else None,
                "Quantity": holding.quantity if holding.quantity is not None else "NaN",
                "Price per share": f"${holding.price_per_share:,.2f}" if holding.price_per_share is not None else "NaN",
                "Total Amount": f"${holding.total_amount:,.2f}" if holding.total_amount is not None else "NaN",
                "Currency": holding.currency if holding.currency else None,
                "FX Rate": holding.fx_rate if holding.fx_rate is not None else "NaN"
            }
            data[ticker].append(holding_dict)
        return jsonify(data)
    return jsonify({"error": "No portfolio data found"}), 404

@app.route('/api/portfolio_events', methods=['GET'])
def get_portfolio_events():
    # Get the starting date from query params
    start_date_str = request.args.get('date')
    print("start_date_str: ", start_date_str)
    if not start_date_str:
        return jsonify({"error": "Missing 'date' parameter"}), 400
    
    try:
        # Parse the start date
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format, expected YYYY-MM-DD"}), 400
    
    oldest_event = StockHolding.query.order_by(StockHolding.date.asc()).first()

    # Get the oldest event date from StockHolding
    oldest_event = StockHolding.query.order_by(StockHolding.date.asc()).first()

    if oldest_event:
        oldest_event_date = datetime.strptime(oldest_event.date.split('T')[0], "%Y-%m-%d")
        if start_date < oldest_event_date:
            start_date = oldest_event_date
            
    print("start_date: ", start_date) 
    # Fetch all stock holdings and their history from the database
    holdings = StockHolding.query.all()
    history = StockHistory.query.filter(StockHistory.date >= start_date).all()

    if not holdings:
        return jsonify({"error": "No portfolio data found"}), 404
    
    # Prepare a dictionary to store totalValue for each date
    value_by_date = {}
    invested_by_date = {}
    dividends_by_date = {}
    # Populate the value_by_date dictionary with total values from the holding's historical prices
    for hist in history:
        date = hist.date.split('T')[0] 
        if date not in value_by_date:
            value_by_date[date] = 0
            invested_by_date[date] = 0
            dividends_by_date[date] = 0
        # Calculate total value by summing up each holding's value on that date
        for holding in holdings:
            if hist.ticker == holding.ticker:
                if holding.type == 'BUY - MARKET' or holding.type == 'STOCK SPLIT' or holding.type == 'BUY - LIMIT' :
                    if holding.date.split('T')[0] <= date:
                        value_by_date[date] += hist.close * holding.quantity
                        invested_by_date[date] += holding.total_amount
                elif holding.type == 'SELL - MARKET' or holding.type == 'MERGER - CASH' or holding.type == 'SELL - LIMIT' or holding.type == 'SELL - STOP':
                    if holding.date.split('T')[0] <= date:
                        value_by_date[date] -= hist.close * holding.quantity
                        invested_by_date[date] -= holding.total_amount
                elif holding.type == 'DIVIDEND':
                    if holding.date.split('T')[0] <= date:
                        dividends_by_date[date] += holding.total_amount
    
    # Get a sorted list of all dates from history
    all_dates = sorted(value_by_date.keys())
    # Initialize the previous day values
    previous_value = 0
    previous_invested = 0
    previous_dividends = 0

    # Accumulate values for days without transactions
    for date in all_dates:
        # If no new value on this date, carry over from previous day
        if date not in value_by_date:
            value_by_date[date] = previous_value
        if date not in invested_by_date:
            invested_by_date[date] = previous_invested
        if date not in dividends_by_date:
            dividends_by_date[date] = previous_dividends
        
        # Update previous values for the next iteration
        previous_value = value_by_date[date]
        previous_invested = invested_by_date[date]
        previous_dividends = dividends_by_date[date]

    #print("Invested by date: ", invested_by_date)
     # Create the history object with accumulated values
    historyObject = [{"date": date, 
                      "totalValue": value_by_date[date],
                      "totalInvested": invested_by_date[date],
                      "dividends":dividends_by_date[date]} for date in all_dates]
    # Format the response into a list of {'date': 'YYYY-MM-DD', 'totalValue': value} objects
    response = {
        'holdings': [holding.to_dict() for holding in holdings],
        "history": historyObject
    }
    
    #print("response: ", value_by_date)
    return jsonify(response)

@app.route('/api/ticker_info', methods=['GET'])
def get_ticker_price():
    symbol = request.args.get('symbol')
    if not symbol:
        return jsonify({"error": "Symbol parameter is required"}), 400
    symbol = symbol.upper()
    try:
        # Query the StockInfo table for the given ticker
        stock_info_entry = StockInfo.query.filter_by(ticker=symbol).first()
        #print("stock_info_entry: ", stock_info_entry)
        # Check if stock info exists in the database
        if stock_info_entry:
            # Return the info from the database
            return jsonify(stock_info_entry.to_dict())
        else:
            return jsonify({"error": f"No data found for the given symbol: {symbol}"}), 404

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/stock_info', methods=['GET'])
def get_stock_info():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "Ticker parameter is required"}), 400
    ticker = ticker.upper()
    stock_info_entry = StockInfo.query.filter_by(ticker=ticker).first()
    if stock_info_entry:
        return jsonify(stock_info_entry.to_dict())
    else:
        return jsonify({"error": f"No stock info found for {ticker}"}), 404
    
@app.route('/api/portfolio_tickers_info', methods=['GET'])
def get_portfolio_tickers_info():
    with app.app_context():
        try:
            tickers = StockInfo.query.all()
            if tickers:
                return jsonify([ticker.to_dict() for ticker in tickers])
            else:
                return jsonify({"error": "No stock info found"}), 404
        except Exception as e:
            return jsonify({"error": str(e)}), 500
def format_number(value):
    if value >= 1e12:
        # Trillions
        return f"{round(value / 1e12, 2)}T"
    elif value >= 1e9:
        # Billions
        return f"{round(value / 1e9, 2)}B"
    elif value >= 1e6:
        # Millions
        return f"{round(value / 1e6, 2)}M"
    else:
        # Less than a million, return the raw value
        return str(value)
    
@app.route("/api/stock_data")
def get_stock_data():
    symbol = request.args.get('symbol').upper()
    print("Fetching stock data...", symbol)
    range_param = request.args.get('range', 'YTD')  # Default to YTD if no range is provided
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
        period = RANGE_MAPPING.get(range_param, 'YTD')
        # Extract net income and total revenue for the last 4 years
        net_incomes = financials.loc['Net Income'].values[:4]
        revenues = financials.loc['Total Revenue'].values[:4]
        # Convert the values to billions and round to 2 decimal places
        net_incomes = [round(net_income, 2) for net_income in net_incomes]
        revenues = [round(revenue, 2) for revenue in revenues]
        # Calculate the 4-year total net income and total revenue
        total_net_income = round(sum(net_incomes), 2)
        total_revenue = round(sum(revenues), 2)
        # Ensure there are enough data points to calculate the 3-year compound growth
        if len(revenues) < 4:
            return jsonify({"error": "Not enough data to calculate 3-year compound revenue growth."}), 400
        # Most recent year (Year 3) and 3 years ago (Year 0)
        revenue_current = revenues[0]
        revenue_3_years_ago = revenues[3]
        # Convert to billions
        revenue_current_billion = revenue_current / 1e9
        revenue_3_years_ago_billion = revenue_3_years_ago / 1e9
        # Calculate the 3-Year Compound Revenue Growth
        cagr = calculate_cagr(revenue_3_years_ago_billion, revenue_current_billion, 3)
        cagr_percentage = round(cagr * 100, 2)
        # Extract the operating cash flow and capital expenditures for the last 4 years
        operating_cash_flows = cash_flow_statement.loc['Operating Cash Flow'].values[:4]
        #print(cash_flow_statement)

        try:
            if 'Capital Expenditure' in cash_flow_statement.index:
                capex = cash_flow_statement.loc['Capital Expenditure'].fillna(1).infer_objects(copy=False).values[:4]
            elif 'Capital Expenditure Reported' in cash_flow_statement.index:
                capex = cash_flow_statement.loc['Capital Expenditure Reported'].fillna(1).infer_objects(copy=False).values[:4]
                #print("capex: ", capex)
            else:
                print("No capex data found.")
                capex = [1, 1, 1, 1]
        except Exception as e:
            print(f"Error fetching capex data for {symbol}: {e}")
            return jsonify({"error": f"Error fetching data: {e}"}), 500
        
        # Calculate free cash flow for the last 4 years
        #print("Calculate free cash flow for the last 4 years")
        try:
            free_cash_flows = [op_cf + capex_val for op_cf, capex_val in zip(operating_cash_flows, capex)]
            #print("free_cash_flows: ", free_cash_flows)
            free_cash_flows = [fcf for fcf in free_cash_flows]
        except Exception as e:
            #print(f"Error calculating free cash flow: {e}")
            return jsonify({"error": f"Error calculating free cash flow: {e}"}), 500
        # Dividends Paid
        if 'Cash Dividends Paid' in cash_flow_statement.index:
            #print("Cash Dividends Paid")
            dividend_paid = abs(cash_flow_statement.loc['Cash Dividends Paid'].values[0])
        else:
            dividend_paid = 0
        # Calculate the 4-year average free cash flow
        #print("free_cash_flows_billion: ", free_cash_flows_billion)
        avg_free_cash_flow = round(sum(free_cash_flows) / len(free_cash_flows), 2)
        #print("avg_free_cash_flow: ", avg_free_cash_flow)
        price_to_fcf = 0
        free_cash_flow = stock_info.get('freeCashflow', 0)
        if free_cash_flow != 0:
            price_to_fcf = safe_round((stock_info.get('marketCap', 0)) / free_cash_flow, 2)
        stock_data_response = {
            'market_cap': format_number(stock_info.get('marketCap', 0)),
            'revenue': format_number(stock_info.get('totalRevenue', 0)),
            'net_income': format_number(stock_info.get('netIncomeToCommon', 0)),
            'four_year_avg_net_income': format_number((sum(net_incomes) / len(net_incomes))),
            'pe_ratio': safe_round(stock_info.get('trailingPE', 'N/A'), 2),
            'ps_ratio': safe_round(stock_info.get('priceToSalesTrailing12Months', 'N/A'), 2),
            'profit_margin': round(stock_info.get('profitMargins', 0) * 100, 2),
            'four_year_profit_margin': round((total_net_income / total_revenue) * 100, 2),
            'gross_profit_margin': round(stock_info.get('grossMargins', 0) * 100, 2),
            'three_year_revenue_growth': cagr_percentage,
            'free_cash_flow': format_number(stock_info.get('freeCashflow', 0)),
            'four_year_avg_fcf': format_number(avg_free_cash_flow),
            'price_to_fcf': format_number(price_to_fcf),
            'dividend_yield': round(stock_info.get('dividendYield', 0) * 100, 2),
            'dividends_paid': round(dividend_paid / 1e9, 2),
            'five_year_average_dividend_yield': safe_round(stock_info.get('fiveYearAvgDividendYield', 0), 2),
            'ev_to_earnings': safe_round(stock_info.get('enterpriseValue') / stock_info.get('netIncomeToCommon'), 2),
            'ev_to_fcf': safe_round(stock_info.get('enterpriseValueToFreeCashFlow', 'N/A'), 2),
            'roa': round(stock_info.get('returnOnAssets', 0) * 100, 2),
            'roe': round(stock_info.get('returnOnEquity', 0) * 100, 2),
            'company_description': stock_info.get('longBusinessSummary', 'N/A'),
            'company_name': stock_info.get('longName', 'N/A'),
            'current_price': round(fast_info['last_price'], 2),
            'price_change': round(fast_info['last_price'] - stock_info.get('regularMarketPreviousClose', 0), 2),
            'price_change_percentage': round(((fast_info['last_price'] - stock_info.get('regularMarketPreviousClose', 0)) / stock_info.get('regularMarketPreviousClose', 1) * 100), 2),
            'currency': stock_info.get('currency', 'N/A'),
            'website': stock_info.get('website', 'N/A'),
            'industry': stock_info.get('industry', 'N/A'),
            'sector': stock_info.get('sector', 'N/A'),
        }
        # Fetch historical price data for the selected period
        stock = yf.Ticker(symbol)
        hist = stock.history(period=period)
        hist.index = pd.to_datetime(hist.index)
        stock_data_response['price_chart'] = {
            'dates': hist.index.strftime('%Y-%m-%d').tolist(),
            'prices': hist['Close'].tolist()
        }
        return jsonify(stock_data_response)
    except Exception as e:
        return jsonify({"error": f"Error fetching data for {symbol}: {str(e)}"}), 500

@app.route('/income_statement')
def income_statement():
    return render_template("income_statement.html")

@app.route('/api/income_statement')
def get_income_statement():
    symbol = request.args.get('symbol', 'AAPL').upper()
    stock_data = fetch_stock_data(symbol)
    try:
        financials_yearly = stock_data['financials'].T
        financials_yearly.index = financials_yearly.index.strftime('%Y-%m-%d')
        income_statement_yearly = {}
        for year in financials_yearly.index:
            print("year: ", year)
            income_statement_yearly[year] = financials_yearly.loc[year].replace({np.nan: None}).to_dict()
        financials_quartely = stock_data['quarterly_financials'].T
        financials_quartely.index = financials_quartely.index.strftime('%Y-%m-%d')
        income_statement_quarterly = {}
        for quarter in financials_quartely.index:
            print("quarter: ", quarter)
            income_statement_quarterly[quarter] = financials_quartely.loc[quarter].replace({np.nan: None}).to_dict()
        response = {
            "symbol": symbol,
            "income_statement_yearly": income_statement_yearly,
            "income_statement_quarterly": income_statement_quarterly,
        }
        return jsonify(response)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/balance_sheet')
def balance_sheet():
    return render_template("balance_sheet.html")

@app.route('/api/balance_sheet')
def get_balance_sheet():
    symbol = request.args.get('symbol', 'AAPL').upper()
    stock_data = fetch_stock_data(symbol)
    try:
        balance_yearly = stock_data['balance_sheet'].T
        balance_yearly.index = balance_yearly.index.strftime('%Y-%m-%d')
        balance_yearly = balance_yearly.fillna('N/A').infer_objects(copy=False)
        balance_sheet_yearly = balance_yearly.to_dict(orient="index")

        balance_quarterly = stock_data['quarterly_balance_sheet'].T
        balance_quarterly.index = balance_quarterly.index.strftime('%Y-%m-%d')
        balance_quarterly = balance_quarterly.fillna('N/A').infer_objects(copy=False)
        balance_sheet_quarterly = balance_quarterly.to_dict(orient="index")
        response = {
            "symbol": symbol,
            "balance_sheet_yearly": balance_sheet_yearly,
            "balance_sheet_quarterly": balance_sheet_quarterly
        }
        return jsonify(response)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/cash_flow')
def cash_flow():
    return render_template("cash_flow.html")

@app.route('/api/cash_flow')
def get_cash_flow():
    symbol = request.args.get('symbol', 'AAPL').upper()
    stock_data = fetch_stock_data(symbol)
    try:
        cash_yearly = stock_data['cash_flow'].T
        cash_yearly.index = cash_yearly.index.strftime('%Y-%m-%d')
        cash_yearly = cash_yearly.fillna('N/A').infer_objects(copy=False)
        cash_flow_yearly = cash_yearly.to_dict(orient="index")
        cash_quarterly = stock_data['quarterly_cash_flow'].T
        cash_quarterly.index = cash_quarterly.index.strftime('%Y-%m-%d')
        cash_quarterly = cash_quarterly.fillna('N/A').infer_objects(copy=False)
        cash_flow_quarterly = cash_quarterly.to_dict(orient="index")
        response = {
            "symbol": symbol,
            "cash_flow_yearly": cash_flow_yearly,
            "cash_flow_quarterly": cash_flow_quarterly
        }
        return jsonify(response)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/8pillars')
def eight_pillars():
    return render_template("8pillars.html")

@app.route('/api/8pillars')
def get_eight_pillars():
    symbol = request.args.get('symbol', 'AAPL').upper()
    stock_data = fetch_stock_data(symbol)
    try:
        financials = stock_data['financials']
        balance_sheet = stock_data['balance_sheet']
        cash_flow = stock_data['cash_flow']
        info = stock_data['info']

        eight_pillars = {
            "PE Ratio < 22.5": safe_round(info.get('forwardPE', 'N/A'), 2),
            "ROIC > 10": calculate_roic(financials, balance_sheet),
            "Revenue Growth": calculate_growth(financials.loc['Total Revenue']),
            "Net Income Growth": calculate_growth(financials.loc['Net Income']),
            "Shares Outstanding Change": calculate_shares_change(balance_sheet),
            "LTL / 4 Yr FCF < 5": calculate_ltl(balance_sheet, cash_flow),
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

@app.route('/recommendations')
def recommendations():
    return render_template("recommendations.html")

@app.route('/api/recommendations')
def get_recommendations():
    symbol = request.args.get('symbol').upper()
    print("Fetching recommendations...", symbol)
    stock_data = fetch_stock_data(symbol)
    try:
        recommendations = stock_data['recommendations']
        recommendations_summary = stock_data['recommendations_summary']
        upgrades_downgrades = stock_data['upgrades_downgrades'].iloc[:5]
        recommendations = recommendations.fillna("N/A").infer_objects(copy=False)
        recommendations_summary = recommendations_summary.fillna("N/A").infer_objects(copy=False)
        upgrades_downgrades = upgrades_downgrades.fillna("N/A").infer_objects(copy=False)
        recommendations.index = pd.to_datetime(recommendations.index, errors='coerce')
        recommendations_summary.index = pd.to_datetime(recommendations_summary.index, errors='coerce')
        upgrades_downgrades.index = pd.to_datetime(upgrades_downgrades.index, errors='coerce')
        upgrades_downgrades['GradeDate'] = upgrades_downgrades.index.strftime('%Y-%m-%d')
        recommendations = recommendations.to_dict(orient='records')
        recommendations_summary = recommendations_summary.to_dict(orient='records')
        upgrades_downgrades = upgrades_downgrades.to_dict(orient='records')
        response = {
            "symbol": symbol,
            "recommendations": recommendations,
            "recommendations_summary": recommendations_summary,
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
    symbol = request.args.get('symbol').upper()
    print("Fetching analyst estimates...", symbol)
    stock_data = fetch_stock_data(symbol)
    try:
        analyst_price_targets = stock_data['analyst_price_targets']
        earnings_estimate = stock_data['earnings_estimate']
        revenue_estimate = stock_data['revenue_estimate']
        earnings_history = stock_data['earnings_history']
        eps_trend = stock_data['eps_trend']
        eps_revisions = stock_data['eps_revisions']
        growth_estimates = stock_data['growth_estimates']
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
        earnings_estimate = earnings_estimate.to_dict(orient='records')
        revenue_estimate = revenue_estimate.to_dict(orient='records')
        earnings_history = earnings_history.to_dict(orient='records')
        eps_trend = eps_trend.to_dict(orient='records')
        eps_revisions = eps_revisions.to_dict(orient='records')
        growth_estimates = growth_estimates.to_dict(orient='records')
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
    force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'

    # Check if AI opinion is already in session and not forcing refresh
    if 'ai_opinion' in session and session['ai_opinion'].get('symbol') == symbol and not force_refresh:
        print("AI opinion found in session")
        return jsonify(session['ai_opinion'])
    
    include_financial_data = request.args.get('financial_data', 'true').lower() == 'true'
    include_yearly_reports = request.args.get('yearly_reports', 'true').lower() == 'true'
    include_quarterly_reports = request.args.get('quarterly_reports', 'true').lower() == 'true'
    include_news = request.args.get('news', 'true').lower() == 'true'
    gpt_model = request.args.get('gpt_model', 'gpt-4o-mini-2024-07-18')
    try:
        # Fetch necessary stock data
        stock_info = stock_data.get('stock_info', {})
         # Prepare data to send to OpenAI
        prompt = (
            f"Stock Info: {stock_info}\n"
        )
        if include_financial_data:
            financials = stock_data.get('financials', {})
            balance_sheet = stock_data.get('balance_sheet', {})
            cash_flow = stock_data.get('cash_flow', {})
            quarterly_cash_flow = stock_data.get('quarterly_cash_flow', {})
            quarterly_income_stmt = stock_data.get('quarterly_income_stmt', {})
            quarterly_balance_sheet = stock_data.get('quarterly_balance_sheet', {})
            #quarterly_earnings = stock_data.get('quarterly_earnings', {})
            quarterly_financials = stock_data.get('quarterly_financials', {})
        if include_yearly_reports:
            ten_k = get_yearly_report(symbol,gpt_model)
            prompt += (
                f"10-K: {ten_k}\n"
            )
        if include_quarterly_reports:
            ten_q = get_quarterly_report(symbol,gpt_model)
            prompt += (
                f"10-Q: {ten_q}\n"
            )
        if include_news:
            news = stock_data.get('news', {})
            news = download_news(symbol, news, gpt_model)
            prompt += (
                f"News: {news}\n"
            )

        if include_financial_data:
            prompt += (
                f"Financials: {financials}\n"
                f"Balance Sheet: {balance_sheet}\n"
                f"Cash Flow: {cash_flow}\n"
                f"Quarterly cash flow: {quarterly_cash_flow}\n"
                f"Quarterly income statement: {quarterly_income_stmt}\n"
                f"Quarterly balance sheet: {quarterly_balance_sheet}\n"
                #f"Quarterly earnings: {quarterly_earnings}\n"
                f"Quarterly financials: {quarterly_financials}\n"
            )

        system_message = (
            f"You are a professional financial analyst and stocks trader. "
            f"Based on the following financial data for ({symbol}), provide a detailed financial analysis "
            f"and investment recommendation. Include discussions on its financial health, market position, growth prospects, "
            f"and any potential risks.\n\n"
            f"Key Financial Metrics:\n"
            f"{prompt}"
        )
        user_message = (
            f"multibagger_potential growth_estimate must be for the next 12 months align it and not ovelap if Growth potential is < 100% multibagger cant be valuated high. Your answer must be in JSON format and structured as follows:\n"
            f"{{"
            f'  "company_situation": {{'
            f'    "financial_health": "",'
            f'    "market_position": "",'
            f'    "growth_prospects": "",'
            f'    "main_competitors": ""'
            f'    "potential_oportunities": ""'
            f'    "potential_risks": ""'
            f'  }},'
            f'  "investment_attractiveness": {{'
            f'    "rating": 0-10,'
            f'    "multibagger_potential": 0-10,'
            f'    "growth_estimate": %'
            f'    "shares_valuation": Overvalued/Undervalued'
            f'  }}'
            f'}}'
        )

        # Call the OpenAI API for chat models
        
        response = client.chat.completions.create(
            model=gpt_model,  # Ensure the correct chat model is used
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            max_tokens=1000,
            temperature=0,
            n=1,
            response_format={
                "type": "json_object"
            },
        )
        # Extract token usage information
        prompt_tokens = response.usage.prompt_tokens
        completion_tokens = response.usage.completion_tokens
        total_tokens = response.usage.total_tokens
        print(f"Tokens used: Prompt tokens: {prompt_tokens} Completion tokens: {completion_tokens} Total: {total_tokens}")

        # Access the response
        ai_opinion = response.choices[0].message.content.strip().replace("***", "<br>")
        # Prepare response data
        #print("AI Opinion ", ai_opinion)
        response_data = {
            "symbol": symbol,
            "ai_opinion": ai_opinion
        }
         # Save AI opinion in session
        session['ai_opinion'] = response_data
        return jsonify(response_data)
    except Exception as e:
        print("Error ", e)
        return jsonify({"error": str(e)}), 400

@app.route('/news')
def news():
    return render_template("news.html")

@app.route('/api/news')
def get_news():
    symbol = request.args.get('symbol', 'AAPL').upper()
    stock_data = fetch_stock_data(symbol)
    try:
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
    symbol = request.args.get('symbol', 'AAPL').upper()
    stock_data = fetch_stock_data(symbol)
    try:
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
def get_annual_reports():
    symbol = request.args.get('symbol', 'AAPL').upper()
    try:
        sec_url = f'https://efts.sec.gov/LATEST/search-index?keysTyped={symbol}'
        headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; FinancialApp/1.0; +http://yourwebsite.com)'
        }
        response = requests.get(sec_url, headers=headers)
        response.raise_for_status()
        data = response.json()
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
    # Initialize the database before starting the app
    with app.app_context():
        db.create_all()
        #migrate_history_data()
        #update_stock_info()
        # Start the scheduler in a separate thread
        #scheduler_thread = threading.Thread(target=start_scheduler)
        #scheduler_thread.start()
    app.run(debug=True)
