# GitHub Gist Setup - Quick Reference

Keep this handy when configuring your devices!

## What You Need

1. **Gist ID** - from your Gist URL
2. **Personal Access Token** - from GitHub settings

---

## Create Your Gist (One Time)

1. Go to: [gist.github.com](https://gist.github.com/)
2. Create file: `known-words.json`
3. Paste this content:

```json
{
  "knownWords": [],
  "lastUpdated": "",
  "totalCount": 0
}
```

4. Click **Create secret gist**
5. Copy the ID from URL: `https://gist.github.com/username/THIS_IS_THE_ID`

---

## Create Your Token (One Time)

1. Go to: [github.com/settings/tokens/new](https://github.com/settings/tokens/new)
2. Note: `DK Dictionary Sync`
3. Check **ONLY**: ✅ gist
4. Click **Generate token**
5. **COPY IT NOW!** (you won't see it again)

Looks like: `ghp_abcdefg123456789...`

---

## Configure App (On Each Device)

1. Open the vocabulary app
2. Click ⚙️ button
3. Paste:
   - **Gist ID**: `abc123def456...`
   - **Token**: `ghp_xyz...`
4. Click **Save**

---

## How to Sync

| Action | Button | What It Does |
|--------|--------|--------------|
| **Download** | ⬇ Pull | Replace local words with Gist |
| **Upload** | ⬆ Push | Replace Gist with local words |

**Best Practice:**
1. Pull when you open the app
2. Learn and mark words
3. Push before closing the app

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't push/pull | Check Gist ID and Token are correct |
| 404 error | Wrong Gist ID |
| 401 error | Wrong token or expired |
| File not found | Filename must be `known-words.json` |

---

## Security Notes

✅ Token stored only in your browser
✅ Never shared with anyone
✅ Only used to access YOUR Gist
✅ Can be revoked anytime at [github.com/settings/tokens](https://github.com/settings/tokens)

---

**Save this file for reference when setting up new devices!**
