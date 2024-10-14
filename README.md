# Stock Dashboard

This project is a Stock Dashboard web application that provides various financial metrics, news, and recommendations for stocks. The application is built using Flask for the backend and Bootstrap for the frontend.

## Features

- **8 Pillars**: View the 8 pillars of stock analysis.
- **Analyst Estimates**: Get analyst estimates for stocks.
- **Recommendations**: View AI-based and other recommendations.
- **News**: Get the latest news for stocks.
- **Dividends Data**: Visualize dividends data for stocks.
- **Load Data**: Renew all saved data cache data.

## Installation

1. **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/stock-dashboard.git
    cd stock-dashboard
    ```

2. **Create a virtual environment**:
   If need to clean
   Remove-Item -Recurse -Force venv
   python -m venv venv
   

4. **Activate the virtual environment**:
    - On Windows:
        ```bash
        .\venv\Scripts\activate
        ```
    - On macOS/Linux:
        ```bash
        source venv/bin/activate
        ```

5. **Install the dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

6. **Create a [.env] file in the root directory of the project and add the following environment variables:
    ```plaintext
    SECRET_KEY=your_secret_key
    OPENAI_API_KEY=your_openai_api_key
    ```

7. **Run the application**:
    ```bash
    flask run
    ```

8. **Open your browser** and navigate to `http://127.0.0.1:5000` to view the application.

## Usage

- Enter a stock symbol in the input form and click "Load Data" to fetch and visualize the data.
- Navigate through the different sections using the navigation bar.

## Project Structure

- [main.py]: The main Flask application file.
- [templates]: Directory containing HTML templates.
- [static]: Directory containing static files like CSS and JavaScript.
- `requirements.txt`: File listing all the dependencies.
- `README.md`: This file.

## Dependencies

- Flask
- Flask-Session
- pandas
- yfinance
- python-dotenv
- openai
- Chart.js (via CDN)
- Bootstrap (via CDN)

## License

This project is licensed under the MIT License.
