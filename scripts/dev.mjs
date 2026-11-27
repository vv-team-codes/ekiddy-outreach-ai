import { spawn } from 'node:child_process';

function run(name, args) {
  const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: process.platform === 'win32'
  });
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });
  return child;
}

const processes = [
  run('backend', ['run', 'dev:backend']),
  run('frontend', ['run', 'dev:frontend'])
];

if (process.env.REDIS_URL) {
  processes.push(run('worker', ['run', 'dev:worker']));
}

function shutdown() {
  for (const child of processes) {
    child.kill();
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
