// Lint leve sem dependências extras: sintaxe (node --check) + padrões proibidos pelo contrato.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const roots = ['server', 'shared', 'scripts', 'web/src', 'tests'];
const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|mjs)$/.test(e.name)) files.push(p);
  }
};
roots.forEach((r) => fs.existsSync(r) && walk(r));

const problems = [];
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { problems.push(`${f}: erro de sintaxe\n${e.stderr}`); }
  const src = fs.readFileSync(f, 'utf8');
  if (f.startsWith('web/')) {
    if (/import\.meta\.env\.VITE_\w*(SECRET|KEY|TOKEN|PASS|PIN)/i.test(src)) problems.push(`${f}: segredo em VITE_*`);
    if (/\b(pin|password|senha)\s*[:=]\s*['"][^'"]{3,}['"]/i.test(src)) problems.push(`${f}: credencial embutida no front`);
    if (/localStorage[^;]*(voucher|eligible|score)/i.test(src)) problems.push(`${f}: localStorage usado para estado de brinde`);
  }
  if (f.startsWith('server/') && /console\.log\([^)]*(token|password|senha|cookie)/i.test(src)) problems.push(`${f}: possível log de credencial`);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`lint ok: ${files.length} arquivos`);
