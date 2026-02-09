# Resume Feature Research Report

## Interview Prep Studio -- Resume-Powered Personalization

**Date:** 2026-02-09
**Status:** Research Complete -- Recommended for Build

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Resume Parsing: Libraries and APIs](#1-resume-parsing-libraries-and-apis)
3. [What Data Can We Extract](#2-what-data-can-we-extract)
4. [Personalization Opportunities](#3-personalization-opportunities)
5. [Privacy Considerations](#4-privacy-considerations)
6. [Competitor Analysis](#5-competitor-analysis)
7. [Technical Feasibility](#6-technical-feasibility)
8. [MVP Recommendation](#7-mvp-recommendation)
9. [Risk Assessment](#8-risk-assessment)

---

## Executive Summary

- **Resume-powered personalization is a high-value, technically feasible feature** that can differentiate Interview Prep Studio from competitors. Most interview prep tools either ignore resumes entirely or only use them for ATS scoring -- very few generate personalized study plans, behavioral questions, or difficulty calibration from resume data.
- **A local-first, privacy-preserving approach is achievable.** PDF text extraction runs entirely in-browser using `pdfjs-dist`. The extracted raw text is then sent to an LLM (via the existing Vercel AI SDK + Anthropic integration) for structured data extraction. No resume file is ever uploaded to a server -- only the text goes to the LLM API call.
- **MVP scope is realistic for a 6-day sprint.** The core loop is: (1) user drops PDF, (2) client-side text extraction, (3) LLM structured extraction via existing server proxy, (4) personalized study plan + behavioral question generation. DOCX support and advanced features can follow in later sprints.

---

## 1. Resume Parsing: Libraries and APIs

### 1A. Client-Side (In-Browser) Options

These are the most relevant given our local-first philosophy.

#### pdfjs-dist (Mozilla PDF.js) -- RECOMMENDED for MVP

- **What:** The official npm distribution of Mozilla's PDF.js library. Extracts text, positions, font metadata from any PDF.
- **How it works:** Load PDF as ArrayBuffer, iterate pages with `page.getTextContent()`, extract `TextItem` objects containing `str` (text), `transform` (position), and font metadata.
- **Bundle size:** ~400KB gzipped (significant but acceptable for a desktop-class app).
- **TypeScript support:** Built-in type definitions since v4+.
- **Accuracy:** Excellent for text-based PDFs. Will not work for image-only/scanned resumes (would need OCR). Most modern resumes from Google Docs, Word, LaTeX are text-based.
- **Browser compatibility:** All modern browsers. Uses Web Workers for non-blocking parsing.
- **Used by:** OpenResume (the most popular open-source resume parser).

```typescript
// Simplified usage pattern
import { getDocument, TextItem } from 'pdfjs-dist';

async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((item): item is TextItem => 'str' in item)
      .map(item => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}
```

#### unpdf -- Modern Alternative

- **What:** A modern, TypeScript-first alternative to pdf-parse, built on PDF.js internally.
- **Works in:** Node.js, Deno, Bun, AND the browser.
- **Simpler API:** `extractText(buffer)` returns pages as strings.
- **Smaller footprint:** Ships a serverless-optimized build of PDF.js.
- **Consideration:** Newer library, fewer battle-tested edge cases than raw pdfjs-dist.

#### mammoth.js -- For DOCX Support (Post-MVP)

- **What:** Converts .docx files to HTML or raw text in the browser.
- **How:** Reads DOCX as ArrayBuffer using FileReader, calls `mammoth.extractRawText()`.
- **Limitation:** Does not handle .doc (old Word format). Only .docx.
- **Security note:** Mammoth performs no sanitization of source documents -- must be careful with untrusted input.
- **Bundle size:** ~60KB gzipped. Lightweight.

#### OpenResume's Parser -- Reference Architecture

OpenResume implements a 4-step client-side parsing pipeline worth studying:

1. **PDF Decoding:** Uses pdf.js to extract all text items with position metadata.
2. **Line Grouping:** Groups text items into lines based on Y-position proximity.
3. **Section Grouping:** Identifies section headers (Education, Experience, Skills) by detecting full-width bold text.
4. **Feature Scoring Extraction:** Each resume attribute has custom feature sets with matching functions and scores. Text items are scored against all feature sets; the highest-scoring item wins.

This is a rules-based approach. It works well for standard resume formats but struggles with creative layouts. For our use case, **LLM-based extraction is superior** because it handles arbitrary formats gracefully.

### 1B. Server-Side / API Options (For Reference)

These are NOT recommended for MVP given our local-first philosophy, but documented for completeness.

| Solution | Accuracy | Cost | Notes |
|----------|----------|------|-------|
| **Affinda** | High (100+ fields) | Paid API, free tier available | Best for ATS integration, overkill for our use case |
| **Textkernel (includes Sovren)** | Industry benchmark | Enterprise pricing, expensive | 2B+ resumes parsed, 29 languages. Way overkill. |
| **OpenAI / Claude Structured Outputs** | Very high with good prompts | Per-token cost | This is essentially what we will do, but with client-side text extraction first |
| **pyresparser** | Moderate | Free/open source | Python-only, unmaintained since 2023, uses spaCy/NLTK under the hood |
| **Eden AI Resume API** | Good | Aggregator pricing | Wraps multiple providers; adds latency and cost |

### 1C. Recommended Approach: Hybrid (Client Extract + LLM Structure)

**Strategy:** Extract raw text client-side with `pdfjs-dist`, then send text (NOT the PDF file) to Claude via the existing Vercel AI SDK integration for structured data extraction.

**Why this beats pure rules-based parsing:**
- Handles any resume format, layout, or writing style
- Extracts semantic meaning (e.g., understanding that "Led a team of 8 to build a real-time analytics pipeline" implies leadership, distributed systems, and streaming)
- Can infer experience level from context, not just explicit YoE
- Works with the AI infrastructure we already have (`@ai-sdk/anthropic`)

**Why this beats pure API parsing:**
- No additional vendor dependency
- Reuses our existing LLM infrastructure
- The resume text (not file) only goes to Anthropic's API -- same trust boundary as our existing AI features
- More flexible extraction schema we control

---

## 2. What Data Can We Extract

### 2A. Structured Resume Data Schema

Using Claude with structured outputs (Zod schema), we can reliably extract:

```typescript
interface ResumeData {
  // Identity (optional, user can redact)
  name?: string;
  email?: string;

  // Skills & Technologies
  skills: {
    languages: string[];        // Python, Java, TypeScript
    frameworks: string[];       // React, Spring Boot, Django
    databases: string[];        // PostgreSQL, MongoDB, Redis
    cloud: string[];            // AWS, GCP, Azure
    tools: string[];            // Docker, Kubernetes, Git
    concepts: string[];         // Distributed Systems, ML, CI/CD
  };

  // Experience
  experience: {
    company: string;
    title: string;
    duration: string;           // "2 years 3 months"
    startDate?: string;
    endDate?: string;
    highlights: string[];       // Key achievements/projects
    technologies: string[];     // Tech used in this role
    isLeadership: boolean;      // Managed people/projects
    teamSize?: number;
  }[];

  // Education
  education: {
    institution: string;
    degree: string;
    field: string;
    year?: number;
  }[];

  // Derived Insights (LLM-inferred)
  totalYearsOfExperience: number;
  experienceLevel: 'junior' | 'mid' | 'senior' | 'staff' | 'principal';
  primaryDomain: string;       // "Backend", "Frontend", "Full-Stack", "ML", "Data"
  companySizes: string[];      // "startup", "mid-size", "FAANG", "enterprise"

  // Project Summaries (for behavioral question generation)
  projects: {
    name: string;
    description: string;
    role: string;
    impact: string;
    technologies: string[];
    challenges: string[];
    isLeadershipExample: boolean;
    isConflictExample: boolean;
    isFailureRecoveryExample: boolean;
    isInnovationExample: boolean;
  }[];
}
```

### 2B. Mapping Extracted Data to Interview Prep Categories

#### DSA Mapping

| Resume Signal | DSA Topics to Emphasize |
|---------------|------------------------|
| "Python, data processing" | Arrays, Hashmaps, Sorting algorithms |
| "Backend, APIs, databases" | Trees (B-trees, indexes), Graph algorithms, System design patterns |
| "ML/Data Science" | Matrix operations, Dynamic programming, Probability |
| "Frontend, React" | Trees (DOM), BFS/DFS, Event loops, State machines |
| "Distributed systems" | Graph algorithms, Consensus, Consistent hashing |
| Junior (0-2 YoE) | Focus on Easy/Medium, pattern recognition |
| Mid (3-5 YoE) | Medium/Hard, optimization, time complexity |
| Senior (6+ YoE) | Hard problems, system design integration, mentoring scenarios |

#### LLD Mapping

| Resume Signal | LLD Topics |
|---------------|------------|
| "Java, Spring Boot" | OOP design patterns, SOLID principles, dependency injection |
| "Python, Django" | MVC patterns, ORM design, middleware chains |
| "Microservices" | Service decomposition, API design, circuit breakers |
| "E-commerce" | Payment system design, inventory management, cart system |
| "Social media" | Feed system, notification system, messaging |

#### HLD Mapping

| Resume Signal | HLD Topics |
|---------------|------------|
| "Worked at scale (millions of users)" | Focus on scalability, sharding, caching |
| "Real-time features" | WebSocket design, event-driven architecture, pub/sub |
| "Data pipeline" | Batch vs stream processing, data lake design |
| "E-commerce company" | Design Amazon, payment processing, recommendation engine |
| "Social media company" | Design Twitter feed, Instagram stories, TikTok |
| "Cloud (AWS/GCP)" | Cloud-native architecture, serverless, managed services |

#### Behavioral Mapping

This is the most powerful application. From resume projects, we can auto-generate:

| Resume Content | Generated Questions |
|----------------|-------------------|
| "Led migration from monolith to microservices" | "Tell me about a time you led a major technical initiative. What was the biggest challenge?" |
| "Improved API response time by 60%" | "Describe a time you identified and solved a performance problem. How did you measure success?" |
| "Managed team of 5 engineers" | "Tell me about your leadership style. How do you handle underperforming team members?" |
| "Built feature used by 1M+ users" | "Describe a project where you had significant user impact. How did you handle the pressure?" |
| "Worked at Amazon" | Tailor to Leadership Principles: "Give me an example of Customer Obsession in your work." |

---

## 3. Personalization Opportunities

### 3A. Auto-Generated Study Plan

Given a user's resume data + target role/company, the system can generate:

```
PERSONALIZED STUDY PLAN
========================
Target: Senior Software Engineer at Google
Current Level: Mid (3.5 YoE)
Timeline: 8 weeks

WEEK 1-2: DSA Foundations (your weakest area)
  - You have strong Python but no competitive programming background
  - Focus: Arrays, Hashmaps, Two Pointers (15 problems)
  - Priority patterns: Sliding Window, Binary Search

WEEK 3-4: DSA Advanced
  - Your backend experience maps well to Trees and Graphs
  - Focus: BFS/DFS, Dynamic Programming (20 problems)
  - Leverage your database knowledge for tree traversals

WEEK 5: Low-Level Design
  - Your Spring Boot experience is strong -- focus on design patterns
  - Practice: Parking Lot, LRU Cache, Rate Limiter

WEEK 6: System Design (your strongest area)
  - Your microservices experience at [Company] is directly relevant
  - Focus on: Designing at Google scale (10x your current experience)
  - Practice: Design YouTube, Design Google Docs

WEEK 7: Behavioral
  - Prepare STAR stories from your [Project X] and [Project Y]
  - Focus on Google's "Googleyness" and leadership signals
  - Practice: Conflict resolution (gap area -- no examples on resume)

WEEK 8: Mock interviews and review
```

### 3B. Gap Analysis

The LLM can identify gaps between the user's resume and their target role:

- **Technical gaps:** "You mention React but no backend experience -- HLD questions will focus on full-stack scenarios you may be weak on."
- **Experience gaps:** "Your resume shows individual contributor work but no leadership examples -- prepare behavioral stories that demonstrate influence without authority."
- **Domain gaps:** "Transitioning from fintech to social media -- study feed design, content ranking, and real-time messaging systems."
- **Scale gaps:** "Your experience is at startup scale (thousands of users) -- Google operates at billion-user scale. Focus on sharding, consistent hashing, and global distribution."

### 3C. Resume-Based Behavioral Question Bank

This is a unique differentiator. Instead of generic behavioral questions, we generate them FROM the user's actual experience:

**From resume line:** "Redesigned the authentication system, reducing login failures by 40%"

Generated questions:
1. "Walk me through the authentication redesign you led. What was the previous system's biggest flaw?"
2. "How did you measure the 40% reduction in login failures? What metrics did you track?"
3. "Were there any stakeholders who resisted the redesign? How did you get buy-in?"
4. "What would you do differently if you were redesigning that auth system today?"

Each question comes with:
- STAR framework hints specific to their experience
- The competency being assessed (technical leadership, metrics-driven, stakeholder management)
- Company-specific framing (e.g., for Amazon: map to "Customer Obsession" and "Dive Deep")

### 3D. Company-Specific Preparation

If the user specifies a target company, we can overlay company-specific frameworks:

| Company | Framework | Resume Mapping |
|---------|-----------|----------------|
| Amazon | 16 Leadership Principles | Map each resume project to 2-3 LPs |
| Google | "Googleyness", Technical Excellence | Focus on collaboration, impact at scale |
| Meta | "Move Fast", Impact-driven | Emphasize shipping velocity, user metrics |
| Apple | Attention to detail, Secrecy | Focus on craftsmanship, design thinking |
| Microsoft | Growth mindset, Inclusive culture | Highlight learning, mentoring, diversity |

### 3E. Difficulty Calibration

| YoE | DSA Difficulty | LLD Complexity | HLD Scope | Behavioral Depth |
|-----|---------------|----------------|-----------|-------------------|
| 0-2 | Easy/Medium | Basic patterns | Components only | Teamwork, learning |
| 3-5 | Medium/Hard | Multi-pattern | Full system | Leadership, conflict |
| 6-8 | Medium/Hard | Complex systems | Scale + tradeoffs | Strategy, mentoring |
| 8+ | Hard + variants | Architecture-level | Global scale | Org impact, vision |

---

## 4. Privacy Considerations

### 4A. Our Approach: Local-First with Informed Consent

**What stays on the client (never leaves the browser):**
- The original PDF/DOCX file
- The file's binary data
- Any extracted position/font metadata

**What goes to the LLM API (with user consent):**
- The extracted text content of the resume
- Sent via our existing server proxy to Anthropic's Claude API
- Same trust boundary as every other AI feature in the app

**What gets stored locally (localStorage/IndexedDB):**
- The structured `ResumeData` JSON
- The generated study plan
- The personalized question bank

### 4B. Privacy-Enhancing Design Decisions

1. **No server storage of resumes.** The PDF never leaves the browser. Only extracted text goes to the LLM.
2. **Optional PII redaction.** Before sending to the LLM, we can auto-strip or let users redact: name, email, phone, address. The LLM does not need PII to extract skills and experience.
3. **Transparent data flow.** Show users exactly what text will be sent to the AI before they confirm.
4. **Local storage only.** Parsed resume data stays in the browser's localStorage. No cloud sync for resume data (even if we add Supabase sync for other features).
5. **Easy deletion.** One-click "Delete my resume data" that clears all stored resume information.

### 4C. What We CAN Do Purely In-Browser (No Server)

| Feature | In-Browser Only? | Notes |
|---------|:-:|-------|
| PDF text extraction | Yes | pdfjs-dist runs entirely client-side |
| DOCX text extraction | Yes | mammoth.js runs entirely client-side |
| Basic keyword matching | Yes | Regex/string matching for skills |
| Section detection | Yes | Rules-based header detection |
| Structured data extraction | No | Needs LLM (Claude via API) |
| Study plan generation | No | Needs LLM for intelligent planning |
| Behavioral question generation | No | Needs LLM for natural language generation |
| Gap analysis | No | Needs LLM for reasoning |

**Bottom line:** Text extraction is fully local. Intelligence requires the LLM API -- same dependency we already have for all AI features in the app.

### 4D. GDPR and Compliance Notes

- Since we process resume data client-side and only send text to the LLM API (not store it), we minimize GDPR exposure.
- Anthropic's data processing terms apply (they do not train on API data by default).
- We should add a clear consent dialog: "Your resume text will be sent to our AI for analysis. The file itself never leaves your device."

---

## 5. Competitor Analysis

### 5A. Direct Competitors (Interview Prep + Resume)

#### Thita.ai
- **What they do:** DSA patterns (94 patterns, 404 problems), system design, AI mock interviews, AND resume analysis.
- **Resume features:** ATS resume checker, AI-powered resume optimization.
- **Gap:** Their resume analysis focuses on ATS scoring (will your resume pass the ATS?), NOT on generating personalized interview prep from resume content. They do not generate behavioral questions from your projects or create skill-gap study plans.
- **Our opportunity:** We go deeper -- resume as the foundation for the entire prep experience, not just an ATS check.

#### Final Round AI
- **What they do:** Real-time AI interview copilot, mock interviews, resume optimization.
- **Resume features:** Upload resume to customize mock interview questions. AI Interview Copilot suggests responses during practice.
- **Gap:** Their focus is on the interview itself (real-time assistance), not structured preparation. They do not map resume skills to DSA patterns or generate study plans.
- **Our opportunity:** We focus on preparation, not real-time assistance. We use the resume to build a complete study journey.

#### Interview Prepper
- **What they do:** Upload resume + target company/role, get personalized study plan and company-specific questions.
- **Resume features:** Analyzes experience to identify strengths and improvement areas. Claims 89% of users get offers within 30 days.
- **Gap:** Focused on behavioral/soft skills. Does not cover DSA, LLD, or HLD. No code practice.
- **Our opportunity:** We cover ALL four interview types (DSA, LLD, HLD, Behavioral) with resume personalization across each.

#### InterviewPal
- **What they do:** ATS resume scan, AI mock interviews, behavioral question prediction.
- **Resume features:** Claims 80% accuracy in predicting behavioral questions from resume.
- **Gap:** No DSA or system design coverage. No study plan generation.
- **Our opportunity:** Full-stack interview prep with resume as the personalization layer.

#### Sensei AI
- **What they do:** Real-time interview feedback, resume-based personalization, multilingual.
- **Resume features:** Uses resume for question personalization.
- **Gap:** Real-time assistant focus. Does not build structured learning paths.
- **Our opportunity:** We build the prep journey, they assist during the interview. Complementary, not competitive.

### 5B. Career Coaching Tools (Adjacent Market)

| Tool | Resume Use | Our Differentiation |
|------|-----------|---------------------|
| Interviewing.io | No resume analysis; anonymous mock interviews with senior engineers ($225/hr) | We provide AI-powered prep at no per-session cost |
| Pramp/Exponent | Peer matching based on experience, not deep resume analysis | We generate targeted practice from actual resume content |
| LeetCode | No resume features at all | We personalize problem selection and difficulty |
| NeetCode | No resume features; pattern-based curriculum | We adapt the curriculum to the user's background |
| Educative/Grokking | Static courses, no personalization | We create dynamic study plans |

### 5C. Key Insight

**No existing tool combines all four:**
1. Resume parsing for personalization
2. DSA pattern practice with code execution
3. System design (LLD + HLD) preparation
4. Behavioral question generation from actual resume projects

This is our unique value proposition. The resume becomes the "hub" that personalizes every spoke of interview preparation.

---

## 6. Technical Feasibility

### 6A. Architecture Overview

```
[User drops PDF] --> [Browser: pdfjs-dist extracts text]
                          |
                          v
                  [Show extracted text preview]
                  [User confirms / redacts PII]
                          |
                          v
              [Send text to server proxy]
                          |
                          v
          [Server: Vercel AI SDK + Claude]
          [Structured output with Zod schema]
                          |
                          v
              [Return ResumeData JSON]
                          |
                          v
        [Browser: Store in localStorage]
                          |
              +-----------+-----------+
              |           |           |
              v           v           v
        [Study Plan] [Questions] [Difficulty]
        [Generator]  [Generator] [Calibrator]
```

### 6B. Integration with Existing Codebase

The app already uses:
- `@ai-sdk/anthropic` -- Claude integration via Vercel AI SDK
- `ai` (v6) -- Core AI SDK with `generateObject` support
- React 19 + TypeScript + Vite
- Server proxy at `/server/index.mjs` for AI calls
- localStorage for progress tracking
- Supabase for auth (Google OAuth + guest mode)

**New dependencies needed:**
- `pdfjs-dist` (~400KB gzipped) -- PDF text extraction
- `mammoth` (~60KB gzipped) -- DOCX text extraction (post-MVP)

**No new infrastructure needed.** We reuse the existing server proxy and Anthropic API key.

### 6C. LLM Prompt Strategy

The extraction prompt would use Claude's structured outputs:

```typescript
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

const ResumeSchema = z.object({
  skills: z.object({
    languages: z.array(z.string()),
    frameworks: z.array(z.string()),
    databases: z.array(z.string()),
    cloud: z.array(z.string()),
    tools: z.array(z.string()),
    concepts: z.array(z.string()),
  }),
  experience: z.array(z.object({
    company: z.string(),
    title: z.string(),
    duration: z.string(),
    highlights: z.array(z.string()),
    technologies: z.array(z.string()),
    isLeadership: z.boolean(),
  })),
  totalYearsOfExperience: z.number(),
  experienceLevel: z.enum(['junior', 'mid', 'senior', 'staff', 'principal']),
  primaryDomain: z.string(),
  projects: z.array(z.object({
    name: z.string(),
    description: z.string(),
    role: z.string(),
    impact: z.string(),
    technologies: z.array(z.string()),
    challenges: z.array(z.string()),
  })),
});

const { object: resumeData } = await generateObject({
  model: anthropic('claude-sonnet-4-5-20250514'),
  schema: ResumeSchema,
  prompt: `Extract structured data from this resume text.
  Infer experience level from context, identify key projects,
  and categorize all technical skills.

  Resume text:
  ${resumeText}`,
});
```

### 6D. Token Cost Estimate

- Average resume text: ~800-1500 tokens
- System prompt + schema: ~500 tokens
- Output (structured JSON): ~1000-2000 tokens
- **Total per resume parse: ~2500-4000 tokens**
- At Claude Sonnet rates: approximately $0.01-0.03 per resume parse
- Study plan generation: additional ~2000-3000 tokens (~$0.02)
- Behavioral question generation: ~1500-2500 tokens per batch (~$0.02)

**Total cost per user onboarding: approximately $0.05-0.10** -- negligible.

---

## 7. MVP Recommendation

### Build Verdict: YES -- High Impact, Low Risk

This feature has strong product-market fit:
- Solves a real pain point (generic interview prep that does not adapt to the user)
- Technically feasible with our existing stack
- Low incremental cost (reuses AI infrastructure)
- Strong differentiation from competitors
- Aligns with local-first philosophy

### MVP Scope (6-Day Sprint)

#### Day 1: PDF Upload and Text Extraction
- Drag-and-drop / file picker UI component
- `pdfjs-dist` integration for client-side text extraction
- Text preview with PII redaction option
- Store raw text temporarily in state

#### Day 2: LLM Structured Extraction
- New server endpoint: `POST /api/parse-resume`
- Zod schema for `ResumeData`
- Claude structured output call via Vercel AI SDK
- Return and store parsed data in localStorage

#### Day 3: Profile Dashboard
- Display parsed resume data in a clean UI
- Skills visualization (tags/chips)
- Experience timeline
- Edit/correct extracted data manually
- "Re-parse" button if user updates resume

#### Day 4: Study Plan Generation
- New endpoint: `POST /api/generate-study-plan`
- Input: ResumeData + target role + target company + timeline
- Output: Week-by-week plan mapped to existing problems in each category
- Display plan with progress tracking hooks

#### Day 5: Behavioral Question Generation
- New endpoint: `POST /api/generate-behavioral-questions`
- Input: ResumeData.projects + target company
- Output: 10-15 personalized behavioral questions with STAR hints
- Integrate into the existing Behavioral category view
- Company-specific framing (Amazon LPs, Google Googleyness, etc.)

#### Day 6: Difficulty Calibration and Polish
- Auto-set difficulty filter based on experienceLevel
- Show "Recommended for you" badges on problems matching resume skills
- Gap analysis summary: "Areas to focus on" based on target role vs current skills
- Testing, edge cases, error handling
- Empty states, loading states, consent dialogs

### Post-MVP Features (Future Sprints)

- **DOCX support** via mammoth.js
- **Resume diff:** Upload updated resume, see what changed in your profile
- **Progress-aware replanning:** Adjust study plan based on completed problems
- **Mock interview mode:** AI interviewer asks resume-based behavioral questions conversationally
- **Multi-resume support:** Different resumes for different target roles
- **Export prep materials:** PDF export of personalized study plan + question bank
- **Skill radar chart:** Visual comparison of current skills vs target role requirements

### Proposed Type Additions

```typescript
// New types to add to src/types.ts

interface ResumeProfile {
  rawText: string;
  parsedData: ResumeData;
  targetRole?: string;
  targetCompany?: string;
  targetTimeline?: number; // weeks
  createdAt: string;
  updatedAt: string;
}

interface StudyPlan {
  weeks: StudyWeek[];
  totalWeeks: number;
  focusAreas: string[];
  gaps: string[];
}

interface StudyWeek {
  weekNumber: number;
  theme: string;
  category: InterviewCategory;
  problems: string[]; // problem IDs from our existing data
  goals: string[];
}

interface PersonalizedBehavioralQuestion {
  question: string;
  sourceProject: string; // which resume project this came from
  competency: string;    // what it assesses
  companyFramework?: string; // e.g., "Amazon LP: Customer Obsession"
  starHints: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
}
```

### New File Structure

```
src/
  pages/
    ResumeUpload.tsx        # Upload + text extraction + consent
    ResumeProfile.tsx       # Display parsed data + edit
    StudyPlan.tsx           # Generated study plan view
  components/
    ResumeDropzone.tsx      # Drag-and-drop file upload
    SkillsVisualization.tsx # Skills tags/chips display
    StudyPlanTimeline.tsx   # Week-by-week plan component
    GapAnalysis.tsx         # Skills gap summary
  lib/
    resume-parser.ts        # pdfjs-dist text extraction
    resume-schema.ts        # Zod schema for ResumeData
  server/
    routes/
      resume.mjs            # /api/parse-resume endpoint
      study-plan.mjs        # /api/generate-study-plan endpoint
      behavioral.mjs        # /api/generate-behavioral-questions endpoint
```

---

## 8. Risk Assessment

### Low Risk
- **PDF parsing accuracy:** pdfjs-dist is battle-tested (used by Firefox). Text-based PDFs parse reliably.
- **LLM extraction quality:** Claude with structured outputs produces consistent, schema-valid JSON. Resume text is well-structured input.
- **Cost:** Under $0.10 per user onboarding is negligible.

### Medium Risk
- **Image-based PDFs:** Scanned resumes will return no text. Mitigation: detect empty extraction and show "Scanned PDF detected -- please use a text-based PDF" message.
- **Creative resume formats:** Two-column layouts, infographic resumes may parse with scrambled text order. Mitigation: LLM is surprisingly good at making sense of jumbled resume text.
- **User expectation management:** Users may expect perfect extraction. Mitigation: Show parsed data for review/editing before generating plans.

### Low Risk (But Monitor)
- **Bundle size increase:** pdfjs-dist adds ~400KB. Acceptable for a desktop-class app, but should lazy-load the module only when the user navigates to the resume feature.
- **Anthropic API dependency:** Same as existing AI features. If API is down, resume parsing fails gracefully.

### Things to Avoid
- Do NOT store resume PDFs on any server.
- Do NOT build OCR support in the MVP (massive scope increase for marginal benefit).
- Do NOT try to support .doc (old Word format) -- only PDF and DOCX.
- Do NOT auto-parse without user consent -- always show what will be sent to the AI.

---

## Sources

- [OpenResume - Open Source Resume Builder and Parser](https://github.com/xitanggg/open-resume)
- [pdfjs-dist on npm](https://www.npmjs.com/package/pdfjs-dist)
- [unpdf - PDF Extraction for All JS Runtimes](https://github.com/unjs/unpdf)
- [mammoth.js - DOCX to HTML Converter](https://github.com/mwilliamson/mammoth.js)
- [Affinda vs Textkernel Parser Comparison](https://tobu.ai/blog/affinda-vs-textkernel-which-parser-should-i-pick/)
- [Best Resume Parsers 2026](https://parseur.com/compare-to/best-resume-parser)
- [OpenAI Structured Outputs Guide](https://platform.openai.com/docs/guides/structured-outputs)
- [Claude Structured Outputs Documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Vercel AI SDK - Anthropic Provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic)
- [Parsing Resumes with LLMs Guide](https://www.datumo.io/blog/parsing-resumes-with-llms-a-guide-to-structuring-cvs-for-hr-automation)
- [Thita.ai - Interview Prep Platform](https://thita.ai/)
- [Final Round AI - Interview Assistant](https://www.finalroundai.com)
- [Interview Prepper](https://www.interviewprepper.co/)
- [InterviewPal](https://www.interviewpal.com/)
- [Sensei AI Interview Tool](https://www.senseicopilot.com/blog/top-ai-interview-tools-2025)
- [Interviewing.io Review and Alternatives](https://igotanoffer.com/blogs/tech/interviewingio-alternatives)
- [Pramp Alternatives 2026](https://skillora.ai/blog/pramp-alternatives)
- [Best AI Interview Prep Tools 2026](https://brianvanderwaal.com/best-ai-interview-prep-tools)
- [pyresparser on PyPI](https://pypi.org/project/pyresparser/)
- [FAANG Behavioral Interview Guide](https://www.designgurus.io/blog/faang-behavioral-interview-guide)
- [STAR Method for FAANG Interviews](https://faangpath.com/blog/star-method-for-faang-interview/)
- [Extract Text from PDF with PDF.js](https://www.nutrient.io/blog/how-to-extract-text-from-a-pdf-using-javascript/)
- [Resume Parsing with LLM - LangChain Tutorial](https://www.hackersrealm.net/post/resume-parsing-with-llm)
