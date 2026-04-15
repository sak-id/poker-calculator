import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repoName = 'poker-calculator';
const isGithubActions = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  plugins: [react()],
  base: isGithubActions ? `/${repoName}/` : '/',
});
