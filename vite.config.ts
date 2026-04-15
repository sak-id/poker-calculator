import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
const repoNameFromEnv = process.env.GITHUB_REPOSITORY?.split('/')[1];
const repoName = repoNameFromEnv || 'poker-calculator';

export default defineConfig({
  plugins: [react()],
  base: isGithubActions ? `/${repoName}/` : '/',
});
