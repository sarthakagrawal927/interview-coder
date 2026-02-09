# Mock Interview + TTS/STT Research

> Research date: February 9, 2026
> Context: Extending the dsa-prep app (which already has DSA, LLD, HLD, and behavioral categories) with a resume-based mock interview feature that uses voice interaction.

---

## Table of Contents

1. [Mock Interview Questions from Resume](#1-mock-interview-questions-from-resume)
2. [Text-to-Speech (TTS) for Mock Interviews](#2-text-to-speech-tts-for-mock-interviews)
3. [Speech-to-Text (STT) for Candidate Responses](#3-speech-to-text-stt-for-candidate-responses)
4. [Full Mock Interview Flow Design](#4-full-mock-interview-flow-design)
5. [Competitive Landscape](#5-competitive-landscape)
6. [Cost Analysis](#6-cost-analysis)
7. [Phased Recommendation](#7-phased-recommendation-mvp--v2--v3)

---

## 1. Mock Interview Questions from Resume

### 1.1 Resume Parsing Strategy

**PDF Text Extraction (Browser-Side)**

| Library | Size | Browser? | Notes |
|---------|------|----------|-------|
| `pdf-parse` | ~2MB | Yes (via CDN ES module) | Zero native deps, extracts text/images/tables |
| `unpdf` | ~1.5MB | Yes (edge-optimized PDF.js redistribution) | Built for AI summarization use cases |
| `pdf.js` (Mozilla) | ~3MB | Yes (canonical) | Most battle-tested; used by Firefox |
| `pdf.js-extract` | ~3MB | Node primary | Wrapper around pdf.js with structured output |

**Recommended approach**: Use `unpdf` or `pdf-parse` in the browser to extract raw text from the uploaded PDF. Then send the extracted text (not the PDF binary) to the LLM for structured parsing. This avoids uploading files to any server.

**LLM-Powered Structured Extraction**

Once raw text is extracted, prompt Claude/GPT to return structured JSON:

```json
{
  "name": "Sarthak Agrawal",
  "currentRole": "Senior Software Engineer",
  "companies": [
    {
      "name": "Stripe",
      "role": "Senior SWE",
      "duration": "2023-present",
      "highlights": [
        "Led migration of payment processing pipeline to event-driven architecture",
        "Reduced p99 latency from 450ms to 120ms"
      ],
      "technologies": ["Go", "Kafka", "PostgreSQL", "Kubernetes"]
    }
  ],
  "skills": {
    "languages": ["Go", "Python", "TypeScript"],
    "frameworks": ["React", "Next.js"],
    "infrastructure": ["AWS", "Kubernetes", "Terraform"],
    "databases": ["PostgreSQL", "DynamoDB", "Redis"]
  },
  "education": [...],
  "projects": [...]
}
```

### 1.2 Question Generation Categories

**A. Behavioral / Experience-Based Questions**

These are the highest value since they are personalized and hard to practice generically.

| Question Type | Example | Source from Resume |
|---------------|---------|-------------------|
| Project deep-dive | "Walk me through the payment pipeline migration at Stripe. What were the key technical decisions?" | Work highlights |
| Impact quantification | "You mention reducing p99 latency by 73%. How did you measure this and what was the before/after architecture?" | Metrics in resume |
| Conflict/challenge | "Tell me about a time the migration did not go as planned. How did you handle it?" | Inferred from project scope |
| Leadership | "How did you coordinate across teams for this migration?" | Inferred from seniority |
| Technical tradeoffs | "Why event-driven architecture over request-response for this use case?" | Technologies used |

**B. Technical Deep-Dive Questions (Based on Listed Technologies)**

For each technology on the resume, generate questions at increasing difficulty:

```
Technology: Kafka
  L1: "What is Kafka and when would you use it over a traditional message queue?"
  L2: "How do you handle exactly-once delivery semantics in Kafka?"
  L3: "Your resume mentions event-driven architecture. Walk me through how you
       handled schema evolution across your Kafka topics."
```

**C. Company-Specific Question Mapping**

Map resume experiences to specific company interview frameworks:

**Amazon Leadership Principles Mapping:**

| Leadership Principle | Resume Signal | Generated Question |
|---------------------|---------------|-------------------|
| Customer Obsession | "Reduced latency by 73%" | "Tell me about a time you went above and beyond for a customer. How did the latency reduction impact end users?" |
| Ownership | "Led migration" | "Describe a time you took ownership of a project outside your immediate scope." |
| Bias for Action | Any fast-shipped project | "Tell me about a time you had to make a decision with incomplete information." |
| Dive Deep | Metrics/data mentions | "How did you identify that the payment pipeline was the bottleneck?" |
| Invent and Simplify | Architecture changes | "What alternatives did you consider before choosing event-driven architecture?" |

The system can generate 3-5 questions per leadership principle, each tied to a specific resume bullet point.

**Google:** Map to Googleyness, role-related knowledge, general cognitive ability, leadership.

**Meta:** Map to core values (Move Fast, Be Bold, Build Social Value) with resume-specific scenarios.

### 1.3 AI Interviewer with Socratic Follow-ups

The AI interviewer should not just ask questions -- it should follow up based on the candidate's answer, drilling deeper like a real interviewer.

**System Prompt Architecture:**

```
You are a senior engineering interviewer at {company}. You are interviewing
{candidate_name} for a {role} position. You have read their resume and are
now conducting a behavioral interview.

CONTEXT:
- Resume highlights: {parsed_resume_highlights}
- Current question: {current_question}
- Question intent: {what_this_question_is_assessing}

RULES:
1. Ask ONE follow-up question at a time
2. If the answer is vague, ask for specifics ("Can you give me a concrete example?")
3. If they mention a metric, probe the methodology ("How did you measure that?")
4. If they describe a team effort, probe their individual contribution
5. If they skip the "Result" in STAR, ask "What was the outcome?"
6. After 3-4 follow-ups, move to the next question
7. Keep a professional but warm tone
```

**Follow-up Decision Tree:**

```
Candidate answers question
  |
  +--> Missing Situation context? --> "Can you set the scene? What was the team size and timeline?"
  |
  +--> Missing their specific role? --> "What was your specific contribution vs the team's?"
  |
  +--> Mentioned a metric? --> "How did you measure that? What was the baseline?"
  |
  +--> Vague action? --> "Can you walk me through the technical steps you took?"
  |
  +--> No result/impact? --> "What was the outcome? How did you know it was successful?"
  |
  +--> Strong answer? --> "Great. One more thing -- what would you do differently if you did it again?"
```

### 1.4 Question Bank Generation Prompt

Here is the actual prompt template for generating the full question bank:

```
Given the following parsed resume data:
{resume_json}

Generate a structured interview question bank with:

1. BEHAVIORAL (8-10 questions):
   - 3 questions directly referencing specific projects/achievements
   - 3 questions about teamwork, conflict, and leadership
   - 2-4 questions mapped to {target_company} values

2. TECHNICAL DEEP-DIVE (6-8 questions):
   - 2 system design questions based on their domain
   - 2-3 questions on their primary language/framework
   - 2-3 questions on infrastructure/databases they listed

3. SITUATIONAL (4-6 questions):
   - Hypothetical scenarios in their domain
   - "How would you design..." based on their listed projects

For each question, provide:
- question_text: The actual question
- category: behavioral | technical | situational
- difficulty: 1-5
- assessing: What skill/trait this evaluates
- resume_anchor: Which resume bullet this ties to
- good_answer_signals: What a strong answer includes
- follow_up_prompts: 2-3 possible follow-ups
```

---

## 2. Text-to-Speech (TTS) for Mock Interviews

Making the mock interview feel real requires hearing questions spoken aloud. Here is every viable option evaluated for the "interviewer voice" use case.

### 2.1 Comparison Matrix

| Option | Cost | Quality (1-10) | Latency | Offline? | Setup Effort | Best For |
|--------|------|----------------|---------|----------|-------------|----------|
| **Web Speech API** | Free | 4-6 (OS dependent) | Instant | Yes (mostly) | Trivial | MVP / fallback |
| **Kokoro TTS (browser)** | Free | 7-8 | ~1-2s first load, then fast | Yes (fully local) | Medium | Best free option |
| **Piper TTS (browser)** | Free | 6-7 | Fast after model load | Yes (fully local) | Medium | Privacy-first |
| **OpenAI tts-1** | $15/1M chars | 8 | ~1-2s | No | Easy | Good quality, reasonable cost |
| **OpenAI gpt-4o-mini-tts** | $0.60/1M input + $12/1M audio tokens | 8-9 | ~1-2s | No | Easy | Best quality-to-price ratio |
| **ElevenLabs** | Free: 10K credits/mo | 9-10 | ~1-2s | No | Easy | Best quality overall |
| **Google Cloud TTS** | Free: 4M chars/mo (standard), 1M (WaveNet) | 7-8 | ~1s | No | Medium (API key) | High free tier |
| **Azure TTS** | Free: 0.5M chars/mo | 7-8 | ~1s | No | Medium (API key) | Enterprise use |
| **Coqui TTS (XTTS-v2)** | Free (self-hosted) | 7-8 | ~2-5s (GPU needed) | Yes (local server) | Hard | Voice cloning |

### 2.2 Detailed Analysis

#### Web Speech API (speechSynthesis) -- FREE, Zero Setup

```javascript
const utterance = new SpeechSynthesisUtterance(
  "Tell me about your experience leading the payment pipeline migration."
);
utterance.rate = 0.95;  // slightly slower for interview feel
utterance.pitch = 1.0;
utterance.voice = speechSynthesis.getVoices()
  .find(v => v.name.includes('Google') || v.name.includes('Samantha'));
speechSynthesis.speak(utterance);
```

**Pros:**
- Completely free, zero API calls
- Works offline on most platforms (uses OS speech engine)
- Instant -- no network latency
- Trivial to implement (5 lines of code)
- No rate limits

**Cons:**
- Quality varies wildly by OS: macOS voices (Samantha, Alex) are decent; Windows SAPI voices are robotic; Linux depends on installed synthesizer
- Sounds like a computer, not a human interviewer
- Limited voice selection (depends on what the OS provides)
- Cross-browser inconsistencies: Firefox has different voice support than Chrome
- Bug-prone: TTS often "works on my machine" but fails silently in other browsers
- Cannot control emphasis, pauses, or emotional tone

**Verdict:** Perfect as a **fallback** or MVP, but the robotic quality breaks immersion for a "mock interview" experience.

#### Kokoro TTS (Browser-Local via ONNX) -- FREE, High Quality -- RECOMMENDED

Kokoro is an 82M parameter TTS model that runs entirely in the browser using Transformers.js with WebGPU or WASM backend. This is the standout discovery in this research.

```javascript
import { KokoroTTS } from "kokoro-js";

const tts = await KokoroTTS.from_pretrained(
  "onnx-community/Kokoro-82M-v1.0-ONNX",
  { dtype: "q8", device: "webgpu" }  // or "wasm" fallback
);

const audio = await tts.generate(
  "Tell me about your experience with distributed systems.",
  { voice: "af_heart" }  // 48 voices available across 8 languages
);
audio.save("question.wav");
// or play directly via Web Audio API
```

**Specs:**
- Model size: ~150MB one-time download (cached after first load)
- 82M parameters (lightweight compared to 1B+ cloud models)
- 48 voices across 8 languages (American English, British English, French, Hindi, Spanish, Japanese, Chinese, Portuguese)
- WebGPU (fp32) or WASM (q8 quantized) backends
- Apache 2.0 license -- fully open source, commercial use allowed
- Chrome 120+, Edge 120+, Safari 17+ for WebGPU

**Performance:**
- GPU: ~210x real-time on RTX 4090, ~90x on 3090 Ti
- Browser WebGPU: Very fast after initial model load
- Browser WASM: Slower but works everywhere
- First load: 1-3 seconds (model initialization); subsequent calls: near-instant
- Note: There is a known WebGPU tensor operation issue; WASM may be more reliable currently

**Quality:** Excellent for a local model. Voices sound natural with good prosody and emphasis. Not quite ElevenLabs-level, but far better than Web Speech API. The interviewer voice use case (clear, professional speech) is well-suited to this model.

**Verdict:** **Best free option. This is the primary recommendation for MVP.** The 150MB one-time download is acceptable for a tool users will use repeatedly. Quality is surprisingly good for a browser-local model.

#### Piper TTS (Browser-Local via ONNX) -- FREE

```
// Available as Chrome extension or via piper-tts-web-demo
// Uses ONNX Runtime Web for in-browser inference
```

**Specs:**
- Multiple VITS-trained voices
- ONNX models running in browser
- Latest release: v1.4.1 (Feb 5, 2026)
- Now maintained by Open Home Foundation (forked from Rhasspy)

**Pros:** Open source, good voice variety, actively maintained
**Cons:** Slightly lower quality than Kokoro, less documentation for browser integration, Chrome extension model may not integrate cleanly into a web app

**Verdict:** Good alternative to Kokoro but Kokoro has better browser integration story via `kokoro-js` npm package.

#### OpenAI TTS API -- PAID, High Quality

| Model | Pricing | Quality | Notes |
|-------|---------|---------|-------|
| tts-1 | $15 / 1M characters | Good | Faster, lower quality |
| tts-1-hd | $30 / 1M characters | Very Good | Slower, higher quality |
| gpt-4o-mini-tts | $0.60/1M input tokens + $12/1M audio output tokens | Excellent | Token-based, ~$0.015/min of audio |

**Cost for mock interviews:**
- Average interview question: ~150 characters
- 20-question interview: ~3,000 characters
- With follow-ups (3 per question): ~12,000 characters total
- Cost per interview session (tts-1): $0.00018 (essentially free)
- Cost per interview session (gpt-4o-mini-tts): ~$0.01

At these prices, cost is negligible. The question is whether to add API key dependency.

**Verdict:** Best quality-to-effort ratio if the user brings their own API key. Excellent fallback when Kokoro is too slow or quality is insufficient.

#### ElevenLabs -- FREE TIER, Best Quality

**Free tier:** 10,000 credits/month (~10 minutes of TTS, or about 5 interview sessions)
**Starter plan:** $5/month for more usage
**Restriction:** Free tier is non-commercial only

At ~10 minutes free, this covers about 5 short interview sessions per month. For a personal interview prep tool, this is borderline sufficient.

**Verdict:** Best quality but free tier is too limited for heavy practice. Good for "premium" voice option.

#### Google Cloud TTS -- Generous Free Tier

**Free tier:**
- Standard voices: 4 million characters/month (free)
- WaveNet voices: 1 million characters/month (free)

**Cost math:**
- 4M characters = ~333 interview sessions (at 12K chars each)
- This is effectively unlimited for personal use

**Cons:** Requires Google Cloud account and API key setup. More setup friction than other options.

**Verdict:** Great if you want cloud TTS without cost. The free tier is absurdly generous for this use case.

#### Azure Cognitive Services TTS -- Decent Free Tier

**Free tier:** 0.5M characters/month (some sources say 5M -- verify on official pricing page)
- Conservative estimate: 0.5M = ~41 interview sessions/month

**Verdict:** Decent but Google Cloud's free tier is more generous. Only prefer if already in Azure ecosystem.

#### Coqui TTS (XTTS-v2) -- Self-Hosted, Open Source

The Coqui company shut down in December 2023, but the open-source project lives on via community fork at `github.com/idiap/coqui-ai-TTS`.

- Requires Python + GPU for reasonable speed
- XTTS-v2 supports voice cloning with 6 seconds of audio
- Cannot run in-browser (too heavy)
- Requires local server or Docker

**Verdict:** Overkill for this use case. Only relevant if voice cloning is a requirement.

### 2.3 TTS Recommendation Summary

```
Tier 1 (MVP):     Kokoro TTS (browser-local, free, good quality)
                   + Web Speech API fallback (for browsers without WebGPU/WASM support)

Tier 2 (v2):      OpenAI gpt-4o-mini-tts or tts-1 (bring-your-own-key, excellent quality)
                   or Google Cloud TTS (generous free tier)

Tier 3 (premium): ElevenLabs (best quality, limited free tier)
```

---

## 3. Speech-to-Text (STT) for Candidate Responses

The candidate needs to answer verbally and have their response transcribed for AI evaluation.

### 3.1 Comparison Matrix

| Option | Cost | Accuracy | Offline? | Latency | Setup |
|--------|------|----------|----------|---------|-------|
| **Web Speech API (SpeechRecognition)** | Free | Good (Chrome), varies elsewhere | No (Chrome sends to Google servers) | Real-time | Trivial |
| **Whisper.cpp (WASM in browser)** | Free | Excellent | Yes (fully local) | Batch (after recording) | Medium |
| **OpenAI Whisper API** | $0.006/min | Excellent | No | ~2-5s | Easy |
| **OpenAI gpt-4o-mini-transcribe** | $0.003/min | Excellent | No | ~2-5s | Easy |
| **Deepgram** | $200 free credits (~430 hrs) | Excellent | No | Real-time streaming | Medium |
| **AssemblyAI** | $50 free credits (~185 hrs) | Excellent | No | Real-time streaming | Medium |

### 3.2 Detailed Analysis

#### Web Speech API (SpeechRecognition) -- FREE, Real-Time

```javascript
const recognition = new (window.SpeechRecognition ||
  window.webkitSpeechRecognition)();
recognition.continuous = true;
recognition.interimResults = true;
recognition.lang = 'en-US';

recognition.onresult = (event) => {
  const transcript = Array.from(event.results)
    .map(r => r[0].transcript)
    .join('');
  displayTranscript(transcript);
};

recognition.start();
```

**Pros:**
- Free, zero API calls
- Real-time streaming transcription (shows words as you speak)
- No setup required
- Good accuracy for clear English speech in Chrome

**Cons:**
- Browser support: ~50/100 compatibility score. Firefox does NOT support it. Brave refuses to implement it. Safari has quirks.
- Chrome sends audio to Google servers for recognition (not truly private)
- Accuracy degrades with accents, background noise, and technical vocabulary ("Kubernetes" might become "Cooper Netties")
- No offline support in Chrome (requires internet)
- Can silently fail or stop listening

**Verdict:** Best for MVP due to zero setup. Works well in Chrome, which is the dominant browser. The real-time streaming feel is excellent for interviews.

#### Whisper.cpp (WASM) -- FREE, Local, Batch Processing

The whisper.cpp project has a working WASM build that runs OpenAI's Whisper model entirely in the browser.

**Specs:**
- Model sizes: 31MB (tiny) to ~1.5GB (large)
- Requires WASM SIMD support (all modern browsers)
- Firefox: Cannot load files >256MB (use Chrome)
- Processes audio after recording (not real-time streaming)
- Real-time streaming demo exists but is experimental

**Accuracy:** Whisper is one of the most accurate STT models available. Even the tiny model (~31MB) handles technical vocabulary well.

**Cons:**
- Batch processing (user speaks, then waits for transcription) -- breaks the conversational flow
- Model download size
- CPU-intensive in browser

**Verdict:** Good for v2 as a privacy-first option, but the batch-processing nature makes it awkward for a conversational interview. Consider using it as a post-session transcription tool.

#### OpenAI Whisper API -- CHEAP, Excellent

- $0.006/minute (standard) or $0.003/minute (gpt-4o-mini-transcribe)
- 99+ language support
- Handles accents, technical jargon, and background noise well
- File upload (not real-time streaming)

**Cost for interviews:**
- 30-minute interview session: $0.18 (standard) or $0.09 (mini)
- 100 sessions: $18 or $9

**Verdict:** Extremely cheap and accurate, but requires recording then uploading. Not real-time.

#### Deepgram -- Best Real-Time Streaming STT

- $200 free credits (no credit card required) = ~430 hours of transcription
- Real-time WebSocket streaming (words appear as you speak)
- Nova-3 model: state-of-the-art accuracy
- $0.0077/min after free credits

**Verdict:** Best STT if you want real-time streaming with high accuracy. The $200 free credit is extremely generous -- enough for hundreds of practice sessions.

#### AssemblyAI -- Good Alternative

- $50 free credits (no credit card required) = ~185 hours
- Real-time streaming available
- Good accuracy with speaker diarization

**Verdict:** Solid alternative to Deepgram with slightly less free credit.

### 3.3 STT Recommendation Summary

```
Tier 1 (MVP):     Web Speech API (free, real-time, Chrome-optimized)
                   No setup, works immediately, good enough for most users

Tier 2 (v2):      Deepgram streaming (real-time, $200 free credits, excellent accuracy)
                   or OpenAI Whisper API (batch, very cheap, best accuracy)

Tier 3 (privacy): Whisper.cpp WASM (fully local, batch processing)
```

---

## 4. Full Mock Interview Flow Design

### 4.1 User Flow Diagram

```
+------------------+     +-------------------+     +---------------------+
|  1. Upload       |     |  2. Parse         |     |  3. Generate        |
|  Resume (PDF)    | --> |  Extract text     | --> |  Question Bank      |
|                  |     |  via unpdf/       |     |  via LLM prompt     |
|                  |     |  pdf-parse        |     |  (15-25 questions)  |
+------------------+     +-------------------+     +---------------------+
                                                            |
                                                            v
+------------------+     +-------------------+     +---------------------+
|  6. AI Evaluates |     |  5. STT           |     |  4. TTS Reads       |
|  Answer +        | <-- |  Transcribes      | <-- |  Question Aloud     |
|  Feedback        |     |  User Response    |     |  (Kokoro / Web      |
|                  |     |  (Web Speech API) |     |   Speech API)       |
+------------------+     +-------------------+     +---------------------+
        |
        v
+------------------+
|  7. Follow-up    |
|  Question or     |
|  Next Question   |
|  (AI decides)    |
+------------------+
```

### 4.2 Detailed Step Breakdown

**Step 1: Resume Upload**
- User drags/drops or selects a PDF file
- Client-side only -- file never leaves the browser (for parsing)
- Show a preview of extracted text for user to verify

**Step 2: Resume Parsing**
- `unpdf` or `pdf-parse` extracts raw text in-browser
- Send extracted text to LLM (Claude/GPT via user's API key) for structured parsing
- Cache the parsed result in localStorage so they do not need to re-upload
- Display extracted: name, companies, projects, technologies, skills

**Step 3: Question Generation**
- Send structured resume data + target company/role to LLM
- Generate 15-25 questions across behavioral, technical, and situational categories
- Each question tagged with: category, difficulty, what it assesses, resume anchor
- User can review/edit the question bank before starting
- Option to select interview type: behavioral-only, technical-only, full-loop

**Step 4: TTS Reads Question**
- Primary: Kokoro TTS reads the question aloud via browser
- Fallback: Web Speech API if Kokoro model has not loaded
- Show question text on screen simultaneously (for accessibility)
- Brief pause after reading to let the candidate collect thoughts
- Visual indicator: "Interviewer is speaking..." with subtle animation

**Step 5: STT Captures Response**
- Web Speech API (`SpeechRecognition`) captures the candidate's verbal response
- Real-time transcript displayed on screen as they speak
- "Recording" indicator with timer (target: 2-3 minutes per answer)
- Manual stop button or auto-detect silence (5 seconds of silence = done)
- Option to type instead of speak (accessibility)

**Step 6: AI Evaluation**
- Send the question + transcribed answer + resume context to LLM
- Evaluation criteria:
  - STAR structure completeness (Situation, Task, Action, Result)
  - Specificity (concrete examples vs vague generalities)
  - Technical depth (for technical questions)
  - Alignment with company values (if company-specific)
  - Communication clarity
- Return: score (1-5), strengths, areas for improvement, example better answer

**Step 7: Follow-Up or Next Question**
- AI decides: follow-up (if answer was incomplete) or move to next question
- If follow-up: generate contextual question based on what was missing
- Max 3 follow-ups per main question before moving on
- Track overall session progress: "Question 4 of 12"

### 4.3 Screen Layout Design

```
+---------------------------------------------------------------+
|  Mock Interview  |  Company: Amazon  |  Role: SDE II  | Timer |
+---------------------------------------------------------------+
|                                                               |
|  [Interviewer Avatar/Icon]                                    |
|                                                               |
|  "Tell me about the payment pipeline migration you led at     |
|   Stripe. What were the main technical challenges?"           |
|                                                               |
|  [Speaker icon - playing audio]                               |
|                                                               |
+---------------------------------------------------------------+
|                                                               |
|  Your Response:                                               |
|  [Microphone icon - recording]                                |
|                                                               |
|  "So at Stripe, we had this legacy payment processing         |
|   system that was synchronous and..."                         |
|                            [Real-time transcript appears here] |
|                                                               |
|  [Stop Recording]  [Skip Question]  [Type Instead]           |
|                                                               |
+---------------------------------------------------------------+
|  Progress: Question 3/12  |  Time: 14:23  |  [End Session]   |
+---------------------------------------------------------------+
```

**Post-Answer Feedback Panel:**

```
+---------------------------------------------------------------+
|  AI Feedback                                                   |
+---------------------------------------------------------------+
|  Score: 3.5/5                                                  |
|                                                               |
|  Strengths:                                                    |
|  - Good setup of the situation and context                     |
|  - Mentioned specific technology choices (Kafka, Go)           |
|                                                               |
|  Improve:                                                      |
|  - Missing quantified result -- what was the measurable impact?|
|  - Could be more specific about YOUR role vs the team's work   |
|                                                               |
|  Follow-up from interviewer:                                   |
|  "You mentioned Kafka. How did you handle message ordering     |
|   guarantees across partitions?"                               |
|                                                               |
|  [Answer Follow-up]  [Skip to Next Question]                  |
+---------------------------------------------------------------+
```

---

## 5. Competitive Landscape

### 5.1 Existing Products

| Product | Pricing | Resume Parsing? | Voice? | Follow-ups? | Weakness |
|---------|---------|----------------|--------|-------------|----------|
| **Final Round AI** | ~$150/month | Yes | Yes (real-time copilot) | Limited | Extremely expensive; 5 session limit; designed as live interview copilot, not practice |
| **Interviews Chat** | $19-29/month | Yes | Limited | Some | Unclear plan differentiation; less focused on practice |
| **Google Interview Warmup** | Free | No | No (text only) | No | No personalization; generic questions only |
| **Pramp** | Free (peer matching) | No | Yes (live human) | Yes (human) | Requires scheduling with another person; inconsistent quality |
| **Himalayas AI Interview** | Free | Limited | Yes | Some | Generic; not deeply personalized |
| **AiApply** | Freemium | Yes | Some | Some | Broad focus (not interview-specific depth) |

### 5.2 Our Differentiation

The key gap in the market:

1. **No product combines resume-aware question generation + voice interaction + Socratic follow-ups in a free/local-first package.** Final Round AI comes closest but costs $150/month and focuses on being a live interview copilot (which is ethically questionable) rather than a practice tool.

2. **Local-first architecture.** Most competitors require cloud processing. By using Kokoro TTS + Web Speech API STT + bring-your-own LLM key, we can offer a nearly free, privacy-preserving experience.

3. **Integration with existing study system.** Our app already has DSA, LLD, HLD, and behavioral categories. A mock interview feature naturally extends this -- after studying a topic, practice being interviewed on it.

4. **Company-specific preparation.** None of the free tools map questions to specific company frameworks (Amazon LPs, Google Googleyness, etc.) using the candidate's own resume.

---

## 6. Cost Analysis

### 6.1 Per-Session Cost (MVP -- Local-First)

| Component | Technology | Cost |
|-----------|-----------|------|
| Resume parsing (PDF to text) | unpdf (browser) | $0.00 |
| Resume structuring | Claude API (~2K tokens in, ~1K out) | ~$0.01 |
| Question generation | Claude API (~2K tokens in, ~3K out) | ~$0.02 |
| TTS (questions read aloud) | Kokoro TTS (browser) | $0.00 |
| STT (candidate responses) | Web Speech API (browser) | $0.00 |
| Answer evaluation (per question) | Claude API (~1K tokens in, ~500 out) x 12 questions | ~$0.10 |
| Follow-up generation | Claude API (~500 tokens in, ~200 out) x 8 follow-ups | ~$0.03 |
| **Total per session** | | **~$0.16** |

### 6.2 Per-Session Cost (Cloud TTS/STT)

| Component | Technology | Cost |
|-----------|-----------|------|
| TTS | OpenAI tts-1 (~12K chars) | $0.00018 |
| STT | OpenAI Whisper (~30 min) | $0.18 |
| LLM calls | Same as above | ~$0.16 |
| **Total per session** | | **~$0.34** |

### 6.3 Monthly Cost Estimates

| Usage Level | Sessions/Month | MVP Cost | Cloud Cost |
|-------------|---------------|----------|------------|
| Light (2x/week) | 8 | $1.28 | $2.72 |
| Medium (daily) | 30 | $4.80 | $10.20 |
| Heavy (2x/day) | 60 | $9.60 | $20.40 |

The dominant cost is LLM API calls for answer evaluation. TTS and STT are negligible in both local and cloud configurations.

---

## 7. Phased Recommendation: MVP --> v2 --> v3

### Phase 1: MVP (6-Day Sprint)

**Goal:** Working mock interview with resume-based questions and voice interaction.

**Scope:**
- Resume upload (PDF) with client-side text extraction (`unpdf`)
- LLM-powered resume parsing and question generation (user's API key)
- Question display with TTS readout (Web Speech API -- zero setup)
- Candidate response via STT (Web Speech API `SpeechRecognition`)
- AI evaluation of each answer with STAR framework scoring
- Simple follow-up questions (1 follow-up per question)
- Session summary with overall score and improvement areas

**Tech Stack:**
- PDF parsing: `unpdf` (npm package, works in browser)
- TTS: `window.speechSynthesis` (Web Speech API)
- STT: `window.SpeechRecognition` (Web Speech API)
- LLM: User's own API key (Claude or OpenAI)
- Storage: localStorage for resume cache + question bank

**Cost to user:** ~$0.15/session (LLM API calls only)
**Dev effort:** 6 days
**Key risk:** Web Speech API quality may feel robotic and break immersion

### Phase 2: v2 (Second Sprint)

**Goal:** Significantly better voice quality and deeper interview intelligence.

**Scope (additive):**
- Kokoro TTS integration (`kokoro-js` npm package) for natural interviewer voice
  - 150MB one-time model download, cached in browser
  - WebGPU primary, WASM fallback
  - Voice selection (pick interviewer voice from 48 options)
- Company-specific question modes (Amazon LPs, Google, Meta, etc.)
- Socratic follow-up engine (3-4 contextual follow-ups per question)
- Session recording and playback (review your interview)
- Answer comparison: show "your answer" vs "ideal STAR answer" side-by-side
- Question bank editing (user can add/remove/modify questions)
- Progress tracking across sessions (improvement over time)

**Cost to user:** Still ~$0.15/session (Kokoro is free, local)
**Dev effort:** 6 days
**Key improvement:** The jump from Web Speech API to Kokoro TTS is dramatic -- feels much more like a real interview

### Phase 3: v3 (Third Sprint)

**Goal:** Premium experience with real-time streaming and analytics.

**Scope (additive):**
- Deepgram real-time STT (WebSocket streaming, much better accuracy than Web Speech API)
  - Use free $200 credits, then pay-as-you-go
- OpenAI TTS option (gpt-4o-mini-tts) for users who want cloud quality
- Full interview analytics dashboard:
  - STAR completeness scores over time
  - Common weaknesses (e.g., "you often skip the Result")
  - Time-per-answer tracking
  - Filler word detection ("um", "like", "you know")
- Multi-round interview simulation (phone screen, onsite loop)
- Peer comparison (anonymized: "you scored better than 70% of users on behavioral")
- Export: generate a PDF report of the session with scores and feedback
- Whisper.cpp WASM option for fully offline STT (privacy mode)

**Cost to user:** ~$0.30/session with cloud STT/TTS, or still ~$0.15 local-only
**Dev effort:** 6 days
**Key improvement:** Real-time streaming STT + analytics make this a professional-grade tool

### Architecture Decision Record

```
Decision: Local-first with optional cloud upgrade

Rationale:
1. Users are already providing their own LLM API key for the existing app
2. Kokoro TTS + Web Speech API STT gives a functional experience at zero marginal cost
3. Cloud APIs (OpenAI TTS, Deepgram STT) are cheap enough to offer as opt-in upgrades
4. Privacy matters for interview prep (users share sensitive resume data)
5. No backend server needed -- entire app runs client-side

Tradeoffs accepted:
- Web Speech API STT accuracy is lower than Deepgram/Whisper
- Kokoro TTS requires 150MB download on first use
- No real-time streaming STT in MVP (Web Speech API does stream, but inconsistently)
```

### Implementation Priority Order

```
Day 1: Resume upload + PDF text extraction + LLM structured parsing
Day 2: Question bank generation with company-specific modes
Day 3: Interview session UI (question display, timer, progress)
Day 4: Web Speech API TTS + STT integration
Day 5: AI answer evaluation + STAR scoring + follow-ups
Day 6: Session summary, localStorage persistence, polish
```

---

## Sources

### TTS Research
- [MDN Web Speech API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API)
- [ElevenLabs Pricing Breakdown 2026](https://flexprice.io/blog/elevenlabs-pricing-breakdown)
- [ElevenLabs API Pricing](https://elevenlabs.io/pricing/api)
- [OpenAI TTS API Pricing Calculator](https://costgoat.com/pricing/openai-tts)
- [OpenAI Pricing Page](https://platform.openai.com/docs/pricing)
- [Google Cloud TTS Pricing](https://cloud.google.com/text-to-speech/pricing)
- [Azure Speech Services Pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/)
- [Piper TTS GitHub](https://github.com/rhasspy/piper)
- [Piper TTS Web Demo](https://github.com/clowerweb/piper-tts-web-demo)
- [Coqui TTS (Idiap Fork)](https://github.com/idiap/coqui-ai-TTS)
- [Kokoro TTS Browser Guide](https://kokoroweb.app/en/blog/kokoro-tts-lightweight-browser-text-to-speech)
- [Kokoro TTS HuggingFace Model](https://huggingface.co/hexgrad/Kokoro-82M)
- [Kokoro.js NPM Package](https://www.npmjs.com/package/kokoro-js)
- [Running Kokoro ONNX in Browser](https://dev.to/emojiiii/running-kokoro-82m-onnx-tts-model-in-the-browser-eeh)
- [Best Open-Source TTS Models 2026](https://www.bentoml.com/blog/exploring-the-world-of-open-source-text-to-speech-models)
- [OpenAI gpt-4o-mini-tts Model Page](https://platform.openai.com/docs/models/gpt-4o-mini-tts)

### STT Research
- [Web Speech API SpeechRecognition (Can I Use)](https://caniuse.com/speech-recognition)
- [SpeechRecognition MDN Docs](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- [Whisper.cpp WASM Demo](https://ggml.ai/whisper.cpp/)
- [Whisper.cpp GitHub](https://github.com/ggml-org/whisper.cpp)
- [OpenAI Whisper API Pricing](https://brasstranscripts.com/blog/openai-whisper-api-pricing-2025-self-hosted-vs-managed)
- [Deepgram Pricing](https://deepgram.com/pricing)
- [AssemblyAI Pricing](https://www.assemblyai.com/pricing)

### Mock Interview Competitors
- [Final Round AI](https://www.finalroundai.com)
- [Interviews Chat](https://www.interviews.chat)
- [Best AI Mock Interview Tools 2026](https://interviewsidekick.com/blog/ai-mock-interview-tools)
- [Final Round AI Alternatives](https://skillora.ai/blog/final-round-ai-alternatives)

### Resume Parsing
- [unpdf GitHub](https://github.com/unjs/unpdf)
- [pdf-parse NPM](https://www.npmjs.com/package/pdf-parse)
- [PDF Text Extraction with PDF.js](https://www.nutrient.io/blog/how-to-extract-text-from-a-pdf-using-javascript/)

### Interview Question Frameworks
- [Amazon Leadership Principles Interview Guide](https://interviewing.io/guides/amazon-leadership-principles)
- [Amazon STAR Method Guide](https://www.interviewquery.com/p/amazon-star-method)
- [Amazon Behavioral Interview Guide](https://www.designgurus.io/blog/amazon-leadership-principles-behavioral-interview)
