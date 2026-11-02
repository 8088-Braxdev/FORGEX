const { spawn } = require('node:child_process');
const port = process.env.FORGEX_TEST_PORT || '3100';
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port], { stdio: ['ignore', 'pipe', 'pipe'] });
let exited = false; let started = false;
server.on('exit', () => { exited = true; });
server.stdout.on('data', bytes => { if (String(bytes).includes('Ready in')) started = true; process.stdout.write(bytes); });
server.stderr.on('data', bytes => process.stderr.write(bytes));
(async () => {
  try {
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (exited) throw new Error('HTTP test server exited before readiness.');
      try { if (started && (await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!ready) throw new Error('HTTP test server did not become reachable.');
    const test = spawn(process.execPath, ['--test', 'tests/publicRoutes.test.cjs'], { stdio: 'inherit', env: { ...process.env, FORGEX_TEST_ORIGIN: origin } });
    process.exitCode = await new Promise(resolve => test.on('exit', code => resolve(code ?? 1)));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { server.kill('SIGTERM'); }
})();
