# 🤖 AI Customization Guide

Complete guide to customizing how Google Gemini AI analyzes and processes your messages.

---

## 🎯 Understanding AI Prompts

The bot uses AI in two main places:

1. **Message Analysis** - Determines if messages are informational and should be combined
2. **Image Analysis** - Describes images for blog posts

Both can be customized by editing `src/index.ts`.

---

## 📝 Message Analysis Customization

### Current Default Prompt

Located in the `analyzeMessages()` function:

```typescript
const prompt = `Analyze these Telegram messages and determine:
1. Are they informational content suitable for a blog/wiki post? (vs casual conversation)
2. Should they be combined into one post or kept separate?
3. Suggest a title for the blog post
4. Create a combined, well-formatted content if they should be combined

Messages:
${messageTexts}

Respond in JSON format:
{
  "shouldCombine": boolean,
  "isInformational": boolean,
  "suggestedTitle": "string",
  "combinedContent": "string (markdown formatted)",
  "reasoning": "string"
}`;
```

---

## 🎨 Customization Examples

### Example 1: More Strict Filtering

**Goal:** Only create posts for very high-quality, detailed content

```typescript
const prompt = `You are a content curator for a professional blog. Analyze these messages with HIGH standards:

CRITERIA FOR INFORMATIONAL CONTENT:
- Must be at least 3 sentences long
- Must contain actionable information, tutorials, guides, or insights
- Must be well-written and clear
- NO casual greetings, acknowledgments, or small talk
- NO simple questions without detailed answers
- NO emoji-only or reaction messages

Messages:
${messageTexts}

Rate the quality (1-10) and only mark as informational if 7+.

Respond in JSON:
{
  "shouldCombine": boolean,
  "isInformational": boolean,
  "qualityScore": number,
  "suggestedTitle": "string",
  "combinedContent": "string (markdown with ## headings)",
  "reasoning": "string"
}`;
```

---

### Example 2: More Lenient (Post Everything)

**Goal:** Create posts from almost any content

```typescript
const prompt = `Analyze these Telegram messages for blog posting.

INCLUSIVE CRITERIA:
- Even short messages can be informational
- Questions and answers both valuable
- Links and resources should be included
- Group conversations if related
- Only exclude: single emojis, "ok", "thanks", "lol"

Messages:
${messageTexts}

Respond in JSON:
{
  "shouldCombine": boolean,
  "isInformational": boolean,
  "suggestedTitle": "string",
  "combinedContent": "string",
  "reasoning": "string"
}`;
```

---

### Example 3: Technical Content Focus

**Goal:** Optimize for programming and technical content

```typescript
const prompt = `You are analyzing messages for a TECHNICAL blog. 

TECHNICAL CONTENT INDICATORS:
- Code snippets or commands
- Technical explanations or tutorials
- Tool recommendations
- Error solutions or debugging tips
- Architecture or design discussions
- Performance optimizations
- Security considerations

ENHANCE THE CONTENT:
- Add code syntax highlighting with \`\`\`language
- Create clear section headings with ##
- Add bullet points for lists
- Format commands in code blocks
- Include any URLs or references

Messages:
${messageTexts}

Respond in JSON with well-formatted markdown:
{
  "shouldCombine": boolean,
  "isInformational": boolean,
  "suggestedTitle": "string (descriptive, includes technology)",
  "combinedContent": "string (markdown with code blocks)",
  "reasoning": "string",
  "technologies": ["list", "of", "tech"]
}`;
```

---

### Example 4: Business/News Focus

**Goal:** Optimize for business updates and news

```typescript
const prompt = `Analyze for BUSINESS/NEWS content. 

BUSINESS CONTENT INDICATORS:
- Company announcements
- Product launches or updates
- Market trends or analysis
- Industry news
- Business strategies
- Financial information
- Partnership announcements

FORMAT AS NEWS ARTICLE:
- Start with brief summary
- Use inverted pyramid structure
- Include key facts upfront
- Add context and details
- End with implications or outlook

Messages:
${messageTexts}

Respond in JSON:
{
  "shouldCombine": boolean,
  "isInformational": boolean,
  "suggestedTitle": "string (news headline style)",
  "combinedContent": "string (news article format)",
  "category": "string (Business/Tech/Finance/etc)",
  "urgency": "high|medium|low",
  "reasoning": "string"
}`;
```

---

### Example 5: Educational Content

**Goal:** Structure content for learning

```typescript
const prompt = `Analyze for EDUCATIONAL content suitable for a learning blog.

EDUCATIONAL INDICATORS:
- Explains concepts or processes
- Provides examples or demonstrations
- Answers "how" or "why" questions
- Includes step-by-step instructions
- Teaches skills or knowledge

FORMAT AS TUTORIAL:
- **Introduction:** Brief overview
- **Prerequisites:** What's needed
- **Step-by-Step:** Numbered instructions
- **Examples:** Concrete demonstrations
- **Summary:** Key takeaways
- **Further Reading:** Related topics

Messages:
${messageTexts}

Respond in JSON:
{
  "shouldCombine": boolean,
  "isInformational": boolean,
  "suggestedTitle": "string (How to... or Understanding...)",
  "combinedContent": "string (tutorial format with sections)",
  "difficultyLevel": "beginner|intermediate|advanced",
  "estimatedTime": "string (e.g., '10 minutes')",
  "reasoning": "string"
}`;
```

---

## 🎯 Title Generation Customization

### Current Default

Titles are generated as part of the main prompt. Customize them:

```typescript
// More descriptive titles
"suggestedTitle": "string (max 80 chars, descriptive, include main topic)"

// SEO-optimized titles
"suggestedTitle": "string (include key terms, under 60 chars for SEO)"

// Catchy titles
"suggestedTitle": "string (engaging, use action words, create curiosity)"

// Date-based titles
"suggestedTitle": "string (include date if time-sensitive news)"
```

---

## 🖼️ Image Analysis Customization

### Current Default Prompt

Located in the `analyzeImage()` function:

```typescript
const result = await model.generateContent([
  'Describe this image in detail for a blog post. Focus on important information, data, or content visible in the image.',
  {
    inlineData: {
      data: imageData,
      mimeType: imageType
    }
  }
]);
```

---

### Custom Image Analysis Examples

#### Technical Screenshots

```typescript
const result = await model.generateContent([
  `Analyze this technical screenshot for a blog post.

  FOCUS ON:
  - Code snippets or commands visible
  - UI elements and their purpose
  - Error messages or warnings
  - Configuration settings
  - Terminal output
  
  FORMAT:
  - List key elements
  - Explain what's shown
  - Note any important details
  - Suggest context`,
  imageObject
]);
```

#### Diagrams and Charts

```typescript
const result = await model.generateContent([
  `Analyze this diagram/chart for a blog post.

  EXTRACT:
  - Chart type (bar, line, pie, etc.)
  - Data points and values
  - Trends or patterns
  - Labels and legends
  - Key insights or conclusions
  
  Provide a clear description that allows readers to understand the data without seeing the image.`,
  imageObject
]);
```

#### Product Screenshots

```typescript
const result = await model.generateContent([
  `Describe this product/feature screenshot.

  INCLUDE:
  - Main feature or product shown
  - Key visual elements
  - User interface highlights
  - Notable design aspects
  - What problem it solves
  
  Write in a way that explains the value to readers.`,
  imageObject
]);
```

---

## 🔧 Advanced Customization

### Add Sentiment Analysis

```typescript
async function analyzeMessages(messages: PendingMessage[]) {
  const prompt = `${standardPrompt}

  ALSO ANALYZE:
  - Sentiment: positive, neutral, negative
  - Tone: formal, casual, technical, excited
  - Urgency: high, medium, low

  Add to JSON response:
  "sentiment": "positive|neutral|negative",
  "tone": "string",
  "urgency": "high|medium|low"`;
  
  // ... rest of function
}
```

### Add Auto-Categorization

```typescript
const prompt = `${standardPrompt}

CATEGORIZE into ONE of these:
- Technology
- Business
- Tutorial
- News
- Personal
- Research
- Other

Add to JSON:
"category": "string",
"suggestedTags": ["tag1", "tag2", "tag3"]`;
```

### Add Language Detection

```typescript
const prompt = `${standardPrompt}

DETECT:
- Primary language of messages
- Should content be translated to English?

Add to JSON:
"detectedLanguage": "string (ISO code)",
"needsTranslation": boolean`;
```

---

## 📊 Improve AI Responses

### Tips for Better Prompts

1. **Be Specific:**
```typescript
// ❌ Vague
"Analyze these messages"

// ✅ Specific
"Analyze these Telegram messages to determine if they contain tutorial-style technical content suitable for a developer blog"
```

2. **Use Examples:**
```typescript
const prompt = `Analyze messages like this:

EXAMPLE INFORMATIONAL:
"Here's how to deploy to Heroku: First, create a Procfile..."
→ Should be posted

EXAMPLE NOT INFORMATIONAL:
"lol thanks"
→ Should be filtered

Now analyze:
${messageTexts}`;
```

3. **Set Clear Criteria:**
```typescript
const prompt = `Score messages 1-10 on:
1. Completeness (is it a complete thought?)
2. Usefulness (will readers benefit?)
3. Clarity (is it well-written?)

Post only if average score ≥ 7.`;
```

4. **Request Structured Output:**
```typescript
// ✅ Always request JSON
// ✅ Define exact schema
// ✅ Include all fields you need
```

---

## 🎨 Custom Content Formatting

### Add Custom Sections

```typescript
const prompt = `${standardPrompt}

FORMAT the combinedContent with these sections:
## TL;DR
[One sentence summary]

## Key Points
- Point 1
- Point 2
- Point 3

## Detailed Content
[Main content here]

## Resources
- [Any URLs or references]`;
```

### Add Metadata

```typescript
const prompt = `${standardPrompt}

Also generate metadata:
"metadata": {
  "wordCount": number,
  "readingTime": "X minutes",
  "keyTerms": ["term1", "term2"],
  "targetAudience": "beginner|intermediate|advanced",
  "contentType": "tutorial|guide|news|opinion"
}`;
```

---

## 🔄 A/B Testing Prompts

Try different prompts and see which works best:

### Test 1: Short vs Long Prompts

```typescript
// Short (faster, cheaper)
const shortPrompt = `Informational? Combine? Title? JSON only.`;

// Long (more accurate, slower)
const longPrompt = `[Your detailed 500-word prompt]`;

// Compare results over a week
```

### Test 2: Different Temperature

```typescript
const model = genAI.getGenerativeModel({ 
  model: 'gemini-1.5-flash',
  generationConfig: {
    temperature: 0.3,  // More consistent (0.0-1.0)
    // vs
    temperature: 0.9,  // More creative
  }
});
```

---

## 💾 Save and Deploy Changes

After customizing prompts:

```bash
# 1. Edit src/index.ts with your changes

# 2. Build
npm run build

# 3. Test locally (optional)
npm run dev

# 4. Deploy to Fly.io
fly deploy

# 5. Monitor results
fly logs

# 6. Check first few posts to verify AI behavior
```

---

## 📊 Monitor AI Performance

### Track Metrics

Add tracking to see how well AI is performing:

```typescript
// In processMessages function
let aiMetrics = {
  totalAnalyzed: 0,
  markedInformational: 0,
  markedCasual: 0,
  combined: 0,
  separate: 0,
  avgProcessingTime: 0
};

// Track each analysis
const startTime = Date.now();
const analysis = await analyzeMessages(messages);
const processingTime = Date.now() - startTime;

aiMetrics.totalAnalyzed++;
aiMetrics.avgProcessingTime = 
  (aiMetrics.avgProcessingTime + processingTime) / aiMetrics.totalAnalyzed;

// Log to database or console
console.log('AI Metrics:', aiMetrics);
```

---

## 🎓 Learning Resources

**Google AI Documentation:**
- Gemini API: https://ai.google.dev/docs
- Prompt Engineering: https://ai.google.dev/docs/prompt_best_practices
- Model Parameters: https://ai.google.dev/api/rest/v1/GenerationConfig

**Prompt Engineering Guides:**
- OpenAI Prompt Engineering: https://platform.openai.com/docs/guides/prompt-engineering
- Anthropic Prompt Library: https://docs.anthropic.com/claude/prompt-library

**Community Resources:**
- r/PromptEngineering: https://reddit.com/r/PromptEngineering
- Awesome Prompts: https://github.com/f/awesome-chatgpt-prompts

---

## 💡 Pro Tips

1. **Start Simple:** Begin with default prompts, customize gradually
2. **Test Thoroughly:** Try your custom prompts with various message types
3. **Monitor Results:** Check first 10-20 posts after changes
4. **Iterate:** Refine based on actual results
5. **Document Changes:** Keep notes on what works and what doesn't
6. **Version Control:** Git commit before major prompt changes
7. **Fallback:** Keep old prompts commented out for easy rollback

---

## 🚀 Ready-to-Use Prompt Templates

### Template 1: General Purpose (Balanced)

```typescript
const prompt = `Analyze Telegram messages for blog publication.

INFORMATIONAL if message:
- Provides useful information or insights
- Explains concepts or processes  
- Shares resources or recommendations
- Contains meaningful discussion (not just reactions)

COMBINE if messages are:
- Posted within ${threshold} minutes
- Related to same topic
- Part of ongoing conversation

Create engaging title (50-80 chars) and clean markdown.

Messages: ${messageTexts}

JSON response required.`;
```

### Template 2: Technical Blog

```typescript
const prompt = `Technical content analysis for developer blog.

POST if contains:
- Code, commands, or technical procedures
- Tool/framework recommendations
- Problem-solving or debugging
- Architecture or design patterns
- Performance or security topics

Format with proper code blocks, clear headings, examples.

Messages: ${messageTexts}

JSON response with technical categorization.`;
```

### Template 3: Personal Knowledge Base

```typescript
const prompt = `Personal learning archive analysis.

CAPTURE:
- New learnings or insights
- Book/article highlights
- Interesting ideas or thoughts
- Personal reflections
- Resource discoveries

Skip social pleasantries, focus on knowledge.

Messages: ${messageTexts}

JSON with personal note formatting.`;
```

---

**Experiment and have fun customizing your AI!** 🤖✨