// First-run helper, same on macOS, Linux and Windows: npm run setup
// Checks the tools this project needs, creates .env from .env.example and prints what to do next.
import { copyFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const isWindows = process.platform === 'win32';
const MODELS = ['qwen3-vl:4b-instruct', 'nomic-embed-text'];
let problems = 0;

const ok = (msg) => console.log(`  ok   ${msg}`);
const fail = (msg, fix) => { problems++; console.log(`  !!   ${msg}\n       -> ${fix}`); };

function run(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 15_000 }).toString().trim();
  } catch {
    return null;
  }
}

const install = {
  docker: isWindows ? 'winget install Docker.DockerDesktop  (needs WSL 2; restart afterwards)' : 'install Docker Desktop from https://www.docker.com/products/docker-desktop',
  ollama: isWindows ? 'winget install Ollama.Ollama  (then open a new terminal)' : 'brew install ollama',
};

console.log(`\nStyling Agent setup (${isWindows ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux'})\n`);

const [major, minor] = process.versions.node.split('.').map(Number);
if (major > 22 || (major === 22 && minor >= 9)) ok(`Node ${process.versions.node}`);
else fail(`Node ${process.versions.node} is too old (need 22.9+)`, isWindows ? 'winget install OpenJS.NodeJS.LTS' : 'brew install node');

if (existsSync('.env')) ok('.env exists (left as is)');
else {
  copyFileSync('.env.example', '.env');
  ok('.env created from .env.example');
}

const docker = run('docker --version');
if (!docker) fail('Docker not found', install.docker);
else if (!run('docker info --format "{{.ServerVersion}}"')) fail(`${docker}, but Docker Desktop is not running`, 'start Docker Desktop and wait until it says "running"');
else ok(docker);

const ollama = run('ollama --version');
if (!ollama) fail('Ollama not found', install.ollama);
else {
  ok(ollama.split('\n').at(-1));
  const list = run('ollama list');
  if (list === null) {
    fail('Ollama is installed but not running', isWindows ? 'open the Ollama app from the Start menu' : 'run `ollama serve` in its own terminal (or `brew services start ollama`)');
  } else {
    for (const model of MODELS) {
      if (list.includes(model)) ok(`model ${model}`);
      else fail(`model ${model} not downloaded`, `ollama pull ${model}`);
    }
  }
}

console.log(problems
  ? `\nFix the ${problems} item(s) above, then run "npm run setup" again.\n`
  : `\nAll set. Next:
  npm run db:up      # local Postgres (skip if DATABASE_URL in .env points at Neon)
  npm run migrate
  npm run import
  npm run enrich
  npm run dev        # then open http://localhost:5173\n`);
process.exitCode = problems ? 1 : 0;
