import { existsSync, writeFileSync } from 'node:fs';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const clean = (value) => (value ?? '').trim().replace(/^["']|["']$/g, '').trim();

const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, '');
const publishableKey = clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

const problems = [];
if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url)) {
  problems.push('NEXT_PUBLIC_SUPABASE_URL must look like https://<project-ref>.supabase.co');
}
if (!publishableKey) problems.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing');
if (publishableKey.startsWith('sb_secret_')) {
  problems.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY holds a secret key; use the sb_publishable_ key');
}
if (problems.length) {
  console.error(problems.map((p) => `build-config: ${p}`).join('\n'));
  process.exit(1);
}

writeFileSync(
  'js/config.js',
  `window.SUPABASE_CONFIG = ${JSON.stringify({ url, publishableKey })};\n`,
);
console.log(`build-config: wrote js/config.js for ${new URL(url).host}`);
