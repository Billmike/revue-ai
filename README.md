<div align="center">
  <img src="icons/icon-128.png" alt="RevueAI Logo" width="80"/>
  <h1>RevueAI</h1>
  <p>AI-Powered Code Review Assistant for GitHub Pull Requests</p>
</div>

## 🚀 Features

- 🤖 Automated code review suggestions using AI
- 🎯 Precise, line-specific comments on GitHub PRs
- 🔒 Secure token management with local encryption
- ⚡ Real-time feedback on code changes
- 🎨 Clean, intuitive user interface

## 📖 Overview

RevueAI is a Chrome extension that enhances your GitHub pull request workflow by providing intelligent, automated code reviews. It analyzes your PR changes and provides contextual suggestions, helping you catch potential issues before they reach production.

## ⚙️ Installation

1. Install from the [chrome store](https://chromewebstore.google.com/detail/eopnhkmpfhenpnmlnfibhceafplgfifj?utm_source=item-share-cp)
2. Click the RevueAI icon in your Chrome toolbar
3. Open Settings and enter your:
   - GitHub token
   - LLM API key
4. Start using RevueAI on any GitHub pull request!

## 🔑 Token Setup

### GitHub Token
1. Go to GitHub Settings → Developer Settings → Personal Access Tokens
2. Generate a new token with these permissions:
   - `repo` (Full control of private repositories)
   - `pull_requests` (Read and write)

### LLM API Key
1. Get your LLM API key
2. Ensure you have sufficient credits/quota

## 🛠️ Development Setup

```bash
# Clone the repository
git clone https://github.com/Billmike/revueai.git

# Navigate to the project directory
cd revueai

# Install dependencies (if any)
npm install

# Load in Chrome:
# 1. Open Chrome
# 2. Go to chrome://extensions/
# 3. Enable Developer Mode
# 4. Click "Load unpacked"
# 5. Select the project directory