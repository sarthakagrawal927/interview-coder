import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3456;

// CLI tool configurations
const CLI_TOOLS = {
  claude: {
    command: 'claude',
    buildArgs: (systemPrompt) => {
      const args = ['-p', '--output-format', 'stream-json'];
      if (systemPrompt) args.push('--system-prompt', systemPrompt);
      return args;
    },
    inputMode: 'stdin', // send prompt via stdin
    parseStream: (line, emit) => {
      const json = JSON.parse(line);
      // claude stream-json: assistant message with content blocks
      if (json.type === 'assistant' && json.message?.content) {
        for (const block of json.message.content) {
          if (block.type === 'text' && block.text) emit(block.text);
        }
      }
      // content_block_delta style
      if (json.type === 'content_block_delta' && json.delta?.text) {
        emit(json.delta.text);
      }
      // result type (final)
      if (json.type === 'result' && json.result) {
        emit(json.result);
      }
    },
  },

  codex: {
    command: 'codex',
    buildArgs: (systemPrompt) => {
      const args = ['exec', '--json'];
      if (systemPrompt) args.push('--instructions', systemPrompt);
      return args;
    },
    inputMode: 'stdin', // prompt via stdin
    parseStream: (line, emit) => {
      const json = JSON.parse(line);
      // codex JSONL: look for message events with text content
      if (json.type === 'message' && json.content) {
        emit(json.content);
      }
      // response.output_text style
      if (json.output_text) {
        emit(json.output_text);
      }
      // handle delta events
      if (json.type === 'response.output_text.delta' && json.delta) {
        emit(json.delta);
      }
      // final response text
      if (json.type === 'response.completed' && json.response?.output_text) {
        emit(json.response.output_text);
      }
    },
  },

  gemini: {
    command: 'gemini',
    buildArgs: (systemPrompt) => {
      const args = ['--output-format', 'stream-json'];
      if (systemPrompt) args.push('--system-instruction', systemPrompt);
      return args;
    },
    inputMode: 'arg', // prompt as -p flag
    parseStream: (line, emit) => {
      const json = JSON.parse(line);
      // gemini stream-json: similar structure to claude
      if (json.type === 'assistant' && json.message?.content) {
        for (const block of json.message.content) {
          if (block.type === 'text' && block.text) emit(block.text);
        }
      }
      if (json.type === 'content_block_delta' && json.delta?.text) {
        emit(json.delta.text);
      }
      if (json.type === 'result' && json.result) {
        emit(json.result);
      }
      // gemini may also emit partialText
      if (json.partialText) {
        emit(json.partialText);
      }
      // or text field directly
      if (json.text && !json.type) {
        emit(json.text);
      }
    },
  },
};

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', tools: Object.keys(CLI_TOOLS) });
});

app.post('/api/chat', (req, res) => {
  const { messages, systemPrompt, tool = 'claude' } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const cliTool = CLI_TOOLS[tool];
  if (!cliTool) {
    return res.status(400).json({ error: `Unknown tool: ${tool}. Available: ${Object.keys(CLI_TOOLS).join(', ')}` });
  }

  // Build a single prompt from conversation history
  const conversationLines = messages.map(m => {
    const role = m.role === 'user' ? 'User' : 'Assistant';
    return `${role}: ${m.content}`;
  });
  const prompt = conversationLines.join('\n\n');

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Build CLI args
  const args = cliTool.buildArgs(systemPrompt);
  if (cliTool.inputMode === 'arg') {
    args.push('-p', prompt);
  }

  const proc = spawn(cliTool.command, args, {
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Send prompt via stdin if needed
  if (cliTool.inputMode === 'stdin') {
    proc.stdin.write(prompt);
    proc.stdin.end();
  }

  let buffer = '';
  let textSent = false;

  proc.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        cliTool.parseStream(line, (text) => {
          textSent = true;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        });
      } catch {
        // Not valid JSON or unrecognized format — try plain text fallback
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
          // Plain text output (some CLIs may not always output JSON)
          textSent = true;
          res.write(`data: ${JSON.stringify({ text: trimmed + '\n' })}\n\n`);
        }
      }
    }
  });

  proc.stderr.on('data', (data) => {
    const errText = data.toString();
    if (errText.trim()) {
      console.error(`[${tool} stderr]`, errText);
    }
  });

  proc.on('close', (code) => {
    // Flush remaining buffer
    if (buffer.trim()) {
      try {
        cliTool.parseStream(buffer, (text) => {
          textSent = true;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        });
      } catch {
        if (!textSent) {
          // If nothing was sent, try the raw buffer as plain text
          res.write(`data: ${JSON.stringify({ text: buffer.trim() })}\n\n`);
        }
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
    if (code !== 0) {
      console.error(`[${tool}] exited with code ${code}`);
    }
  });

  proc.on('error', (err) => {
    console.error(`[${tool} spawn error]`, err.message);
    res.write(`data: ${JSON.stringify({ error: `Failed to start ${tool} CLI. Is it installed?` })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  });

  // Kill subprocess if client disconnects
  req.on('close', () => {
    if (!proc.killed) {
      proc.kill('SIGTERM');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Local CLI server running on http://localhost:${PORT}`);
  console.log(`Supported tools: ${Object.keys(CLI_TOOLS).join(', ')}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
