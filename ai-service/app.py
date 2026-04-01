import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes so the frontend can call it directly

# Initialize OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

@app.route('/api/chat', methods=['POST'])
def chat():
    if not client.api_key or client.api_key == 'your_openai_api_key_here':
        return jsonify({"error": "OpenAI API key not configured on the server."}), 500
        
    data = request.json
    if not data or 'message' not in data:
        return jsonify({"error": "No message provided."}), 400

    user_message = data['message']
    
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful medical and administrative assistant for ThalAI Connect, an active SOS and blood donation platform. Keep your answers clear, supportive, and concise."},
                {"role": "user", "content": user_message}
            ]
        )
        return jsonify({"reply": response.choices[0].message.content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Run the server on port 5001 to avoid conflicting with Express backend on 5000
    app.run(host='0.0.0.0', port=5001, debug=True)
