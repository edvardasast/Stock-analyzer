from bs4 import BeautifulSoup
from sec_downloader import Downloader
from sec_downloader.types import RequestedFilings
import nltk
from openai import OpenAI
from nltk.tokenize import word_tokenize
import os
from dotenv import load_dotenv
# Load environment variables from .env file
load_dotenv()
# Ensure you have downloaded the necessary NLTK data files
nltk.download('punkt_tab')

def get_yearly_report(symbol,model):
    dl = Downloader("Info Company", "info@gmail.com")
    ten_k_dokument = ''
    ten_k = dl.get_filing_metadatas(
    RequestedFilings(ticker_or_cik=symbol, form_type="10-K", limit=1)
    )
    for metadata in ten_k:
            html = dl.download_filing(url=metadata.primary_doc_url).decode()
           # Extract text data from the HTML content
            soup = BeautifulSoup(html, 'html.parser')
            # Extract relevant sections (example: sections with financial data)
            relevant_sections = soup.find_all(['h1', 'h2', 'h3', 'p', 'table'])
            text = "\n".join([section.get_text(separator='\n', strip=True) for section in relevant_sections])
            # Remove empty lines
            text = "\n".join([line for line in text.splitlines() if line.strip() != ""])
            tokens = word_tokenize(text)
            tokenized_text = " ".join(tokens)
            ten_k_dokument = get_ai_summary(tokenized_text,symbol,"10-K",model)
    reports = {
        '10K': ten_k_dokument
    }
    return reports
def get_quarterly_report(symbol,model):
    dl = Downloader("Info Company", "info@gmail.com")
    ten_q_documents = []
    ten_q = dl.get_filing_metadatas(
    RequestedFilings(ticker_or_cik=symbol, form_type="10-Q", limit=4)
    )  
    for idx, metadata in enumerate(ten_q):
            html = dl.download_filing(url=metadata.primary_doc_url).decode()
           # Extract text data from the HTML content
            soup = BeautifulSoup(html, 'html.parser')
            # Extract relevant sections (example: sections with financial data)
            relevant_sections = soup.find_all(['h1', 'h2', 'h3', 'p', 'table'])
            text = "\n".join([section.get_text(separator='\n', strip=True) for section in relevant_sections])
            # Remove empty lines
            text = "\n".join([line for line in text.splitlines() if line.strip() != ""])
             # Tokenize the text
            tokens = word_tokenize(text)
            tokenized_text = " ".join(tokens)
            ten_q_documents.append(get_ai_summary(tokenized_text,symbol,"10-Q",model))
            
    reports = {
        '10Q': ten_q_documents
    }
    return reports
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable not set")
client = OpenAI(
  api_key=OPENAI_API_KEY,  # this is also the default, it can be omitted
)
def get_ai_summary(prompt, symbol, type, model):
      # Call the OpenAI API for chat models
        system_message = (
            f"You are a professional financial analyst and stocks trader. "
            f"Based on the following financial {type} form for ({symbol}), provide a detailed summary"
            f"{prompt}"
        )
        user_message = (
            f"Your response must be minimum 10000 tokens length and should include all key information. Financial data are not required to be included in the summary."
        )
        response = client.chat.completions.create(
            model=model,  # Ensure the correct chat model is used
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            max_tokens=10000,
            temperature=0,
            n=1,
        )
        # Extract token usage information
        prompt_tokens = response.usage.prompt_tokens
        completion_tokens = response.usage.completion_tokens
        total_tokens = response.usage.total_tokens
        print(f"{type} Tokens used: Prompt tokens: {prompt_tokens} Completion tokens: {completion_tokens} Total: {total_tokens}")

        # Access the response
        summary = response.choices[0].message.content.strip()
        return summary
