import { execFileSync, spawn } from 'node:child_process';

const port = Number(process.env.PORT) || 4173;

function listeningPids() {
  try {
    const output = execFileSync(
      'lsof',
      [`-tiTCP:${port}`, '-sTCP:LISTEN'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return [...new Set(output.split(/\s+/).filter(Boolean).map(Number))];
  } catch (error) {
    if (error.status === 1) return [];
    throw new Error(`Não foi possível verificar a porta ${port} com lsof.`, { cause: error });
  }
}

function stopListeners(pids) {
  for (const pid of pids) {
    if (pid === process.pid) continue;
    try {
      process.kill(pid, 'SIGTERM');
      console.info(`Processo ${pid} encerrado para liberar a porta ${port}.`);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
}

async function waitForPortRelease(timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (listeningPids().length > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (listeningPids().length > 0) {
    throw new Error(`A porta ${port} continua ocupada após o encerramento do processo.`);
  }
}

async function main() {
  const pids = listeningPids();
  if (pids.length > 0) {
    stopListeners(pids);
    await waitForPortRelease();
  }

  const server = spawn(process.execPath, ['server.js'], {
    env: process.env,
    stdio: 'inherit',
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.kill(signal));
  }

  server.on('exit', (code, signal) => {
    if (signal) {
      const signalCode = { SIGINT: 2, SIGTERM: 15 }[signal] ?? 1;
      process.exitCode = 128 + signalCode;
    } else {
      process.exit(code ?? 1);
    }
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
