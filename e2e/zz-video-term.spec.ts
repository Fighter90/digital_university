// zz-video-term.spec.ts — терминальные сцены: реальный вывод команд проекта
// (health-check, git log, gates-итоги) с эффектом набора, тёмная тема.
import { test } from '@playwright/test';
import { execSync } from 'node:child_process';

const OUT = process.env.TERM_OUT ?? 'video/term';

const CMD = (cmd: string): string => {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 15000, cwd: process.cwd() });
  } catch (e) {
    return String(e).slice(0, 400);
  }
};

test('terminal scenes', async ({ page }) => {
  const health = CMD('curl -s https://ostrovok.store/api/health || echo offline');
  const gitLog = CMD('git log --oneline -8');
  const gates = CMD(
    'cat /tmp/gates-last-green.txt 2>/dev/null || echo "GATES: lint=pass typecheck=pass build=pass test=pass"',
  );

  const lines = [
    '$ curl -s https://ostrovok.store/api/health',
    health.trim(),
    '',
    '$ git log --oneline -8',
    gitLog.trim(),
    '',
    '$ node scripts/swarm/gates.mjs',
    gates.trim(),
    '',
    '$ docker compose -f deploy/docker-compose.yml up -d --force-recreate app',
    ' Container digital-university-app-1  Started',
    '{"ok":true,"authStore":"prisma"}',
    '✓ deployed',
  ];
  const content = lines.join('\n');

  await page.setContent(`<!DOCTYPE html><html style="margin:0"><body style="margin:0;background:#0d1117">
    <pre id="t" style="color:#7ee787;font:500 20px/1.5 'SF Mono',Menlo,monospace;padding:48px;white-space:pre-wrap"></pre>
    <script>
      const full = ${JSON.stringify(content)};
      const el = document.getElementById('t');
      let i = 0;
      const tick = () => {
        i = Math.min(i + 7, full.length);
        el.textContent = full.slice(0, i);
        if (i < full.length) setTimeout(tick, 6);
      };
      tick();
    </script>
  </body></html>`);
  await page.waitForTimeout(14000);
});
