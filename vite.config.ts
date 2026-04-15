import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
const repoFromEnv = process.env.GITHUB_REPOSITORY?.split('/')[1];
const repoName = repoFromEnv ?? 'poker-calculator';

export default defineConfig({
  plugins: [react()],
  base: isGithubActions ? `/${repoName}/` : '/',
});
