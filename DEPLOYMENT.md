# Quick Deployment Guide

Follow these steps to get your vocabulary trainer deployed and syncing across devices.

## Step 1: Push to GitHub

```bash
# Navigate to your project
cd /Users/kailu/Desktop/Projects/dk-illustrated-dictionary

# Initialize git (if not already done)
git init
git add .
git commit -m "Add GitHub Gist sync and deployment workflow"

# Create repository on GitHub first, then:
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
git push -u origin main
```

## Step 2: Enable GitHub Pages

1. Go to `https://github.com/YOUR-USERNAME/YOUR-REPO-NAME/settings/pages`
2. Under **Source**, select: **GitHub Actions**
3. Wait 1-2 minutes for the first deployment

Your app will be live at:
```
https://YOUR-USERNAME.github.io/YOUR-REPO-NAME
```

## Step 3: Create GitHub Gist (One-Time Setup)

### Create the Gist

1. Visit [https://gist.github.com/](https://gist.github.com/)
2. Filename: `known-words.json`
3. Content:
   ```json
   {
     "knownWords": [],
     "lastUpdated": "",
     "totalCount": 0
   }
   ```
4. Click **Create secret gist**
5. **Copy the Gist ID** from URL (the long alphanumeric string)

Example URL: `https://gist.github.com/username/a1b2c3d4e5f6...`
→ Gist ID is: `a1b2c3d4e5f6...`

### Create Access Token

1. Visit [https://github.com/settings/tokens/new](https://github.com/settings/tokens/new)
2. Note: `DK Dictionary Sync`
3. Select scope: **✅ gist** (only this one!)
4. Click **Generate token**
5. **COPY THE TOKEN NOW** (you can't see it again!)

Example token: `ghp_abc123XYZ...`

## Step 4: Configure Each Device

### On MacBook

1. Open `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME`
2. Click **⚙️** (settings button)
3. Enter:
   - Gist ID: `a1b2c3d4e5f6...`
   - Token: `ghp_abc123XYZ...`
4. Click **Save Settings**

### On iPhone/iPad

1. Open Safari
2. Go to `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME`
3. Click **⚙️** (settings button)
4. Enter the **same Gist ID and Token**
5. Click **Save Settings**

## Step 5: Sync Workflow

### First Time Setup

On MacBook (or device with most progress):
1. Mark some words as known
2. Click **⬆ Push** to upload to Gist

On iPhone/iPad:
1. Click **⬇ Pull** to download from Gist
2. You should see the same known words!

### Daily Usage

**On MacBook:**
- Pull in the morning → Learn → Push at end of session

**On iPhone (during commute):**
- Pull first → Learn on the go → Push when done

**Important:** Always pull before starting, push when done!

## Troubleshooting

### App not loading after deployment

- Wait 2-3 minutes after first push
- Check Actions tab: `https://github.com/YOUR-USERNAME/YOUR-REPO-NAME/actions`
- Make sure workflow completed successfully (green checkmark)

### Push/Pull not working

**Error: "GitHub API error: 404"**
- Gist ID is wrong. Check the Gist URL and copy just the ID part.

**Error: "GitHub API error: 401"**
- Token is wrong or expired. Generate a new token.

**Error: "known-words.json not found"**
- File name in Gist must be exactly `known-words.json` (case-sensitive)

### Token Security

Your token is stored only in your browser's localStorage on each device:
- It's never sent anywhere except GitHub's API
- It's not in your GitHub repository
- It's not accessible to other websites
- You can revoke it anytime in GitHub settings

## Advanced: Update the App

To update the app with new features:

```bash
# Make changes to files in web-app/
# Then commit and push:
git add .
git commit -m "Update app with new features"
git push

# GitHub Actions will automatically redeploy!
```

## Testing Locally Before Deploying

```bash
cd web-app
python3 -m http.server 8000
```

Open: [http://localhost:8000](http://localhost:8000)

Test sync functionality with your real Gist (it's safe!).

---

## Summary Checklist

- [ ] Repository created and pushed to GitHub
- [ ] GitHub Pages enabled (Source: GitHub Actions)
- [ ] Gist created with `known-words.json`
- [ ] Personal Access Token generated (gist scope)
- [ ] MacBook configured (Gist ID + Token)
- [ ] iPhone configured (same Gist ID + Token)
- [ ] iPad configured (same Gist ID + Token)
- [ ] Tested Push from one device
- [ ] Tested Pull from another device
- [ ] Verified sync works!

**You're all set!** 🎉
