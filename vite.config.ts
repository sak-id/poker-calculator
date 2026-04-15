import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repoName = 'poker-calculator';
const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
const repoFromEnv = process.env.GITHUB_REPOSITORY?.split('/')[1];

export default defineConfig({
  plugins: [react()],
  base: isGithubActions ? `/${repoFromEnv || repoName}/` : '/',
});
