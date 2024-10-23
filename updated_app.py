from flask import Flask, render_template, request, flash, redirect, url_for, session
from flask_session import Session
import tempfile
import yfinance as yf
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # Use 'Agg' backend
import matplotlib.pyplot as plt
import numpy as np
import io
import base64
import logging
import requests
from openai import OpenAI
import os
from dotenv import load_dotenv
import sqlite3
import time
# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')

# Configure session to use filesystem (instead of signed cookies)
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_FILE_DIR'] = tempfile.gettempdir()
app.config['SESSION_PERMANENT'] = False  # Ensure sessions are not permanent
Session(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FinancialModelingPrep API Key
API_KEY = os.getenv('FMP_API_KEY')

# OpenAI API Key
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

# Check if the keys are loaded
if not app.secret_key:
    raise ValueError("No SECRET_KEY set for Flask application. Please set it in your .env file.")
if not API_KEY:
    raise ValueError("No FMP_API_KEY found. Please set it in your .env file.")
if not OPENAI_API_KEY:
    raise ValueError("No OPENAI_API_KEY found. Please set it in your .env file.")

# Initialize OpenAI client
client = OpenAI()

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        symbol = request.form['symbol'].upper()
        # Try to get the invested amount and convert it to a float number
        try:
            amount = float(request.form['amount'])
        except ValueError:
            # If the amount is not a valid number, show an error message
            flash('Please enter a valid invested amount.')
            return render_template('index.html')
        print(symbol)
        print(amount)
        # Call the load_data function to process the data
        data = load_data(symbol, amount)
        return render_template('results.html', data=data)
    else:
        # If the request method is GET, display the input form
        return render_template('index.html')
    
def load_data(symbol, amount):
        # Fetch data about the stock using the yfinance library
        stock = yf.Ticker(symbol)

        try:
            # Get detailed information about the company
            info = stock.info
            if not info:
                raise ValueError('Invalid symbol')

            # Fetch financial statements
            financials = stock.financials
            # Transpose the DataFrame to have dates as rows
            financials = financials.T
            financials.index = pd.to_datetime(financials.index)
            financials.sort_index(inplace=True)
    
            # Print available columns to the console for debugging
            #print("Available financial data columns:", financials.columns.tolist())
        except Exception as e:
            # If the stock symbol is invalid or data can't be fetched, show an error message
            flash('Invalid stock symbol or financial data not available. Please try again.')
            logger.error(f"Error fetching company info or financials for {symbol}: {e}")
            return render_template('index.html')
        
        # Get the stock's historical market data
        hist = stock.history(period="max")
        
        if hist.empty:
            # If there's no historical data, show an error message
            flash('No historical data found for this symbol.')
            return render_template('index.html')
        
        # Determine which price column to use ('Adj Close' or 'Close')
        price_column = 'Adj Close' if 'Adj Close' in hist.columns else 'Close'
        if price_column not in hist.columns:
            # If neither price column is available, show an error message
            flash('Adjusted Close or Close price data not available.')
            return render_template('index.html')
        
        # Calculate the daily return (how much the stock price changes each day)
        hist['Return'] = hist[price_column].pct_change()
        
        # Calculate the average annual return by averaging daily returns and scaling to a year
        annual_return = hist['Return'].mean() * 252  # Approximately 252 trading days in a year
        
        # Get the dividend yield (how much the company pays out in dividends relative to its stock price)
        dividend_yield = info.get('dividendYield', 0) or 0
        
        # Add the dividend yield to the annual return to get the total expected annual return
        annual_return_with_dividends = annual_return + dividend_yield

        # --- New code to calculate the average growth rate over the past 5 years ---
        try:
            # Get historical data for the past 6 years (to calculate 5 year-over-year growth rates)
            hist_5y = stock.history(period="5y", interval="3mo")[price_column]
            # Ensure we have enough data points
            if len(hist_5y) >= 6:
                # Calculate year-over-year growth rates
                growth_rates = hist_5y.pct_change().dropna()
                # Calculate the average of these growth rates
                average_growth_rate = growth_rates.mean()
                # Convert to percentage
                average_growth_rate_percentage = average_growth_rate * 100
            else:
                raise ValueError("Not enough data to calculate 5-year average growth rate.")
        except Exception as e:
            average_growth_rate = 0
            average_growth_rate_percentage = 0
            logger.error(f"Error calculating average 5-year growth rate for {symbol}: {e}")
            flash('Could not calculate average 5-year growth rate. Defaulting to 0%.')
        # ---------------------------------------------------------------------------

        
        # Calculate projected returns for 1, 5, and 10 years using the user-provided growth rate
        projected_returns = {}
        for years in [1, 5, 10]:
            # Calculate the amount expected after 'years' years
            projected_amount = amount * ((1 + average_growth_rate) ** years)
            projected_returns[years] = projected_amount
        
        # Prepare the historical data for the last 10 years (or as much as available)
        hist_yearly = hist.resample('YE').last()  # Resample to get the last data point of each year
        hist_yearly = hist_yearly.tail(10)  # Get the last 10 years
        
        # Get revenue and profit data
        try:
            # Possible field names for revenue and gross profit
            revenue_fields = ['Total Revenue', 'totalRevenue', 'TotalRevenue', 'Revenue']
            profit_fields = ['Gross Profit', 'grossProfit', 'GrossProfit']

            # Find the correct field names
            revenue_field = next((field for field in revenue_fields if field in financials.columns), None)
            profit_field = next((field for field in profit_fields if field in financials.columns), None)

            if not revenue_field or not profit_field:
                raise ValueError("Revenue or Gross Profit fields not found in financial data.")

            # Extract revenue and profit data
            revenue = financials[revenue_field]
            gross_profit = financials[profit_field]

            # Check if revenue and gross_profit are not empty
            if revenue.isnull().all() or gross_profit.isnull().all():
                raise ValueError("Revenue or Gross Profit data is missing.")

            # Keep the last 10 years
            revenue = revenue.tail(5)
            gross_profit = gross_profit.tail(5)

            # Convert amounts to billions
            revenue_values = revenue.values / 1e9
            profit_values = gross_profit.values / 1e9
            years = revenue.index.year.astype(int)

            # Create a DataFrame for plotting
            df_plot = pd.DataFrame({
                'Year': years,
                'Revenue': revenue_values,
                'Gross Profit': profit_values
            })

            # Use an available style
            plt.style.use('ggplot')

            # Plot revenue and profit as bar charts
            plt.figure(figsize=(10, 6))
            bar_width = 0.35
            x = np.arange(len(df_plot['Year']))

            plt.bar(x - bar_width/2, df_plot['Revenue'], width=bar_width, color='#1f77b4', label='Revenue')
            plt.bar(x + bar_width/2, df_plot['Gross Profit'], width=bar_width, color='#ff7f0e', label='Gross Profit')

            plt.title(f"{info.get('longName', symbol)} Revenue and Gross Profit (Last {len(revenue)} Years)")
            plt.xlabel('Year')
            plt.ylabel('Amount (in Billions USD)')
            plt.xticks(x, df_plot['Year'])
            plt.legend()
            plt.tight_layout()

            # Save the plot to a PNG image in memory
            img = io.BytesIO()
            plt.savefig(img, format='png')
            img.seek(0)
            chart_data = base64.b64encode(img.getvalue()).decode()
            plt.close()
        except Exception as e:
            chart_data = None
            logger.error(f"Error fetching or plotting financial data for {symbol}: {e}")
            flash('Revenue and profit data not available.')
        
        # Get company logo URL
        logo_url = info.get('logo_url', '')
        
        # Additional helpful information
        helpful_info = {
            'beta': info.get('beta'),  # Stock volatility compared to the market
            'recommendationMean': info.get('recommendationMean'),  # Analyst recommendation score
            'shortPercentOfFloat': info.get('shortPercentOfFloat'),  # Short interest
            'bookValue': info.get('bookValue'),  # Book value per share
            'debtToEquity': info.get('debtToEquity'),  # Debt to equity ratio
        }
        
        # Get Free Cash Flow data
        try:
            # Fetch cash flow statements from FinancialModelingPrep
            fcf_url = f'https://financialmodelingprep.com/api/v3/cash-flow-statement/{symbol}?limit=10&apikey={API_KEY}'
            response = requests.get(fcf_url)
            cash_flow_data = response.json()
            
            if not cash_flow_data:
                raise ValueError("No cash flow data available.")
            
            # Extract Free Cash Flow and dates
            fcf_data = {
                item['date']: item['freeCashFlow']
                for item in cash_flow_data if 'freeCashFlow' in item
            }
            
            # Prepare data for plotting
            fcf_dates = list(fcf_data.keys())
            fcf_dates = pd.to_datetime(fcf_dates)
            fcf_values = [fcf_data[date.strftime('%Y-%m-%d')] / 1e9 for date in fcf_dates]  # Convert to billions
            
            # Plot FCF Trend
            plt.figure(figsize=(10, 6))
            plt.plot(fcf_dates, fcf_values, marker='o', linestyle='-', color='#2ca02c', label='Free Cash Flow')
            plt.title(f"{info.get('longName', symbol)} Free Cash Flow Trend (Last {len(fcf_dates)} Years)")
            plt.xlabel('Year')
            plt.ylabel('Free Cash Flow (in Billions USD)')
            plt.xticks(rotation=45)
            plt.grid(True)
            plt.tight_layout()
            
            # Save the plot to a PNG image in memory
            img_fcf = io.BytesIO()
            plt.savefig(img_fcf, format='png')
            img_fcf.seek(0)
            fcf_chart_data = base64.b64encode(img_fcf.getvalue()).decode()
            plt.close()
        except Exception as e:
            fcf_chart_data = None
            fcf_dates = []
            fcf_values = []
            logger.error(f"Error fetching or plotting FCF data for {symbol}: {e}")
            flash('Free Cash Flow data not available.')
        
        # Debt Information
        total_debt = info.get('totalDebt', 'N/A')
        debt_to_equity = info.get('debtToEquity', 'N/A')
        
        # Competitive Positioning
        competitors = [symbol, 'MSFT', 'GOOGL', 'AMZN']  # Include the analyzed company
        competitor_data = []
        
        for comp_symbol in competitors:
            comp_stock = yf.Ticker(comp_symbol)
            comp_info = comp_stock.info
            comp_ratios = {
                'symbol': comp_symbol,
                'trailingPE': comp_info.get('trailingPE', 'N/A'),
                'priceToBook': comp_info.get('priceToBook', 'N/A'),
                'profitMargins': comp_info.get('profitMargins', 'N/A'),
            }
            competitor_data.append(comp_ratios)
        
        # Stock Performance vs. Sector and Index
        sector_etf = 'XLK'  # Technology Select Sector SPDR Fund
        index_etf = 'SPY'   # SPDR S&P 500 ETF Trust
        
        # Fetch historical data
        stock_hist = stock.history(period='10y')
        sector_hist = yf.Ticker(sector_etf).history(period='10y')
        index_hist = yf.Ticker(index_etf).history(period='10y')
        
        # Normalize data to 100 for comparison
        stock_norm = stock_hist['Close'] / stock_hist['Close'].iloc[0] * 100
        sector_norm = sector_hist['Close'] / sector_hist['Close'].iloc[0] * 100
        index_norm = index_hist['Close'] / index_hist['Close'].iloc[0] * 100
        
        # Plot comparative performance
        plt.figure(figsize=(10, 6))
        plt.plot(stock_hist.index, stock_norm, label=symbol)
        plt.plot(sector_hist.index, sector_norm, label=sector_etf)
        plt.plot(index_hist.index, index_norm, label=index_etf)
        plt.title(f"{info.get('longName', symbol)} vs. Sector and Index Performance")
        plt.xlabel('Date')
        plt.ylabel('Normalized Price')
        plt.legend()
        plt.grid(True)
        plt.tight_layout()
        
        # Save the plot to a PNG image in memory
        img_perf = io.BytesIO()
        plt.savefig(img_perf, format='png')
        img_perf.seek(0)
        perf_chart_data = base64.b64encode(img_perf.getvalue()).decode()
        plt.close()
        
        # Forward-looking Growth Metrics
        try:
            target_mean_price = info.get('targetMeanPrice', 'N/A')
            target_low_price = info.get('targetLowPrice', 'N/A')
            target_high_price = info.get('targetHighPrice', 'N/A')
            number_of_analysts = info.get('numberOfAnalystOpinions', 'N/A')
        except Exception as e:
            target_mean_price = target_low_price = target_high_price = number_of_analysts = 'N/A'
            logger.error(f"Error fetching analyst estimates for {symbol}: {e}")
        
        # ROE and ROA
        try:
            #print(info)
            net_income = info.get('netIncomeToCommon', None)
            
            roe = info.get('returnOnEquity', None)
            roa = info.get('returnOnAssets', None)
        except Exception as e:
            roe = roa = 'N/A'
            logger.error(f"Error calculating ROE and ROA for {symbol}: {e}")
        
        # Institutional Ownership
        institutional_ownership = info.get('heldPercentInstitutions', None)
        
        # ESG Metrics
        try:
            esg_scores = stock.sustainability
            if esg_scores is not None and not esg_scores.empty:
                esg_scores = esg_scores.reset_index()
                esg_scores.rename(columns={'index': 'Metric'}, inplace=True)
                esg_scores_html = esg_scores.to_html(classes='table table-striped', index=False)
            else:
                esg_scores_html = None
        except Exception as e:
            esg_scores_html = None
            logger.error(f"Error fetching ESG data for {symbol}: {e}")
        
        # 8 Pillars Analysis
        try:
            pillars = {}
            pillar_details = {}
            
            # Pillar 1: PE Ratio less than 25
            trailing_pe = info.get('trailingPE', None)
            pillar1_pass = trailing_pe < 25 if trailing_pe else False
            pillars['Pillar 1 (PE < 25)'] = pillar1_pass
            pillar_details['Pillar 1 (PE < 25)'] = f"PE Ratio: {trailing_pe}"
            
            # Pillar 2: Profit Margin > 10%
            profit_margins = info.get('profitMargins', 0)
            pillar2_pass = profit_margins > 0.10
            pillars['Pillar 2 (Profit Margin > 10%)'] = pillar2_pass
            pillar_details['Pillar 2 (Profit Margin > 10%)'] = f"Profit Margin: {profit_margins * 100:.2f}%"
            
            # Pillar 3: Revenue Growth over 5 years
            revenue_growth = info.get('revenueGrowth', 0)
            pillar3_pass = revenue_growth > 0
            pillars['Pillar 3 (Revenue Growth Positive)'] = pillar3_pass
            pillar_details['Pillar 3 (Revenue Growth Positive)'] = f"Revenue Growth YoY: {revenue_growth * 100:.2f}%"
            
            # Pillar 4: Net Income Growth over 5 years
            earnings_growth = info.get('earningsGrowth', 0)
            pillar4_pass = earnings_growth > 0
            pillars['Pillar 4 (Net Income Growth Positive)'] = pillar4_pass
            pillar_details['Pillar 4 (Net Income Growth Positive)'] = f"Earnings Growth YoY: {earnings_growth * 100:.2f}%"
            
            # Pillar 5: Shares Outstanding decreasing over 5 years
            try:
                # Fetch historical shares outstanding (approximate)
                shares = stock.history(period='5y')['Volume']
                if shares is not None and len(shares) >= 2:
                    initial_shares = shares.iloc[0]
                    latest_shares = shares.iloc[-1]
                    pillar5_pass = latest_shares < initial_shares
                    pillars['Pillar 5 (Shares Outstanding Decreasing)'] = pillar5_pass
                    pillar_details['Pillar 5 (Shares Outstanding Decreasing)'] = f"Shares Outstanding 5 Years Ago: {initial_shares:,.0f}, Now: {latest_shares:,.0f}"
                else:
                    raise ValueError("Not enough shares outstanding data.")
            except Exception as e:
                pillar5_pass = 'Data not available'
                pillars['Pillar 5 (Shares Outstanding Decreasing)'] = pillar5_pass
                pillar_details['Pillar 5 (Shares Outstanding Decreasing)'] = 'Historical shares outstanding data not available.'
                logger.error(f"Error fetching shares outstanding data for {symbol}: {e}")
            
            # Pillar 6: Current Assets > Current Liabilities
            try:
                # Fetch balance sheet data
                balance_sheet = stock.quarterly_balance_sheet
                current_assets = balance_sheet.loc['Total Assets'].iloc[0]
                current_liabilities = balance_sheet.loc['Current Liabilities'].iloc[0]
                if current_assets and current_liabilities:
                    pillar6_pass = current_assets > current_liabilities
                    pillars['Pillar 6 (Current Assets > Current Liabilities)'] = pillar6_pass
                    pillar_details['Pillar 6 (Current Assets > Current Liabilities)'] = f"Current Assets: ${current_assets:,.0f}, Current Liabilities: ${current_liabilities:,.0f}"
                else:
                    raise ValueError("Current assets or liabilities data missing.")
            except Exception as e:
                pillar6_pass = 'Data not available'
                pillars['Pillar 6 (Current Assets > Current Liabilities)'] = pillar6_pass
                pillar_details['Pillar 6 (Current Assets > Current Liabilities)'] = 'Current assets or liabilities data not available.'
                logger.error(f"Error fetching balance sheet data for {symbol}: {e}")
            
            # Pillar 7: Long-term Debt less than 3x Net Income
            try:
                # Fetch balance sheet and income statement data
                balance_sheet = stock.quarterly_balance_sheet
                income_statement = stock.quarterly_financials

                long_term_debt = balance_sheet.loc['Long Term Debt'].iloc[0]
                net_income = income_statement.loc['Net Income'].iloc[0]

                if long_term_debt and net_income:
                    pillar7_pass = long_term_debt < (net_income * 3)
                    pillars['Pillar 7 (Long-term Debt < 3x Net Income)'] = pillar7_pass
                    pillar_details['Pillar 7 (Long-term Debt < 3x Net Income)'] = f"Long-term Debt: ${long_term_debt:,.0f}, Net Income: ${net_income:,.0f}"
                else:
                    raise ValueError("Long-term debt or net income data missing.")
            except Exception as e:
                pillar7_pass = 'Data not available'
                pillars['Pillar 7 (Long-term Debt < 3x Net Income)'] = pillar7_pass
                pillar_details['Pillar 7 (Long-term Debt < 3x Net Income)'] = 'Long-term debt or net income data not available.'
                logger.error(f"Error fetching financial data for {symbol}: {e}")
            
            # Pillar 8: Free Cash Flow Growth over 5 years
            if len(fcf_values) >= 5:
                fcf_growth = (fcf_values[-1] - fcf_values[-5]) / abs(fcf_values[-5])
                pillar8_pass = fcf_growth > 0
                pillars['Pillar 8 (FCF Growth Positive)'] = pillar8_pass
                pillar_details['Pillar 8 (FCF Growth Positive)'] = f"5-Year FCF Growth: {fcf_growth * 100:.2f}%"
            else:
                pillar8_pass = 'Data not available'
                pillars['Pillar 8 (FCF Growth Positive)'] = pillar8_pass
                pillar_details['Pillar 8 (FCF Growth Positive)'] = 'Not enough FCF data for 5 years.'
        except Exception as e:
            pillars = {}
            pillar_details = {}
            logger.error(f"Error performing 8 Pillars analysis for {symbol}: {e}")

        # Prepare data to send to the results page
        data = {
            'symbol': symbol,
            'amount': amount,
            'projected_returns': projected_returns,
            'average_growth_rate': average_growth_rate_percentage,
            'company_info': info,
            'historical_data': hist_yearly.to_html(classes='table table-striped'),
            'chart_data': chart_data,
            'logo_url': logo_url,
            'helpful_info': helpful_info,
            'chart_years': len(revenue) if 'revenue' in locals() and revenue is not None else 0,
            'fcf_chart_data': fcf_chart_data,
            'fcf_dates': fcf_dates.strftime('%Y-%m-%d').tolist() if 'fcf_dates' in locals() else [],
            'total_debt': total_debt,
            'debt_to_equity': debt_to_equity,
            'competitor_data': competitor_data,
            'perf_chart_data': perf_chart_data,
            'target_mean_price': target_mean_price,
            'target_low_price': target_low_price,
            'target_high_price': target_high_price,
            'number_of_analysts': number_of_analysts,
            'roe': roe,
            'roa': roa,
            'institutional_ownership': institutional_ownership,
            'esg_scores_html': esg_scores_html,
            'pillars': pillars,
            'pillar_details': pillar_details,
        }

        # Store data in session for later use
        session['data'] = data
        session.modified = True  # Ensure session is saved
        return data
def get_ai_response(company, data):
    time.sleep(10)
    symbol = company
    company_name = company
    print(symbol)
    print(company_name)
    if not symbol or not company_name:
        flash('No stock data available. Please analyze a stock first.')
        print("Redirect to index no symbol no company")
        return redirect(url_for('index'))
      # Debugging: Check if data is a dictionary
    if not isinstance(data, dict):
        print(f"Expected data to be a dictionary, but got {type(data)}")
        return

    # Debugging: Check if 'company_info' is a dictionary within data
    if 'company_info' not in data or not isinstance(data['company_info'], dict):
        print(f"Expected 'company_info' to be a dictionary, but got {type(data.get('company_info'))}")
        return
    # Extract key financial data for the prompt
    key_metrics = {
        'Trailing PE Ratio': data['company_info'].get('trailingPE', 'N/A'),
        'Forward PE Ratio': data['company_info'].get('forwardPE', 'N/A'),
        'PEG Ratio': data['company_info'].get('pegRatio', 'N/A'),
        'Price to Book Ratio': data['company_info'].get('priceToBook', 'N/A'),
        'Profit Margins (%)': data['company_info'].get('profitMargins', 0) * 100,
        'Revenue Growth YoY (%)': data['company_info'].get('revenueGrowth', 0) * 100,
        'Earnings Growth YoY (%)': data['company_info'].get('earningsGrowth', 0) * 100,
        'Debt to Equity Ratio': data['company_info'].get('debtToEquity', 'N/A'),
        'Return on Equity (ROE) (%)': data['roe'],
        'Return on Assets (ROA) (%)': data['roa'],
    }

    # Format the 8 Pillars Analysis
    pillars_summary = ""
    for pillar, result in data['pillars'].items():
        status = 'Pass' if result == True else ('Fail' if result == False else result)
        detail = data['pillar_details'][pillar]
        pillars_summary += f"- {pillar}: {status}\n  Details: {detail}\n"

    prompt = ""
    for metric, value in key_metrics.items():
        prompt += f"- {metric}: {value}\n"

    prompt += "\n8 Pillars Analysis:\n" + pillars_summary

    prompt += "\nConsider recent financial metrics and market trends in your analysis."

    # Fetch stock data again if necessary
    stock = yf.Ticker(symbol)
    info = stock.info
    print(prompt)
    # Retrieve data from session
    data = session.get('data', None)
    if not data:
        # Reconstruct minimal data if session has expired
        data = {
            'symbol': symbol,
            'amount': amount,
            'company_info': info,
        }

    system_message = (
        f"You are a professional financial analyst and stocks trader."
        f"Based on the following financial data for {company_name} ({symbol}), provide a detailed financial analysis "
        f"and investment recommendation. Include discussions on its financial health, market position, growth prospects, "
        f"and any potential risks.\n\n"
        f"Key Financial Metrics:\n"
        f"{prompt}"
        )
    user_message = (
       f"Provide final decision in following format: ***Investment Attractiveness: 4/10 ***Multibagger Potential: 3/10 ***Shares: Overvalued/Undervalued"
       f"Your answer must fit into 40 words."
    )

    try:
        # Call the OpenAI API for chat models
        response = client.chat.completions.create(
            model='gpt-4o',  # Ensure the correct chat model is used
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            max_tokens=500,
            temperature=0.7,
            n=1,
        )
        # Access the response
        ai_opinion = response.choices[0].message.content.strip().replace("***", "<br>")
        print("Printing AI opinion " + str(ai_opinion))
    except Exception as e:
        ai_opinion = "An error occurred while fetching AI opinion."
        logger.error(f"Error fetching AI opinion: {e}")
        print(f"AI ERROR {e}")
        flash('Error fetching AI opinion. Please try again later.')
    return ai_opinion  
  
@app.route('/get_ai_opinion', methods=['POST'])
def get_ai_opinion():
    # Retrieve data from session
    data = session.get('data', None)
    symbol = request.form.get('symbol')
    company_name = request.form.get('company_name')
    amount = float(request.form.get('amount', 0))
    #growth_rate = float(request.form.get('ave', 0)) / 100  # Convert to decimal

    if not symbol or not company_name:
        flash('No stock data available. Please analyze a stock first.')
        return redirect(url_for('index'))
    
    # Extract key financial data for the prompt
    key_metrics = {
        'Trailing PE Ratio': data['company_info'].get('trailingPE', 'N/A'),
        'Forward PE Ratio': data['company_info'].get('forwardPE', 'N/A'),
        'PEG Ratio': data['company_info'].get('pegRatio', 'N/A'),
        'Price to Book Ratio': data['company_info'].get('priceToBook', 'N/A'),
        'Profit Margins (%)': data['company_info'].get('profitMargins', 0) * 100,
        'Revenue Growth YoY (%)': data['company_info'].get('revenueGrowth', 0) * 100,
        'Earnings Growth YoY (%)': data['company_info'].get('earningsGrowth', 0) * 100,
        'Debt to Equity Ratio': data['company_info'].get('debtToEquity', 'N/A'),
        'Return on Equity (ROE) (%)': data['roe'],
        'Return on Assets (ROA) (%)': data['roa'],
    }

    # Format the 8 Pillars Analysis
    pillars_summary = ""
    for pillar, result in data['pillars'].items():
        status = 'Pass' if result == True else ('Fail' if result == False else result)
        detail = data['pillar_details'][pillar]
        pillars_summary += f"- {pillar}: {status}\n  Details: {detail}\n"

    prompt = ""
    for metric, value in key_metrics.items():
        prompt += f"- {metric}: {value}\n"

    prompt += "\n8 Pillars Analysis:\n" + pillars_summary

    prompt += "\nConsider recent financial metrics and market trends in your analysis."

    # Fetch stock data again if necessary
    stock = yf.Ticker(symbol)
    info = stock.info

    # Retrieve data from session
    data = session.get('data', None)
    if not data:
        # Reconstruct minimal data if session has expired
        data = {
            'symbol': symbol,
            'amount': amount,
            'company_info': info,
        }

    system_message = (
        f"You are a professional financial analyst and stocks trader."
        f"Based on the following financial data for {company_name} ({symbol}), provide a detailed financial analysis "
        f"and investment recommendation. Include discussions on its financial health, market position, growth prospects, "
        f"and any potential risks.\n\n"
        f"Key Financial Metrics:\n"
        f"{prompt}"
        )
    user_message = (
       f"Provide short view about company situation"
       f"Provide final decision in following format: ***Investment Attractiveness: 4/10 ***Multibagger Potential: 3/10 ***Shares: Overvalued/Undervalued"
       f"Your answer must fit into 150 words."
    )

    try:
        # Call the OpenAI API for chat models
        response = client.chat.completions.create(
            model='gpt-4o',  # Ensure the correct chat model is used
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            max_tokens=500,
            temperature=0.7,
            n=1,
        )

        # Access the response
        ai_opinion = response.choices[0].message.content.strip().replace("***", "<br>")
        print(ai_opinion)
    except Exception as e:
        ai_opinion = "An error occurred while fetching AI opinion."
        logger.error(f"Error fetching AI opinion: {e}")
        flash('Error fetching AI opinion. Please try again later.')


    # Render the results page with the AI opinion
    return render_template('results.html', data=data, ai_opinion=ai_opinion)
def create_companies_table():
    conn = sqlite3.connect('your_database.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            symbol TEXT NOT NULL,
            rating INTEGER NOT NULL
        )
    ''')
    conn.commit()
    conn.close()
# Function to save company data to the database
def save_to_db(company, rating):
    conn = sqlite3.connect('your_database.db')
    cursor = conn.cursor()
    cursor.execute('INSERT INTO companies (name, symbol, rating) VALUES (?, ?, ?)', (company, company, rating))
    conn.commit()
    conn.close()

# Fetch qualified companies based on the rating
def fetch_qualified_companies(min_rating):
    conn = sqlite3.connect('your_database.db')
    cursor = conn.cursor()
    #cursor.execute('SELECT * FROM companies WHERE rating >= ?', (min_rating,))
    cursor.execute('SELECT name, symbol, rating FROM companies')
    result = cursor.fetchall()
    print(result)
    conn.close()
    return result
def clean_table():
    conn = sqlite3.connect('your_database.db')
    cursor = conn.cursor()
    cursor.execute('DELETE FROM companies')
    conn.commit()
    conn.close()
# Route to handle the multibagger scanning
@app.route('/find_multibagger', methods=['POST'])
def find_multibagger():
    requested_rating = int(request.form['requested_rating'])
    print("Before")
    all_companies =  [company.strip().upper() for company in request.form.get('requested_companys').split(',')]
    print(all_companies)
    #all_companies = [{'name': 'Microsoft', 'symbol': 'MSFT'}, {'name': 'Google', 'symbol': 'GOOGL'}]  # Example data
    clean_table()
    qualified_companies = []
    total_companies = len(all_companies)
    
    for i, company in enumerate(all_companies):
        rating = get_multibagger_rating(company)
        if rating >= requested_rating:
            save_to_db(company, rating)
            qualified_companies.append(company)
        
        progress = (i + 1) / total_companies * 100
    # Load saved companies with ratings from the database
    saved_companies = fetch_qualified_companies(rating)
    return render_template('results_multibagger.html', companies=saved_companies, progress=progress)

# Example function to simulate AI model rating for multibagger potential
def get_multibagger_rating(company):
    print(company)
    data = load_data(company, 0)
    ai_response = get_ai_response(company,data)
    # Find the position of "Multibagger Potential"
    start_index = ai_response.find("Multibagger Potential:")

    if start_index != -1:
        # Find the position of the number after "Multibagger Potential:"
        number_start = ai_response.find(":", start_index) + 2  # Skip the ": " to find the number
        number_end = ai_response.find("/", number_start)  # Find the end of the number (before "/10")
        multibagger_potential = ai_response[number_start:number_end].strip()  # Extract and strip any extra spaces

    print(int(multibagger_potential))
    return int(multibagger_potential)

if __name__ == '__main__':
    create_companies_table()
    app.run(debug=True)