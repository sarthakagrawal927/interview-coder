import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProblems } from '../hooks/useProblems';
import { useCategory } from '../contexts/CategoryContext';
import type { Problem } from '../types';
import {
  fetchLeetCodeProblem,
  buildProblemFromLeetCode,
  generateSteps,
  generateAnkiCards,
} from '../lib/leetcode';
import {
  Link2,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

interface SuccessInfo {
  title: string;
  difficulty: string;
  pattern: string;
  testCases: number;
  id: string;
}

export default function ImportProblem() {
  const navigate = useNavigate();
  const { category } = useCategory();
  const { patterns, getBySlug, addCustomProblem } = useProblems(category);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<SuccessInfo | null>(null);

  const parseSlug = (leetcodeUrl: string): string | null => {
    const match = leetcodeUrl.match(/leetcode\.com\/problems\/([^/?#]+)/);
    return match ? match[1] : null;
  };

  const handleImport = async () => {
    const slug = parseSlug(url);
    if (!slug) {
      setError('Invalid LeetCode URL. Example: https://leetcode.com/problems/two-sum/');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(null);

    // Check if problem already exists in built-in or custom problems
    const existing = getBySlug(slug);
    if (existing) {
      setLoading(false);
      navigate(`/${category}/problem/${existing.id}`);
      return;
    }

    try {
      const data = await fetchLeetCodeProblem(slug);
      const q = data.data.question;
      const patternObj = patterns.find(p => p.id === q.pattern);
      const problem = buildProblemFromLeetCode(q, slug, patternObj?.name || '');

      addCustomProblem(problem);
      const pat = patterns.find(p => p.id === problem.pattern);
      setSuccess({ title: problem.title, difficulty: problem.difficulty, pattern: pat?.name || problem.pattern, testCases: (problem.testCases || []).length, id: problem.id });
    } catch (e: any) {
      // Fallback: create from slug alone
      const titleFromSlug = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const id = `custom-${slug}`;
      const steps = generateSteps(titleFromSlug, 'Medium', '');
      const ankiCards = generateAnkiCards(titleFromSlug, 'array-hashing', 'Medium')
        .map((c, i) => ({ ...c, id: `${id}-card-${i}` }));

      const problem: Problem = {
        id,
        title: titleFromSlug,
        difficulty: 'Medium',
        pattern: 'array-hashing',
        leetcodeUrl: `https://leetcode.com/problems/${slug}/`,
        leetcodeNumber: 0,
        description: '',
        starterCode: `function solution() {\n  // Your code here\n}`,
        steps,
        testCases: [],
        ankiCards,
      };

      addCustomProblem(problem);
      setError('Could not fetch full details (CORS). Imported with defaults — you can solve it and fill in details later.');
      setSuccess({ title: titleFromSlug, difficulty: 'Medium', pattern: 'Array & Hashing', testCases: 0, id });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Import Problem</h1>
        <p className="mt-1 text-sm sm:text-base text-gray-400">
          Paste a LeetCode URL — we'll do the rest.
        </p>
      </div>

      {/* URL Input */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
        <label className="mb-2 block text-sm font-medium text-gray-300">LeetCode URL</label>
        <div className="relative mb-4">
          <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(''); setSuccess(null); }}
            onKeyDown={(e) => e.key === 'Enter' && !loading && url.trim() && handleImport()}
            placeholder="https://leetcode.com/problems/two-sum/"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 py-3 pl-10 pr-4 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-blue-500/50"
          />
        </div>

        <button
          onClick={handleImport}
          disabled={loading || !url.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Fetching from LeetCode...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Import Problem
            </>
          )}
        </button>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-yellow-400 mt-0.5" />
            <p className="text-xs text-yellow-300">{error}</p>
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-lg border border-green-500/20 bg-green-500/5 p-4">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span className="text-sm font-medium text-green-400">Imported successfully!</span>
            </div>
            <div className="space-y-1 text-xs text-gray-300">
              <p><span className="text-gray-500">Title:</span> {success.title}</p>
              <p><span className="text-gray-500">Difficulty:</span> <DiffBadge d={success.difficulty} /></p>
              <p><span className="text-gray-500">Pattern:</span> {success.pattern}</p>
              <p><span className="text-gray-500">Test cases:</span> {success.testCases} extracted</p>
            </div>
            <button
              onClick={() => navigate(`/${category}/problem/${success.id}`)}
              className="mt-4 w-full rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              Start Solving
            </button>
          </div>
        )}
      </div>

      {/* Import another */}
      {success && (
        <button
          onClick={() => { setUrl(''); setSuccess(null); setError(''); }}
          className="mt-4 w-full rounded-lg border border-gray-800 bg-gray-900 py-3 text-sm text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
        >
          Import another problem
        </button>
      )}
    </div>
  );
}

function DiffBadge({ d }: { d: string }) {
  const c: Record<string, string> = { Easy: 'text-green-400', Medium: 'text-yellow-400', Hard: 'text-red-400' };
  return <span className={c[d] || 'text-gray-400'}>{d}</span>;
}
