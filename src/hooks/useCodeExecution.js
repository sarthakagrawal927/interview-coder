import { useState, useCallback } from 'react';

export function useCodeExecution() {
  const [output, setOutput] = useState('');
  const [errors, setErrors] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const execute = useCallback((code, testCases) => {
    setIsRunning(true);
    setOutput('');
    setErrors(null);
    setTestResults([]);

    return new Promise((resolve) => {
      // Use setTimeout to allow UI to update before potentially blocking execution
      setTimeout(() => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.sandbox = 'allow-scripts';
        document.body.appendChild(iframe);

        const logs = [];

        try {
          // Override console methods in iframe
          iframe.contentWindow.console = {
            log: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
            error: (...args) => logs.push('ERROR: ' + args.map(a => String(a)).join(' ')),
            warn: (...args) => logs.push('WARN: ' + args.map(a => String(a)).join(' ')),
            info: (...args) => logs.push('INFO: ' + args.map(a => String(a)).join(' ')),
          };

          // Execute the user's code
          iframe.contentWindow.eval(code);

          // Run test cases
          const results = testCases?.map(tc => {
            try {
              // Try to extract function name from code
              const funcMatches = code.match(/function\s+(\w+)/g);
              let funcName = null;

              if (funcMatches) {
                // Get the first function name
                const match = funcMatches[0].match(/function\s+(\w+)/);
                funcName = match ? match[1] : null;
              }

              // Also check for const/let/var arrow functions
              if (!funcName) {
                const arrowMatch = code.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:\(|function)/);
                funcName = arrowMatch ? arrowMatch[1] : null;
              }

              if (funcName) {
                const argsStr = JSON.stringify(tc.args);
                const result = iframe.contentWindow.eval(`${funcName}(...${argsStr})`);
                const passed = JSON.stringify(result) === JSON.stringify(tc.expected);
                return { ...tc, actual: result, passed };
              }
              return { ...tc, actual: null, passed: false, error: 'No function found' };
            } catch (e) {
              return { ...tc, actual: null, passed: false, error: e.message };
            }
          }) || [];

          const outputStr = logs.join('\n');
          setOutput(outputStr);
          setErrors(null);
          setTestResults(results);
          setIsRunning(false);
          resolve({ output: outputStr, errors: null, testResults: results });
        } catch (e) {
          const outputStr = logs.join('\n');
          setOutput(outputStr);
          setErrors(e.message);
          setTestResults([]);
          setIsRunning(false);
          resolve({ output: outputStr, errors: e.message, testResults: [] });
        } finally {
          document.body.removeChild(iframe);
        }
      }, 50);
    });
  }, []);

  const clearOutput = useCallback(() => {
    setOutput('');
    setErrors(null);
    setTestResults([]);
  }, []);

  return { execute, output, errors, testResults, isRunning, clearOutput };
}
