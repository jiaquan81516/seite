// Compatibility entry point: tests now live in focused files under tests/.
const { spawnSync } = require('node:child_process');
const result = spawnSync('npm', ['test'], { stdio: 'inherit', cwd: __dirname });
process.exit(result.status ?? 1);
