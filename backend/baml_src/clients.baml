// OpenRouter client for Gemini Flash
client<llm> GeminiFlash {
  provider "openai-generic"
  options {
    base_url "https://openrouter.ai/api/v1"
    api_key env.OPENROUTER_API_KEY
    model "@preset/gemini-flash"
    headers {
      "HTTP-Referer" "https://brewsletter.app"
      "X-Title" "Brewsletter Newsletter Aggregator"
    }
  }
}
