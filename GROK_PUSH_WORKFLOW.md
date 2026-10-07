# 🤖 Grok AI - Push Workflow Guide

## Quick Start for Grok

### Clone Repository
```bash
git clone https://github.com/3XTRINITY-CORPORATION/Frame.-9.git
cd Frame.-9
```

### Create Your Branch
```bash
git checkout -b ai/grok/your-feature-name
```

### Example Branch Names
```bash
git checkout -b ai/grok/enhance-streaming
git checkout -b ai/grok/optimize-routing
git checkout -b ai/grok/add-function-calling
git checkout -b ai/grok/improve-error-handling
```

### Setup Environment
```bash
cp .env.example .env
npm install
# Add your XAI_API_KEY and OPENAI_API_KEY to .env
```

### Test Locally
```bash
npm start
# In another terminal:
curl http://localhost:3000/ai/health
```

### Make Your Changes
Edit files in:
- `src/services/grokProvider.js` - Grok service logic
- `src/services/multiModelRouter.js` - Routing logic
- `src/routes/aiRoutes.js` - API endpoints
- `examples/grok-example.js` - Examples
- `.env.example` - Environment variables

### Commit Changes
```bash
git add .
git commit -m "[AI] Feature: Brief description of your changes"
```

### Push to GitHub
```bash
git push origin ai/grok/your-feature-name
```

### Create Pull Request
1. Go to: https://github.com/3XTRINITY-CORPORATION/Frame.-9/pulls
2. Click "New Pull Request"
3. Select your branch `ai/grok/your-feature-name`
4. Add title: `[AI] Feature: Your enhancement`
5. Add description of changes
6. Click "Create Pull Request"

### That's It! ✅
Your changes will be automatically:
- ✅ Validated
- ✅ Tested
- ✅ Approved
- ✅ Merged

---

## Commit Message Format

Always use this format:
```
[AI] Feature: Brief description
[AI] Enhancement: Brief description
[AI] Bugfix: Brief description
[AI] Documentation: Brief description
```

## Files You Can Edit

### Safe to Edit
- ✅ `src/services/grokProvider.js`
- ✅ `src/services/chatgptProvider.js`
- ✅ `src/services/unifiedProvider.js`
- ✅ `src/services/multiModelRouter.js`
- ✅ `src/routes/aiRoutes.js`
- ✅ `examples/grok-example.js`
- ✅ `.env.example` (add new variables only)
- ✅ `package.json` (add dependencies if needed)

### Careful With
- ⚠️ `.github/workflows/*.yml` (ask first)
- ⚠️ `README.md` (update if adding features)
- ⚠️ `src/config.js` (only for config updates)

## Example: Adding a Feature

### Step 1: Create Branch
```bash
git checkout -b ai/grok/add-context-awareness
```

### Step 2: Edit grokProvider.js
```javascript
async function callGrokWithContext({
  messages,
  context,
  model = config.xai.model
}) {
  const enhancedMessages = messages.map(msg => ({
    ...msg,
    context // Add context
  }));
  
  return callGrok({
    messages: enhancedMessages,
    model
  });
}

module.exports = {
  callGrok,
  callGrokWithContext, // NEW FEATURE
  grokStream,
  name: 'grok',
  displayName: 'Grok (xAI)',
  available: () => !!config.xai.apiKey
};
```

### Step 3: Commit
```bash
git add src/services/grokProvider.js
git commit -m "[AI] Feature: Add context awareness to Grok provider"
```

### Step 4: Push
```bash
git push origin ai/grok/add-context-awareness
```

### Step 5: Create PR
- https://github.com/3XTRINITY-CORPORATION/Frame.-9/pulls
- Select your branch
- Title: `[AI] Feature: Add context awareness to Grok provider`
- Description: Explain what you added and why

### Step 6: Done! ✅
PR will be automatically approved and merged.

---

## Testing Your Changes

Before pushing, test locally:

```bash
# Start server
npm start

# Test health
curl http://localhost:3000/ai/health

# Test Grok
curl -X POST http://localhost:3000/ai/grok \
  -H "Content-Type: application/json" \
  -d '{"message":"Test message"}'

# Test routing
curl -X POST http://localhost:3000/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"provider":"auto","message":"Test message"}'
```

---

## Helpful Commands

```bash
# Check status
git status

# View changes
git diff

# View branch
git branch

# Switch branch
git checkout main

# Pull latest changes
git pull origin main

# Undo last commit (before push)
git reset --soft HEAD~1

# View commit history
git log --oneline
```

---

## Need Help?

- 📖 Read: `AI_CONTRIBUTION_WORKFLOW.md`
- 📖 Read: `COMPLETE_SETUP.md`
- 🐛 Open issue: https://github.com/3XTRINITY-CORPORATION/Frame.-9/issues
- 💬 Discussion: https://github.com/3XTRINITY-CORPORATION/Frame.-9/discussions

---

## Quick Reference

| Action | Command |
|--------|---------|
| Clone | `git clone https://github.com/3XTRINITY-CORPORATION/Frame.-9.git` |
| Branch | `git checkout -b ai/grok/feature-name` |
| Status | `git status` |
| Add | `git add .` |
| Commit | `git commit -m "[AI] Feature: description"` |
| Push | `git push origin ai/grok/feature-name` |
| PR | Open in browser at GitHub |

---

**Happy coding! 🚀**
