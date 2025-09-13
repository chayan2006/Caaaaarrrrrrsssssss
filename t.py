import os
import re
import pandas as pd
from io import BytesIO, StringIO
from flask import Flask, request, jsonify
from flask_cors import CORS
from textblob import TextBlob
from wordcloud import WordCloud
from transformers import pipeline, logging as hf_logging

# --- APP SETUP ---
app = Flask(__name__)
CORS(app) # Enable Cross-Origin Resource Sharing for frontend integration

# Suppress verbose logging from Hugging Face transformers
hf_logging.set_verbosity_error()

# --- MODEL INITIALIZATION ---
# Initialize the summarization pipeline from Hugging Face.
# This will download the model on the first run.
try:
    summarizer = pipeline("summarization", model="facebook/bart-large-cnn")
    print("Summarization model loaded successfully.")
except Exception as e:
    print(f"Error loading summarization model: {e}")
    summarizer = None


# --- HELPER FUNCTIONS ---

def parse_comments(file, file_extension):
    """Parses comments from different file types (txt, csv, xlsx)."""
    comments = []
    try:
        if file_extension == 'txt':
            content = file.read().decode('utf-8')
            # Split by newline and filter out empty lines
            comments = [line.strip() for line in content.split('\n') if line.strip()]
        elif file_extension == 'csv':
            df = pd.read_csv(StringIO(file.read().decode('utf-8')))
            # Assuming the comments are in the first column
            if not df.empty:
                comments = df.iloc[:, 0].dropna().astype(str).tolist()
        elif file_extension in ['xls', 'xlsx']:
            df = pd.read_excel(BytesIO(file.read()))
            # Assuming the comments are in the first column
            if not df.empty:
                comments = df.iloc[:, 0].dropna().astype(str).tolist()
    except Exception as e:
        print(f"Error parsing file: {e}")
        # Return empty list on parsing error
        return []
        
    return comments


def get_sentiment(text):
    """Analyzes sentiment of a given text using TextBlob."""
    analysis = TextBlob(text)
    # Classify polarity
    if analysis.sentiment.polarity > 0.1:
        return 'Positive'
    elif analysis.sentiment.polarity < -0.1:
        return 'Negative'
    else:
        return 'Neutral'

def generate_summary(full_text, max_length=150, min_length=30):
    """Generates a summary of the text using Hugging Face pipeline."""
    if not summarizer or not full_text:
        return "Summary could not be generated."
    try:
        # The model requires a certain length to generate a good summary.
        if len(full_text.split()) < min_length:
             return "Not enough text to generate a meaningful summary. The overall sentiment is noted."
        
        summary_result = summarizer(full_text, max_length=max_length, min_length=min_length, do_sample=False)
        return summary_result[0]['summary_text']
    except Exception as e:
        print(f"Error during summarization: {e}")
        return "Error occurred while generating the summary."


def generate_word_frequencies(full_text):
    """Generates word frequencies for a word cloud, filtering stopwords."""
    if not full_text:
        return {}
    
    # Simple list of common English stopwords
    stopwords = set([
        'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 
        'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 
        'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom', 
        'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 
        'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 
        'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 
        'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 
        'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 
        'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 
        'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 
        'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 
        'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now'
    ])

    words = re.findall(r'\b\w+\b', full_text.lower())
    
    # Filter out stopwords and single-character words
    filtered_words = [word for word in words if word not in stopwords and len(word) > 1]
    
    word_counts = {}
    for word in filtered_words:
        word_counts[word] = word_counts.get(word, 0) + 1
        
    return word_counts


# --- API ROUTES ---

@app.route('/analyze', methods=['POST'])
def analyze_comments():
    """
    Main endpoint to handle comment analysis from file or text.
    Accepts multipart/form-data with 'file' or 'comments_text'.
    """
    comments = []

    # 1. PARSE INPUT
    if 'file' in request.files and request.files['file'].filename != '':
        file = request.files['file']
        filename = file.filename
        file_extension = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
        
        allowed_extensions = {'txt', 'csv', 'xls', 'xlsx'}
        if file_extension not in allowed_extensions:
            return jsonify({"error": "Invalid file type. Please upload txt, csv, or excel files."}), 400
            
        comments = parse_comments(file, file_extension)

    elif request.form.get('comments_text'):
        text_input = request.form.get('comments_text')
        comments = [line.strip() for line in text_input.split('\n') if line.strip()]
        
    if not comments:
        return jsonify({"error": "No comments found. Please provide a file or paste text."}), 400

    # 2. PERFORM ANALYSIS
    individual_results = []
    overall_distribution = {'Positive': 0, 'Negative': 0, 'Neutral': 0}

    for comment in comments:
        sentiment = get_sentiment(comment)
        individual_results.append({"comment": comment, "sentiment": sentiment})
        if sentiment in overall_distribution:
            overall_distribution[sentiment] += 1
            
    full_text_for_processing = " ".join(comments)

    # 3. GENERATE SUMMARY AND WORD CLOUD DATA
    summary = generate_summary(full_text_for_processing)
    wordcloud_data = generate_word_frequencies(full_text_for_processing)
    
    # Sort word cloud data by frequency for easier use on the frontend
    sorted_wordcloud = sorted(wordcloud_data.items(), key=lambda item: item[1], reverse=True)
    
    # 4. PREPARE RESPONSE
    response_data = {
        "individual_results": individual_results,
        "overall_distribution": overall_distribution,
        "summary": summary,
        "wordcloud_data": dict(sorted_wordcloud[:30]) # Return top 30 words
    }

    return jsonify(response_data)


@app.route('/', methods=['GET'])
def index():
    """A simple welcome message to verify the server is running."""
    return "<h1>Sentiment Analysis Backend</h1><p>The service is running. Use the /analyze endpoint to process comments.</p>"

# --- MAIN EXECUTION ---

if __name__ == '__main__':
    # Use 0.0.0.0 to make it accessible on your local network
    app.run(host='0.0.0.0', port=5000, debug=True)
