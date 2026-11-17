import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

async function checkPort(port) {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', () =>
      reject(
        new Error(
          `Port ${port} is already in use. Reuse your existing Seite server, or stop it before starting another.`,
        ),
      ),
    );
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}

try {
  await Promise.all([checkPort(8787), checkPort(5173)]);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const processes = [
  spawn(process.execPath, ['--watch', 'server/index.js'], { stdio: 'inherit' }),
  spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173'],
    { stdio: 'inherit' },
  ),
];
let stopped = false;
function stop(code = 0) {
  if (stopped) return;
  stopped = true;
  process.exitCode = code;
  for (const child of processes) child.kill();
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
for (const child of processes) {
  child.on('error', () => stop(1));
  child.on('exit', (code) => stop(code ?? 1));
}
