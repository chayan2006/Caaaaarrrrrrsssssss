from flask import Flask, jsonify, request, render_template
from datetime import datetime

app = Flask(__name__)

# Home route
@app.route('/')
def home():
    # Make sure you have 'index.html' inside a 'templates' folder
    return render_template("index.html")

# Current time API
@app.route('/time', methods=['GET'])
def get_time():
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return jsonify({'time': current_time})

# Greet API
@app.route('/greet', methods=['GET'])
def greet_user():
    name = request.args.get('name', 'Guest')
    return jsonify({'message': f'Hello, {name}!'})

if __name__ == '__main__':
    # Run on localhost:5000 with debug mode on
    app.run(host='0.0.0.0', port=5000, debug=True)
