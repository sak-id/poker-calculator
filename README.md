# Poker Calculator (Texas Hold'em)

対面テキサスホールデム向けの、シンプルなチップ計算プロトタイプです。

## ローカルで確認

```bash
npm ci
npm run dev
```

`http://localhost:5173` を開くと動作確認できます。

## GitHub Pages で確認（最短）

このリポジトリには GitHub Actions で Pages にデプロイするワークフローを含めています。

### 1) GitHub の設定
1. リポジトリの **Settings > Pages** を開く
2. **Build and deployment** の Source を **GitHub Actions** に設定

### 2) push する
- `main` ブランチに push すると自動でデプロイされます。

### 3) URL を開く
- デプロイ完了後、`https://<your-account>.github.io/<your-repository>/` で確認できます。

> GitHub Actions でのデプロイ時、Vite の `base` は `GITHUB_REPOSITORY` から自動決定されます。
> ローカル実行時のみフォールバックとして `poker-calculator` を使います。

## build

```bash
npm run build
```
