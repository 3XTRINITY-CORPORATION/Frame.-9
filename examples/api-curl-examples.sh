#!/bin/bash

# Frame.9 AI Gateway - cURL Examples
# Make sure the server is running: npm start

BASE_URL="http://localhost:3000"

echo "🚀 Frame.9 AI Gateway - API Examples\n"

# 1. Health Check
echo "1️⃣  Health Check"
echo "---"
curl -s "$BASE_URL/ai/health" | jq
echo ""

# 2. List Available Providers
echo "2️⃣  Available Providers"
echo "---"
curl -s "$BASE_URL/ai/providers" | jq
echo ""

# 3. Chat with Auto Provider Selection
echo "3️⃣  Chat - Auto Selection"
echo "---"
curl -s -X POST "$BASE_URL/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "auto",
    "message": "What is the capital of France?",
    "systemPrompt": "You are a helpful AI assistant."
  }' | jq
echo ""

# 4. Chat with Grok
echo "4️⃣  Chat - Grok Provider"
echo "---"
curl -s -X POST "$BASE_URL/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "grok",
    "message": "Explain quantum computing",
    "temperature": 0.7
  }' | jq
echo ""

# 5. Chat with ChatGPT
echo "5️⃣  Chat - ChatGPT Provider"
echo "---"
curl -s -X POST "$BASE_URL/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "chatgpt",
    "message": "Write a Python function to check if a number is prime"
  }' | jq
echo ""

# 6. Grok Direct
echo "6️⃣  Grok Direct Endpoint"
echo "---"
curl -s -X POST "$BASE_URL/ai/grok" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the latest AI trends?"
  }' | jq
echo ""

# 7. ChatGPT Direct
echo "7️⃣  ChatGPT Direct Endpoint"
echo "---"
curl -s -X POST "$BASE_URL/ai/chatgpt" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Suggest a good JavaScript framework"
  }' | jq
echo ""

# 8. Compare Providers
echo "8️⃣  Compare Multiple Providers"
echo "---"
curl -s -X POST "$BASE_URL/ai/compare" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What makes a good software developer?"
  }' | jq
echo ""

echo "✅ Examples complete!"
