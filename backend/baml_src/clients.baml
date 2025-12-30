// OpenRouter client for Gemini Flash
client<llm> GeminiFlash {
  provider "openai-generic"
  options {
    base_url "https://openrouter.ai/api/v1"
    api_key env.OPENROUTER_API_KEY
    model "google/gemini-3-flash-preview"
    headers {
      "HTTP-Referer" "https://brewsletter.app"
      "X-Title" "Brewsletter Newsletter Aggregator"
    }
  }
}
