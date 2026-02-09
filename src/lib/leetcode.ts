import type { Problem } from '../types';

export const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

export const TAG_TO_PATTERN: Record<string, string> = {
  'array': 'array-hashing', 'hash-table': 'array-hashing', 'string': 'array-hashing',
  'two-pointers': 'two-pointers', 'three-sum': 'two-pointers',
  'sliding-window': 'sliding-window',
  'stack': 'stack', 'monotonic-stack': 'stack',
  'binary-search': 'binary-search',
  'linked-list': 'linked-list',
  'tree': 'trees', 'binary-tree': 'trees', 'binary-search-tree': 'trees', 'depth-first-search': 'trees', 'breadth-first-search': 'trees',
  'trie': 'tries',
  'heap-priority-queue': 'heap',
  'backtracking': 'backtracking',
  'graph': 'graphs', 'topological-sort': 'graphs', 'shortest-path': 'graphs', 'union-find': 'graphs',
  'dynamic-programming': 'dp-1d',
  'greedy': 'greedy',
  'interval': 'intervals', 'merge-intervals': 'intervals', 'line-sweep': 'intervals',
  'math': 'math-geometry', 'geometry': 'math-geometry', 'matrix': 'math-geometry',
  'bit-manipulation': 'bit-manipulation',
};

export function stripHtml(html: string): string {
  return html
    .replace(/<pre[^>]*>/gi, '\n```\n')
    .replace(/<\/pre>/gi, '\n```\n')
    .replace(/<code>/gi, '`').replace(/<\/code>/gi, '`')
    .replace(/<strong>/gi, '**').replace(/<\/strong>/gi, '**')
    .replace(/<em>/gi, '*').replace(/<\/em>/gi, '*')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li>/gi, '- ').replace(/<\/li>/gi, '\n')
    .replace(/<p>/gi, '\n').replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function detectPattern(tags: string[]): string {
  if (!tags || tags.length === 0) return 'array-hashing';
  const priority = ['trie', 'heap-priority-queue', 'backtracking', 'graph', 'topological-sort', 'union-find',
    'sliding-window', 'binary-search', 'linked-list', 'tree', 'binary-tree', 'binary-search-tree',
    'dynamic-programming', 'stack', 'monotonic-stack', 'two-pointers', 'greedy',
    'bit-manipulation', 'interval', 'merge-intervals', 'math', 'geometry',
    'hash-table', 'array', 'string'];
  for (const tag of priority) {
    if (tags.includes(tag) && TAG_TO_PATTERN[tag]) return TAG_TO_PATTERN[tag];
  }
  return 'array-hashing';
}

export function parseTestCasesFromDescription(desc: string, _funcName: string) {
  const tests: { args: any[]; expected: any; description: string }[] = [];
  const blocks = desc.split(/(?=\*?\*?Example\s*\d)/i);
  for (const block of blocks) {
    const inputMatch = block.match(/Input:\s*(.+?)(?:\n|Output)/s);
    const outputMatch = block.match(/Output:\s*(.+?)(?:\n|Explanation|$)/s);
    if (inputMatch && outputMatch) {
      try {
        const inputRaw = inputMatch[1].trim();
        const outputRaw = outputMatch[1].trim();
        const argParts = inputRaw.split(/,\s*(?=\w+\s*=)/);
        const args = argParts.map(part => {
          const valMatch = part.match(/=\s*(.+)/);
          if (!valMatch) return part.trim();
          const val = valMatch[1].trim();
          try { return JSON.parse(val); } catch { }
          if (/^".*"$/.test(val) || /^'.*'$/.test(val)) return val.slice(1, -1);
          if (!isNaN(Number(val))) return Number(val);
          if (val === 'true') return true;
          if (val === 'false') return false;
          return val;
        });

        let expected: any;
        try { expected = JSON.parse(outputRaw); } catch {
          if (!isNaN(Number(outputRaw))) expected = Number(outputRaw);
          else if (outputRaw === 'true') expected = true;
          else if (outputRaw === 'false') expected = false;
          else expected = outputRaw;
        }

        tests.push({
          args,
          expected,
          description: `Example ${tests.length + 1}`,
        });
      } catch { /* skip malformed */ }
    }
  }
  return tests;
}

export function generateSteps(title: string, difficulty: string, _description: string) {
  return [
    {
      title: 'Understand the Problem',
      hint: `Read the problem carefully. What are the inputs and outputs? What constraints exist?`,
      approach: `Break down "${title}" — identify the input types, output type, and edge cases from the examples.`,
    },
    {
      title: 'Brute Force Approach',
      hint: `What is the simplest way to solve this, even if slow?`,
      approach: `Think about the most straightforward solution. Consider nested loops or trying all possibilities.`,
      code: `// TODO: Write your brute force solution here`,
      complexity: difficulty === 'Easy' ? 'Time: O(n^2), Space: O(1)' : difficulty === 'Medium' ? 'Time: O(n^2), Space: O(n)' : 'Time: O(2^n), Space: O(n)',
    },
    {
      title: 'Optimal Approach',
      hint: `Can you use a specific data structure or technique to improve the time complexity?`,
      approach: `Look for patterns: can a hash map, two pointers, sorting, or dynamic programming help reduce complexity?`,
      code: `// TODO: Write your optimal solution here`,
      complexity: difficulty === 'Easy' ? 'Time: O(n), Space: O(n)' : difficulty === 'Medium' ? 'Time: O(n log n), Space: O(n)' : 'Time: O(n^2), Space: O(n)',
    },
  ];
}

export function generateAnkiCards(title: string, pattern: string, difficulty: string) {
  return [
    {
      front: `What pattern/technique is most useful for "${title}"?`,
      back: `Pattern: ${pattern}\nDifficulty: ${difficulty}\n\nThink about the key data structure or algorithm that makes this problem efficient.`,
    },
    {
      front: `What is the optimal time complexity for "${title}"?`,
      back: `Consider the constraints and what the lower bound for the problem could be. A hash map gives O(1) lookups, sorting gives O(n log n), etc.`,
    },
  ];
}

export async function fetchLeetCodeProblem(slug: string): Promise<any> {
  const query = {
    query: `query getQuestionDetail($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionId
        title
        difficulty
        content
        topicTags { slug }
        codeSnippets { lang langSlug code }
        exampleTestcaseList
        similarQuestions
      }
    }`,
    variables: { titleSlug: slug },
  };

  const leetcodeUrl = 'https://leetcode.com/graphql';

  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxyUrl = CORS_PROXIES[i](leetcodeUrl);
    try {
      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.data?.question) return data;
    } catch { /* try next proxy */ }
  }
  throw new Error('Could not fetch from LeetCode. All proxies failed.');
}

export function parseSimilarQuestions(raw: string | null | undefined): { title: string; titleSlug: string; difficulty: string }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((q: any) => q.titleSlug && !q.isPaidOnly)
      .map((q: any) => ({ title: q.title, titleSlug: q.titleSlug, difficulty: q.difficulty }));
  } catch {
    return [];
  }
}

export function buildProblemFromLeetCode(q: any, slug: string, patternName: string): Problem {
  const title = q.title;
  const difficulty = q.difficulty;
  const tags = q.topicTags?.map((t: any) => t.slug) || [];
  const patternId = detectPattern(tags);
  const description = q.content ? stripHtml(q.content) : '';
  const jsSnippet = q.codeSnippets?.find((s: any) => s.langSlug === 'javascript');
  const starterCode = jsSnippet?.code || `function solution() {\n  // Your code here\n}`;

  const fnMatch = starterCode.match(/(?:var|const|let)?\s*(\w+)\s*=\s*function|function\s+(\w+)/);
  const funcName = fnMatch ? (fnMatch[1] || fnMatch[2]) : 'solution';

  const testCases = parseTestCasesFromDescription(description, funcName);
  const steps = generateSteps(title, difficulty, description);
  const id = `custom-${slug}`;
  const ankiCards = generateAnkiCards(title, patternName || patternId, difficulty)
    .map((c, i) => ({ ...c, id: `${id}-card-${i}` }));

  const similarQuestions = parseSimilarQuestions(q.similarQuestions);

  return {
    id,
    title,
    difficulty,
    pattern: patternId,
    leetcodeUrl: `https://leetcode.com/problems/${slug}/`,
    leetcodeNumber: parseInt(q.questionId) || 0,
    description,
    starterCode,
    steps,
    testCases,
    ankiCards,
    similarQuestions,
  };
}
