# 🤖 AI Contribution Workflow

This guide explains how AI models (Grok, ChatGPT, Claude, etc.) can contribute to the Frame.9 project using automated workflows.

---

## 📋 Quick Start for AI Models

### Option 1: Manual Contribution (Traditional Git Flow)

```bash
# 1. Clone the repository
git clone https://github.com/3XTRINITY-CORPORATION/Frame.-9.git
cd Frame.-9

# 2. Create a feature branch
git checkout -b ai/grok/my-feature

# 3. Make your changes
# Edit files in src/, add new features, etc.

# 4. Commit your changes
git add .
git commit -m "[AI] Add feature: description of what you added"

# 5. Push to GitHub
git push origin ai/grok/my-feature

# 6. Create a Pull Request
# Go to: https://github.com/3XTRINITY-CORPORATION/Frame.-9/pulls
# Click "New Pull Request" and select your branch
```

### Option 2: Automated Branch Creation (GitHub Actions)

Use the **AI Branch Creator** workflow to automatically create and set up a feature branch:

1. Go to: https://github.com/3XTRINITY-CORPORATION/Frame.-9/actions/workflows/ai-branch-creator.yml
2. Click **"Run workflow"**
3. Fill in:
   - **AI Model:** Select your model (grok, chatgpt, claude)
   - **Branch name:** Name for your feature (e.g., `enhanced-grok-integration`)
   - **Description:** Brief description of what you'll work on
4. Click **"Run workflow"**
5. Your branch will be created automatically!

---

## 🔄 Automated PR Workflow

Once you push code to a branch labeled with `[AI]` or with the `ai-contribution` label, the following happens automatically:

✅ **Code Validation** - Your code is checked for syntax and structure
✅ **Auto-Approval** - PR is automatically approved by Frame.9 Workflow
✅ **Auto-Merge** - PR is automatically merged using squash merge
✅ **Labels Added** - `ai-contribution` and `automated` labels are added
✅ **Comment Posted** - Workflow adds a confirmation comment

---

## 📝 PR Naming Convention

For automatic processing, use this format:

```
[AI] Feature Type: Brief Description

Examples:
- [AI] Feature: Add Grok streaming support
- [AI] Enhancement: Improve ChatGPT error handling
- [AI] Integration: Add Claude model support
- [AI] Bugfix: Fix timeout issue in API calls
```

---

## 🎯 Branch Naming Convention

Use this structure for your branches:

```
ai/<model>/<feature-name>

Examples:
- ai/grok/streaming-support
- ai/chatgpt/error-handling
- ai/claude/new-integration
- ai/grok/performance-optimization
```

---

## 📁 Repository Structure

When contributing, follow this structure:

```
Frame.-9/
├── src/
│   ├── config.js              # Configuration (update if needed)
│   ├── services/
│   │   └── aiProvider.js      # Main AI service (enhance this)
│   └── index.js               # Express server
├── .env.example               # Example env vars
├── package.json               # Dependencies
└── AI_CONTRIBUTION_WORKFLOW.md # This file
```

---

## 🔑 Required Files in `.env`

Make sure these are set when testing locally:

```env
# For Grok
XAI_API_KEY=your_grok_api_key

# For ChatGPT
OPENAI_API_KEY=your_openai_api_key

PORT=3000
AI_PROVIDER=auto
```

---

## ✅ Contribution Checklist

Before creating a PR, ensure:

- ✅ Code follows existing patterns in the project
- ✅ `.env.example` is updated if you added new variables
- ✅ Your branch starts with `ai/` prefix
- ✅ PR title starts with `[AI]`
- ✅ Description clearly explains what you changed
- ✅ No secrets (API keys) are committed
- ✅ Code is tested locally

---

## 🚀 Example: Adding a New AI Feature

### Step 1: Create your branch
```bash
git checkout -b ai/grok/add-function-calling
```

### Step 2: Make changes to `src/services/aiProvider.js`
```javascript
async function callGrokWithFunctions({ messages, functions, model = xai.model }) {
  // Your new feature code here
  ...
}

module.exports = {
  ...existing exports,
  callGrokWithFunctions
};
```

### Step 3: Update `.env.example` if needed
```env
# Add any new variables
GROK_FUNCTIONS_ENABLED=true
```

### Step 4: Commit and push
```bash
git add src/services/aiProvider.js .env.example
git commit -m "[AI] Feature: Add Grok function calling support"
git push origin ai/grok/add-function-calling
```

### Step 5: Create PR
- Go to https://github.com/3XTRINITY-CORPORATION/Frame.-9/pulls
- Click "New Pull Request"
- Select your branch and add description
- The workflow will auto-approve and merge!

---

## 🔗 Useful Links

- **Repository:** https://github.com/3XTRINITY-CORPORATION/Frame.-9
- **Actions:** https://github.com/3XTRINITY-CORPORATION/Frame.-9/actions
- **Pull Requests:** https://github.com/3XTRINITY-CORPORATION/Frame.-9/pulls
- **Issues:** https://github.com/3XTRINITY-CORPORATION/Frame.-9/issues
- **Discussions:** https://github.com/3XTRINITY-CORPORATION/Frame.-9/discussions

---

## 💬 Questions or Issues?

- Open an issue: https://github.com/3XTRINITY-CORPORATION/Frame.-9/issues/new
- Start a discussion: https://github.com/3XTRINITY-CORPORATION/Frame.-9/discussions/new
- Contact maintainer

---

## 📊 AI Models Currently Supported

- ✅ **Grok** (xAI) - Full integration
- ✅ **ChatGPT** (OpenAI) - Full integration
- 🔄 **Claude** (Anthropic) - In development
- 🔄 **Llama** (Meta) - Planned
- 🔄 **Mistral** - Planned

---

**Happy Contributing! 🚀**

*Powered by Frame.9 - Open AI Integration Platform*
