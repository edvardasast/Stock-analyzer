import os
import pandas as pd
import json

def parse_statement(file_path):
    df = pd.read_csv(file_path)
    # Group the data by Ticker and create a JSON structure where each Ticker is an object with its corresponding events
    ticker_data = df.groupby('Ticker').apply(lambda x: x.to_dict(orient='records')).to_dict()

    # Save the JSON data to a file
    json_file_path = '/data/statement.json'
    with open(json_file_path, 'w') as json_file:
        json.dump(ticker_data, json_file, indent=4)
    return json_file_path