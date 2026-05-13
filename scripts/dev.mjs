import { spawn, spawnSync } from 'node:child_process';

const children = new Set();

const initial_build = spawnSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.dev.json'], {
  stdio: 'inherit',
});

if (initial_build.status !== 0) {
  process.exit(initial_build.status ?? 1);
}

const tsc_watch = spawn('pnpm', ['exec', 'tsc', '-w', '-p', 'tsconfig.dev.json', '--preserveWatchOutput', 'false'], {
  stdio: 'inherit',
});
children.add(tsc_watch);

const server = spawn('node', ['--watch', 'dist-dev/dev/dev-server.js'], {
  stdio: 'inherit',
});
children.add(server);

for (const child of children) {
  child.on('exit', () => {
    children.delete(child);
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const child of children) {
      child.kill(signal);
    }

    process.exit(0);
  });
}
