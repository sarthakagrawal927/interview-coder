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
      const args = ['-p', '--output-format', 'stream-json', '--verbose'];
      if (systemPrompt) args.push('--system-prompt', systemPrompt);
      return args;
    },
    inputMode: 'stdin',
    parseStream: (line, emit) => {
      const json = JSON.parse(line);
      if (json.type === 'assistant' && json.message?.content) {
        for (const block of json.message.content) {
          if (block.type === 'text' && block.text) emit(block.text);
        }
        return;
      }
      if (json.type === 'content_block_delta' && json.delta?.text) {
        emit(json.delta.text);
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
    inputMode: 'stdin',
    parseStream: (line, emit) => {
      const json = JSON.parse(line);
      if (json.type === 'message' && json.content) emit(json.content);
      if (json.output_text) emit(json.output_text);
      if (json.type === 'response.output_text.delta' && json.delta) emit(json.delta);
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
    inputMode: 'arg',
    parseStream: (line, emit) => {
      const json = JSON.parse(line);
      if (json.type === 'assistant' && json.message?.content) {
        for (const block of json.message.content) {
          if (block.type === 'text' && block.text) emit(block.text);
        }
        return;
      }
      if (json.type === 'content_block_delta' && json.delta?.text) emit(json.delta.text);
      if (json.partialText) emit(json.partialText);
      if (json.text && !json.type) emit(json.text);
    },
  },
};

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', tools: Object.keys(CLI_TOOLS) });
});

app.post('/api/chat', (req, res) => {
  const { messages, systemPrompt, tool, provider } = req.body;
  const toolName = provider || tool || 'claude';

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const cliTool = CLI_TOOLS[toolName];
  if (!cliTool) {
    return res.status(400).json({ error: `Unknown provider: ${toolName}. Available: ${Object.keys(CLI_TOOLS).join(', ')}` });
  }

  const prompt = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const args = cliTool.buildArgs(systemPrompt);
  if (cliTool.inputMode === 'arg') args.push('-p', prompt);

  const proc = spawn(cliTool.command, args, {
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

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
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
          textSent = true;
          res.write(`data: ${JSON.stringify({ text: trimmed + '\n' })}\n\n`);
        }
      }
    }
  });

  proc.stderr.on('data', (data) => {
    const errText = data.toString().trim();
    if (errText) console.error(`[${toolName} stderr]`, errText);
  });

  proc.on('close', (code) => {
    if (buffer.trim()) {
      try {
        cliTool.parseStream(buffer, (text) => {
          textSent = true;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        });
      } catch {
        if (!textSent) {
          res.write(`data: ${JSON.stringify({ text: buffer.trim() })}\n\n`);
        }
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
    if (code !== 0) console.error(`[${toolName}] exited with code ${code}`);
  });

  proc.on('error', (err) => {
    console.error(`[${toolName} spawn error]`, err.message);
    res.write(`data: ${JSON.stringify({ error: `Failed to start ${toolName} CLI. Is it installed?` })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  });

  res.on('close', () => {
    if (!proc.killed) proc.kill('SIGTERM');
  });
});

app.listen(PORT, () => {
  console.log(`Local CLI server running on http://localhost:${PORT}`);
  console.log(`Supported tools: ${Object.keys(CLI_TOOLS).join(', ')}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
