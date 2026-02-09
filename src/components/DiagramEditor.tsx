import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import '@excalidraw/excalidraw/index.css';

const Excalidraw = lazy(() =>
  import('@excalidraw/excalidraw').then(mod => ({ default: mod.Excalidraw }))
);

const STORAGE_PREFIX = 'diagram-';

function loadDiagram(problemId: string) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + problemId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDiagram(problemId: string, elements: any[], appState: any) {
  localStorage.setItem(
    STORAGE_PREFIX + problemId,
    JSON.stringify({ elements, appState: { zoom: appState.zoom, scrollX: appState.scrollX, scrollY: appState.scrollY } })
  );
}

export default function DiagramEditor({ problemId }: { problemId: string }) {
  const [initialData, setInitialData] = useState<any>(undefined);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const saved = loadDiagram(problemId);
    setInitialData(saved || { elements: [], appState: {} });
  }, [problemId]);

  const handleChange = useCallback(
    (elements: any[], appState: any) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveDiagram(problemId, elements, appState);
      }, 500);
    },
    [problemId]
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  if (!initialData) return null;

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center bg-gray-950">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            <span className="ml-2 text-sm text-gray-500">Loading diagram editor...</span>
          </div>
        }
      >
        <Excalidraw
          initialData={initialData}
          onChange={handleChange}
          theme="dark"
        />
      </Suspense>
    </div>
  );
}
