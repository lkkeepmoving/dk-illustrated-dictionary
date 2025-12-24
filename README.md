# DK Illustrated Dictionary - Interactive Vocabulary Trainer

An interactive web app for learning vocabulary from the DK Illustrated Dictionary. Mark words as known, sync across devices using GitHub Gist, and track your progress.

## Features

- **Interactive Learning**: Click on masked words to reveal and hear pronunciation
- **Progress Tracking**: Mark words as known and track learning progress
- **Cross-Device Sync**: Sync known words across MacBook, iPhone, and iPad using GitHub Gist
- **Offline Support**: Works offline with localStorage, sync when ready
- **Export**: Download known words as CSV
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile

## Live Demo

Once deployed, your app will be available at:
```
https://<your-username>.github.io/<repository-name>
```

## Setup Instructions

### 1. Create GitHub Repository

1. Create a new repository on GitHub (e.g., `dk-illustrated-dictionary`)
2. Clone or push this project to your repository:

```bash
cd /Users/kailu/Desktop/Projects/dk-illustrated-dictionary
git init
git add .
git commit -m "Initial commit: Interactive vocabulary trainer"
git branch -M main
git remote add origin https://github.com/<your-username>/<repository-name>.git
git push -u origin main
```

### 2. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Under **Source**, select **GitHub Actions**
4. The workflow will automatically deploy when you push to `main` branch

### 3. Setup GitHub Gist for Syncing

To sync known words across devices:

#### Create a GitHub Gist

1. Go to [gist.github.com](https://gist.github.com/)
2. Create a new **secret** or **public** Gist
3. Name the file: `known-words.json`
4. Add initial content:
   ```json
   {
     "knownWords": [],
     "lastUpdated": "",
     "totalCount": 0
   }
   ```
5. Click **Create secret gist**
6. Copy the **Gist ID** from the URL (e.g., `https://gist.github.com/<username>/abc123def456` → ID is `abc123def456`)

#### Create a Personal Access Token

1. Go to [GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens/new)
2. Click **Generate new token (classic)**
3. Give it a name like "DK Dictionary Sync"
4. Select scope: **gist** only
5. Click **Generate token**
6. **Copy the token immediately** (you won't see it again!)

#### Configure in the App

1. Open your deployed app (or run locally)
2. Click the **⚙️ Settings** button
3. Enter your **Gist ID** and **GitHub Token**
4. Click **Save Settings**

Your token is stored locally in your browser's localStorage - it never leaves your device!

### 4. Using the Sync Feature

#### On Your MacBook
1. Mark words as known while learning
2. Click **⬆ Push** to upload your known words to GitHub Gist

#### On Your iPhone/iPad
1. Open the app in Safari
2. Click **⚙️ Settings** and enter the same Gist ID and Token
3. Click **⬇ Pull** to download known words from Gist
4. Mark additional words as you learn
5. Click **⬆ Push** to sync back

**Sync Strategy**: Last write wins. Pull overwrites local data, Push overwrites Gist data. Always push from the device with the most recent changes.

## Local Development

To run locally without deploying:

```bash
cd web-app
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000)

## Project Structure

```
dk-illustrated-dictionary/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions deployment workflow
├── source-materials/
│   ├── page-*.png              # Original dictionary page images
│   └── vocabulary-list.csv     # Word coordinates and text
├── web-app/                    # Deployed to GitHub Pages
│   ├── index.html              # Main app interface
│   ├── app.js                  # Application logic & sync
│   ├── styles.css              # Styling
│   ├── data.json               # Vocabulary data
│   ├── images/                 # Dictionary page images
│   └── reset.html              # Clear localStorage (dev tool)
└── README.md
```

## How It Works

### Vocabulary Learning

1. **Gray Overlay** = New word (not learned yet)
2. Click to **reveal** the word and hear pronunciation
3. Click the **✓ button** to mark as known
4. **Green dot** = Known word (click to unmark if needed)

### Syncing Across Devices

```
┌─────────────────────────────────────────┐
│  MacBook, iPhone, iPad                   │
│  - App runs in browser                   │
│  - Known words stored in localStorage    │
└───────────────┬─────────────────────────┘
                │
         Push ⬆ │ ⬇ Pull
                │
┌───────────────▼─────────────────────────┐
│  GitHub Gist                             │
│  - known-words.json                      │
│  - Version controlled                    │
│  - Free, secure storage                  │
└─────────────────────────────────────────┘
```

### GitHub Pages Deployment

- **Automatic**: Pushes to `main` branch trigger deployment
- **Manual**: Go to Actions → Deploy to GitHub Pages → Run workflow
- **No build step needed**: Pure HTML/CSS/JavaScript

## Troubleshooting

### Sync Not Working

1. **Check Gist ID**: Make sure it's just the ID (e.g., `abc123def456`), not the full URL
2. **Check Token**: Generate a new token with `gist` scope
3. **Check Token Permissions**: Token must have `gist` scope enabled
4. **Check Gist File Name**: Must be exactly `known-words.json`
5. **Check Browser Console**: Open DevTools → Console for error messages

### Token Security

- Your token is stored **only in your browser's localStorage**
- It's never sent anywhere except GitHub's Gist API
- For extra security, use a secret Gist (not public)
- You can revoke the token anytime in GitHub settings

### Clear All Data

To reset everything (useful for testing):

1. Visit `<your-app-url>/reset.html`
2. Or manually: Browser DevTools → Application → Local Storage → Clear

## Privacy & Security

- ✅ All processing happens **client-side** in your browser
- ✅ No backend server or database
- ✅ Your GitHub token stays on **your device only**
- ✅ Gist can be private (secret) for personal use
- ✅ Open source - inspect the code yourself!

## Browser Compatibility

- ✅ Chrome/Edge (recommended)
- ✅ Safari (MacBook, iPhone, iPad)
- ✅ Firefox
- ⚠️ Requires JavaScript and localStorage enabled

## License

Personal educational use. Dictionary content © DK Publishing.

## Credits

Built with vanilla JavaScript, no frameworks required. Uses:
- GitHub Pages for hosting
- GitHub Gist for data storage
- Browser localStorage for offline support
- Web Speech API for pronunciation

---

**Enjoy learning vocabulary!** 📚✨
