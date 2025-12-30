// Structured data extracted from a newsletter email
class NewsletterSection {
  heading string @description("Section heading or topic")
  summary string @description("Brief summary of this section (2-3 sentences)")
  importance "high" | "medium" | "low" @description("How important is this section")
}

class Link {
  title string @description("Link text or article title")
  url string? @description("URL if visible in text")
}

class NewsletterContent {
  title string @description("Main headline or newsletter title")
  publisher string @description("Newsletter publisher/source name")
  sections NewsletterSection[] @description("Main content sections")
  topics string[] @description("Key topics covered: technology, business, AI, science, etc.")
  keyTakeaways string[] @description("3-5 most important points from the newsletter")
  links Link[] @description("Important links mentioned in the content")
}

// Extraction function
function ExtractNewsletter(email_subject: string, email_body: string, from_address: string) -> NewsletterContent {
  client GeminiFlash
  prompt #"
    You are a newsletter content analyst. Extract structured information from this newsletter email.

    From: {{ from_address }}
    Subject: {{ email_subject }}

    Content:
    ---
    {{ email_body }}
    ---

    Extract the key information. Focus on:
    1. Identifying distinct content sections
    2. Extracting the most important takeaways (3-5 points)
    3. Categorizing topics accurately
    4. Finding relevant links and context

    {{ ctx.output_format }}
  "#
}

// Individual newsletter summary for the digest
class NewsletterSummary {
  source string @description("Newsletter source/publisher")
  headline string @description("Main topic/headline")
  summary string @description("Condensed summary based on user preference length")
  topLinks Link[]? @description("Most important links")
}

// Complete digest summary
class DigestSummary {
  periodCovered string @description("e.g., 'Dec 29-30, 2025'")
  highlights string[] @description("Top 3-5 highlights across all newsletters")
  newsletters NewsletterSummary[] @description("Individual newsletter summaries")
  closingNote string @description("Brief closing note")
}

// Summary generation function
function GenerateDigest(
  newsletters_json: string,
  interests: string[],
  summary_length: string,
  include_links: bool,
  custom_prompt: string?
) -> DigestSummary {
  client GeminiFlash
  prompt #"
    You are a personal newsletter curator. Create a digest summary for the user.

    User Interests: {{ interests }}
    Summary Length Preference: {{ summary_length }} (short=1-2 sentences per item, medium=3-4 sentences, long=full paragraph)
    Include Links: {{ include_links }}
    {% if custom_prompt %}

    Additional Instructions from User:
    {{ custom_prompt }}
    {% endif %}

    Newsletters to summarize (JSON):
    {{ newsletters_json }}

    Create a personalized digest that:
    1. Prioritizes content matching user interests
    2. Provides {{ summary_length }} summaries
    3. Highlights cross-newsletter themes in the highlights section
    4. {% if include_links %}Includes relevant links{% else %}Omits links{% endif %}
    5. Has an engaging but brief closing note
    {% if custom_prompt %}6. Follow the additional instructions provided above{% endif %}

    {{ ctx.output_format }}
  "#
}
