/**
 * Interactive Vocabulary Learning Application
 *
 * Features:
 * - Three word states: new (gray overlay), known (visible with checkmark), unmastered (orange overlay)
 * - Click to reveal words and hear American English pronunciation
 * - Export known words as CSV
 * - Progress tracking with localStorage
 */

// ============================================================================
// STATE MANAGEMENT
// ============================================================================
// Version: 2024-12-24 with is_learning_word support

class VocabularyApp {
    constructor() {
        this.data = null;
        this.currentViewPage = 1; // Current view page (group of 5 pages)
        this.totalPages = 0; // Total number of dictionary pages
        this.pagesPerView = 5; // Number of pages to show at once
        this.pageKeys = [];

        // Multi-user support
        this.users = this.loadUsers();
        this.currentUser = this.loadCurrentUser();
        this.wordStates = this.loadWordStates();
        this.settings = this.loadSettings();

        // Speech synthesis
        this.synth = window.speechSynthesis;
        this.voice = null;

        // Search index
        this.wordIndex = null; // Will be built after data loads

        this.init();
    }

    async init() {
        await this.loadData();
        this.buildWordIndex();
        this.setupVoice();
        this.populateUserSelector();
        this.setupEventListeners();
        this.restoreLastPage();
        this.renderPage();
    }

    // ========================================================================
    // DATA LOADING
    // ========================================================================

    async loadData() {
        try {
            const response = await fetch('data.json');
            this.data = await response.json();
            this.pageKeys = Object.keys(this.data).sort();
            this.totalPages = this.pageKeys.length;
            console.log(`Loaded ${this.totalPages} pages`);
        } catch (error) {
            console.error('Error loading data:', error);
            alert('Failed to load vocabulary data. Please make sure data.json exists in the output directory.');
        }
    }

    buildWordIndex() {
        // Build an index of all words to their page numbers
        this.wordIndex = {};

        this.pageKeys.forEach((pageKey, index) => {
            const pageNum = index + 1; // PDF page number (1-indexed)
            const pageWords = this.data[pageKey].words;

            pageWords.forEach(word => {
                const wordLower = word.text.toLowerCase();
                if (!this.wordIndex[wordLower]) {
                    this.wordIndex[wordLower] = {
                        text: word.text, // Keep original case
                        pages: []
                    };
                }
                if (!this.wordIndex[wordLower].pages.includes(pageNum)) {
                    this.wordIndex[wordLower].pages.push(pageNum);
                }
            });
        });

        console.log(`Built search index with ${Object.keys(this.wordIndex).length} unique words`);
    }

    searchWords(prefix) {
        if (!prefix || prefix.length < 1) return [];

        const prefixLower = prefix.toLowerCase();
        const matches = [];

        for (const [wordLower, data] of Object.entries(this.wordIndex)) {
            if (wordLower.startsWith(prefixLower)) {
                matches.push({
                    word: data.text,
                    pages: data.pages
                });
            }
        }

        // Sort by word alphabetically, limit to 10 results
        return matches.sort((a, b) => a.word.localeCompare(b.word)).slice(0, 10);
    }

    setupVoice() {
        // Find American English voice
        const voices = this.synth.getVoices();
        this.voice = voices.find(voice => voice.lang === 'en-US') || voices[0];

        // Handle voices loading asynchronously
        if (voices.length === 0) {
            this.synth.onvoiceschanged = () => {
                const voices = this.synth.getVoices();
                this.voice = voices.find(voice => voice.lang === 'en-US') || voices[0];
            };
        }
    }

    // ========================================================================
    // LOCALSTORAGE PERSISTENCE
    // ========================================================================

    loadUsers() {
        const stored = localStorage.getItem('vocabularyApp_users');
        if (stored) {
            const parsed = JSON.parse(stored);
            // Migrate from array format to object format
            if (Array.isArray(parsed)) {
                const usersObj = {};
                parsed.forEach(username => {
                    usersObj[username] = { password: '' };
                });
                this.saveUsers(usersObj);
                return usersObj;
            }
            return parsed;
        }
        // Default users: Kai and Ziyu with no passwords set
        return {
            'Kai': { password: '' },
            'Ziyu': { password: '' }
        };
    }

    saveUsers() {
        localStorage.setItem('vocabularyApp_users', JSON.stringify(this.users));
    }

    loadCurrentUser() {
        const stored = localStorage.getItem('vocabularyApp_currentUser');
        const usernames = Object.keys(this.users);
        if (stored && usernames.includes(stored)) {
            return stored;
        }
        // Default to first user
        return usernames[0];
    }

    saveCurrentUser() {
        localStorage.setItem('vocabularyApp_currentUser', this.currentUser);
    }

    switchUser(username) {
        if (!this.users.includes(username)) {
            console.error('User not found:', username);
            return;
        }

        // Save current user's word states before switching
        this.saveWordStates();

        // Switch to new user
        this.currentUser = username;
        this.saveCurrentUser();

        // Load new user's word states
        this.wordStates = this.loadWordStates();

        // Re-render
        this.renderPage();

        console.log(`Switched to user: ${username}`);
    }

    loadWordStates() {
        // Load word states for current user
        const key = `vocabularyApp_wordStates_${this.currentUser}`;
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : {};
    }

    saveWordStates() {
        // Save word states for current user
        const key = `vocabularyApp_wordStates_${this.currentUser}`;
        localStorage.setItem(key, JSON.stringify(this.wordStates));
    }

    loadSettings() {
        const stored = localStorage.getItem('vocabularyApp_settings');
        return stored ? JSON.parse(stored) : {
            lastPage: 1,
            audioEnabled: true,
            gistId: '',
            githubToken: '',
            lastSyncTime: null
        };
    }

    saveSettings() {
        localStorage.setItem('vocabularyApp_settings', JSON.stringify(this.settings));
    }

    restoreLastPage() {
        const lastPage = Math.min(this.settings.lastPage, this.totalPages);
        this.currentViewPage = Math.ceil(lastPage / this.pagesPerView);
    }

    getTotalViewPages() {
        return Math.ceil(this.totalPages / this.pagesPerView);
    }

    // ========================================================================
    // WORD STATE MANAGEMENT
    // ========================================================================

    getWordId(pageKey, wordIndex) {
        return `${pageKey}_word${wordIndex}`;
    }

    isLearningWordForUser(word) {
        // For user "Kai", only learn words marked as is_learning_word (curated vocabulary list)
        // For all other users, learn ALL words (all OCR-extracted English words)
        if (this.currentUser === 'Kai') {
            return word.is_learning_word === true;
        } else {
            // New users learn all words
            return true;
        }
    }

    getWordState(wordId) {
        return this.wordStates[wordId] || 'new';
    }

    setWordState(wordId, state) {
        if (state === 'new') {
            // Remove the word from wordStates to save it as "new" (default state)
            delete this.wordStates[wordId];
        } else if (state === 'known') {
            // Only persist "known" state to localStorage
            this.wordStates[wordId] = state;
        }
        // Note: "revealed" state is NOT persisted - it's temporary
        this.saveWordStates();
    }

    // ========================================================================
    // PAGE RENDERING
    // ========================================================================

    renderPage() {
        const totalViewPages = this.getTotalViewPages();

        // Update page info - show view page number, not PDF page numbers
        document.getElementById('pageInfo').textContent = `Page ${this.currentViewPage} of ${totalViewPages}`;

        // Enable/disable navigation buttons
        document.getElementById('prevBtn').disabled = this.currentViewPage === 1;
        document.getElementById('nextBtn').disabled = this.currentViewPage === totalViewPages;

        // Calculate which PDF pages to show
        const startPage = (this.currentViewPage - 1) * this.pagesPerView + 1;
        const endPage = Math.min(this.currentViewPage * this.pagesPerView, this.totalPages);
        console.log(`renderPage: currentViewPage=${this.currentViewPage}, rendering dictionary pages ${startPage}-${endPage}`);

        // Update page jump input max
        const pageJumpInput = document.getElementById('pageJumpInput');
        pageJumpInput.max = totalViewPages;

        // Clear container
        const container = document.getElementById('viewerContainer');
        container.innerHTML = '';

        // Render pages for current view
        const pagesToRender = [];
        for (let i = startPage; i <= endPage; i++) {
            pagesToRender.push(i);
        }

        // Render each page
        pagesToRender.forEach(pageNum => {
            const pageKey = this.pageKeys[pageNum - 1];
            const pageData = this.data[pageKey];
            this.renderSinglePage(container, pageKey, pageData, pageNum);
        });

        // Save current page
        this.settings.lastPage = startPage;
        this.saveSettings();
    }

    renderSinglePage(container, pageKey, pageData, pageNum) {
        // Create page item
        const pageItem = document.createElement('div');
        pageItem.className = 'page-item';
        pageItem.id = `page-${pageNum}`;

        // Image wrapper (no page label needed)
        const wrapper = document.createElement('div');
        wrapper.className = 'image-wrapper';

        // Image
        const img = document.createElement('img');
        img.className = 'page-image';
        img.src = pageData.image;
        img.alt = `Dictionary page ${pageNum}`;

        // SVG overlay
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('overlay-layer');
        svg.id = `overlay-${pageNum}`;

        // Wait for image to load before rendering overlays
        img.onload = () => {
            this.renderOverlays(svg, pageKey, pageData.words, img);
        };

        wrapper.appendChild(img);
        wrapper.appendChild(svg);
        pageItem.appendChild(wrapper);
        container.appendChild(pageItem);
    }

    renderOverlays(svg, pageKey, words, img) {
        // Clear existing overlays
        svg.innerHTML = '';

        // Set SVG dimensions to match image
        svg.setAttribute('viewBox', `0 0 ${img.naturalWidth} ${img.naturalHeight}`);

        // Find all revealed multi-word phrases to check for overlaps
        const revealedPhrases = [];
        words.forEach((word, index) => {
            const wordId = this.getWordId(pageKey, index);
            const state = this.getWordState(wordId);
            if (this.isLearningWordForUser(word) && word.text.includes(' ') && (state === 'revealed' || state === 'known')) {
                revealedPhrases.push({ word, index, state });
            }
        });

        // Render each word
        words.forEach((word, index) => {
            const wordId = this.getWordId(pageKey, index);

            // Check if this is a learning word
            if (this.isLearningWordForUser(word)) {
                const state = this.getWordState(wordId);

                // Check if this single word is covered by a revealed/known phrase
                // Only hide the single word overlay if the phrase is revealed/known AND the word itself is also revealed/known
                let isCoveredByPhrase = false;
                if (!word.text.includes(' ') && (state === 'revealed' || state === 'known')) {
                    // Only check for single words that are already revealed/known
                    for (const phraseInfo of revealedPhrases) {
                        if (this.checkBoundingBoxOverlap(phraseInfo.word, word)) {
                            isCoveredByPhrase = true;
                            break;
                        }
                    }
                }

                // Skip rendering if this word is covered by a revealed/known phrase
                if (isCoveredByPhrase) {
                    return;
                }

                // Learning words: show overlays and track progress
                if (state === 'known') {
                    this.renderKnownWord(svg, word, wordId, img.naturalWidth, img.naturalHeight);
                } else if (state === 'revealed') {
                    this.renderRevealedWord(svg, word, wordId, img.naturalWidth, img.naturalHeight);
                } else {
                    // state === 'new'
                    this.renderMaskedWord(svg, word, wordId, 'new', img.naturalWidth, img.naturalHeight);
                }
            } else {
                // Non-learning words: just clickable for pronunciation
                this.renderClickableWord(svg, word, img.naturalWidth, img.naturalHeight);
            }
        });
    }

    renderMaskedWord(svg, word, wordId, state, imgWidth, imgHeight) {
        // Convert normalized coordinates to pixel coordinates
        const x = word.x * imgWidth;
        const y = word.y * imgHeight;
        const width = word.width * imgWidth;
        const height = word.height * imgHeight;

        // Create overlay rectangle
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        rect.setAttribute('class', `word-overlay ${state}`);
        rect.setAttribute('data-word-id', wordId);
        rect.setAttribute('data-word-text', word.text);

        rect.addEventListener('click', () => this.handleWordReveal(wordId, word.text));

        svg.appendChild(rect);
    }

    renderRevealedWord(svg, word, wordId, imgWidth, imgHeight) {
        // Convert normalized coordinates
        const x = word.x * imgWidth;
        const y = word.y * imgHeight;
        const width = word.width * imgWidth;
        const height = word.height * imgHeight;

        // Create clickable area for replaying pronunciation
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        rect.setAttribute('class', 'word-revealed');
        rect.setAttribute('fill', 'transparent');
        rect.setAttribute('data-word-id', wordId);
        rect.setAttribute('data-word-text', word.text);
        rect.style.cursor = 'pointer';

        rect.addEventListener('click', () => this.pronounce(word.text));

        svg.appendChild(rect);

        // Add "Mark as Known" button to the right
        const btnWidth = 30;
        const btnHeight = 20;
        const btnX = x + width + 5;
        const btnY = y + (height - btnHeight) / 2;

        // Button background
        const btnRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        btnRect.setAttribute('x', btnX);
        btnRect.setAttribute('y', btnY);
        btnRect.setAttribute('width', btnWidth);
        btnRect.setAttribute('height', btnHeight);
        btnRect.setAttribute('rx', 4);
        btnRect.setAttribute('class', 'mark-known-btn');
        btnRect.setAttribute('fill', '#34C759');
        btnRect.style.cursor = 'pointer';

        // Button text
        const btnText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        btnText.setAttribute('x', btnX + btnWidth / 2);
        btnText.setAttribute('y', btnY + btnHeight / 2);
        btnText.setAttribute('text-anchor', 'middle');
        btnText.setAttribute('dominant-baseline', 'central');
        btnText.setAttribute('font-size', 14);
        btnText.setAttribute('fill', 'white');
        btnText.setAttribute('font-weight', 'bold');
        btnText.textContent = '✓';
        btnText.style.pointerEvents = 'none';

        // Button group
        const btnGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        btnGroup.appendChild(btnRect);
        btnGroup.appendChild(btnText);

        btnGroup.addEventListener('click', () => {
            this.setWordState(wordId, 'known');
            this.renderPage();
        });

        svg.appendChild(btnGroup);
    }

    renderKnownWord(svg, word, wordId, imgWidth, imgHeight) {
        // Convert normalized coordinates
        const x = word.x * imgWidth;
        const y = word.y * imgHeight;
        const width = word.width * imgWidth;
        const height = word.height * imgHeight;

        // Create transparent clickable area for pronunciation
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        rect.setAttribute('fill', 'transparent');
        rect.style.cursor = 'pointer';
        rect.addEventListener('click', () => this.pronounce(word.text));
        svg.appendChild(rect);

        // Create checkmark indicator group positioned to the right of the word
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'known-indicator');
        g.setAttribute('data-word-id', wordId);
        g.setAttribute('data-word-text', word.text);

        // Small circle positioned to the right side, vertically centered
        const circleRadius = Math.min(10, height / 2);
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x + width + circleRadius * 1.5); // Position to the right with some spacing
        circle.setAttribute('cy', y + height / 2); // Vertically centered
        circle.setAttribute('r', circleRadius);

        // Filled circle indicator (no text needed, the circle itself is the indicator)
        circle.setAttribute('fill', '#34C759');

        g.appendChild(circle);

        // Click handler for checkmark - unmark as known
        g.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering pronunciation
            this.handleKnownWordClick(wordId, word.text);
        });

        svg.appendChild(g);
    }

    renderClickableWord(svg, word, imgWidth, imgHeight) {
        // Render transparent clickable area for non-learning words (just for pronunciation)
        const x = word.x * imgWidth;
        const y = word.y * imgHeight;
        const width = word.width * imgWidth;
        const height = word.height * imgHeight;

        // Create transparent clickable area
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        rect.setAttribute('fill', 'transparent');
        rect.style.cursor = 'pointer';
        rect.setAttribute('data-word-text', word.text);

        // Click to pronounce
        rect.addEventListener('click', () => this.pronounce(word.text));

        svg.appendChild(rect);
    }

    // ========================================================================
    // INTERACTION HANDLERS
    // ========================================================================

    handleWordReveal(wordId, wordText) {
        console.log('Revealing word:', wordId, wordText);

        // Play pronunciation
        this.pronounce(wordText);

        // Mark as revealed temporarily (only in memory, not saved to localStorage)
        this.wordStates[wordId] = 'revealed';

        // If this is a multi-word phrase, also mark overlapping single words as revealed
        if (wordText.includes(' ')) {
            // Extract pageKey from wordId (format: "page_0017_word64")
            const pageKey = wordId.substring(0, wordId.lastIndexOf('_word'));
            const pageData = this.data[pageKey];

            if (pageData) {
                const clickedWord = pageData.words.find((_, idx) => `${pageKey}_word${idx}` === wordId);

                if (clickedWord) {
                    // Find and reveal all overlapping single words
                    pageData.words.forEach((word, idx) => {
                        const otherWordId = `${pageKey}_word${idx}`;

                        // Skip if it's the phrase itself or not a single word
                        if (otherWordId === wordId || word.text.includes(' ')) return;

                        // Check if this word overlaps with the clicked phrase
                        const overlaps = this.checkBoundingBoxOverlap(clickedWord, word);

                        if (overlaps) {
                            // Mark overlapping single words as revealed too
                            this.wordStates[otherWordId] = 'revealed';
                        }
                    });
                }
            }
        }

        // Re-render current view
        this.renderPage();
    }

    checkBoundingBoxOverlap(phraseBox, wordBox) {
        // Check if a word box is contained within or significantly overlaps with a phrase box
        // This is used to reveal individual words when a multi-word phrase is clicked

        // For a multi-word phrase, we want to reveal words that are:
        // 1. On the same line (similar y-coordinate)
        // 2. Within the horizontal bounds of the phrase

        const VERTICAL_THRESHOLD = 0.02; // 2% of image height
        const HORIZONTAL_OVERLAP_THRESHOLD = 0.5; // 50% overlap required

        // Check if they're on the same line (vertically aligned)
        const phraseCenterY = phraseBox.y + phraseBox.height / 2;
        const wordCenterY = wordBox.y + wordBox.height / 2;
        const verticalDistance = Math.abs(phraseCenterY - wordCenterY);

        if (verticalDistance > VERTICAL_THRESHOLD) {
            return false; // Not on the same line
        }

        // Check horizontal overlap
        const phraseLeft = phraseBox.x;
        const phraseRight = phraseBox.x + phraseBox.width;
        const wordLeft = wordBox.x;
        const wordRight = wordBox.x + wordBox.width;

        // Calculate overlap
        const overlapLeft = Math.max(phraseLeft, wordLeft);
        const overlapRight = Math.min(phraseRight, wordRight);
        const overlapWidth = Math.max(0, overlapRight - overlapLeft);

        // Check if word has significant overlap with phrase
        const wordWidth = wordBox.width;
        const overlapRatio = overlapWidth / wordWidth;

        return overlapRatio >= HORIZONTAL_OVERLAP_THRESHOLD;
    }

    handleKnownWordClick(wordId) {
        // Clicking the green circle marks the word back as "new" (unknown)
        this.setWordState(wordId, 'new');

        // Re-render current view
        this.renderPage();
    }

    pronounce(text) {
        if (!this.settings.audioEnabled) {
            console.log('Audio is disabled in settings');
            return;
        }

        console.log('Pronouncing:', text);

        // Cancel any ongoing speech
        this.synth.cancel();

        // Create utterance
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = this.voice;
        utterance.lang = 'en-US';
        utterance.rate = 0.9; // Slightly slower for learning

        // Speak
        this.synth.speak(utterance);
    }

    // ========================================================================
    // NAVIGATION
    // ========================================================================

    nextPage() {
        const totalViewPages = this.getTotalViewPages();
        if (this.currentViewPage < totalViewPages) {
            this.currentViewPage++;
            this.renderPage();
            this.scrollToTop();
        }
    }

    prevPage() {
        if (this.currentViewPage > 1) {
            this.currentViewPage--;
            this.renderPage();
            this.scrollToTop();
        }
    }

    jumpToPage(viewPageNum) {
        const totalViewPages = this.getTotalViewPages();
        console.log(`jumpToPage called with viewPageNum=${viewPageNum}, totalViewPages=${totalViewPages}`);

        if (viewPageNum < 1 || viewPageNum > totalViewPages) {
            alert(`Please enter a page number between 1 and ${totalViewPages}`);
            return;
        }

        // Go to the specified view page
        this.currentViewPage = viewPageNum;
        console.log(`Set currentViewPage to ${this.currentViewPage}`);
        this.renderPage();
        this.scrollToTop();
    }

    randomPage() {
        // Generate random view page (not individual page)
        const totalViewPages = this.getTotalViewPages();
        const randomViewPage = Math.floor(Math.random() * totalViewPages) + 1;
        this.currentViewPage = randomViewPage;
        this.renderPage();
        this.scrollToTop();
    }

    scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ========================================================================
    // STATISTICS
    // ========================================================================

    getStatistics() {
        // Count unique words, not instances
        const uniqueWords = new Map(); // word text -> state

        // Collect all learning words and their states
        this.pageKeys.forEach(pageKey => {
            const pageWords = this.data[pageKey].words;

            pageWords.forEach((word, index) => {
                // Only count learning words
                if (this.isLearningWordForUser(word)) {
                    const wordText = word.text.toLowerCase();
                    const wordId = this.getWordId(pageKey, index);
                    const state = this.getWordState(wordId);

                    // If we've seen this word before, prioritize 'known' state
                    if (!uniqueWords.has(wordText) || state === 'known') {
                        uniqueWords.set(wordText, state);
                    }
                }
            });
        });

        // Count by state
        let totalWords = uniqueWords.size;
        let knownWords = 0;
        let newWords = 0;

        for (const state of uniqueWords.values()) {
            if (state === 'known') {
                knownWords++;
            } else {
                newWords++; // state === 'new' or 'revealed'
            }
        }

        const percentage = totalWords > 0 ? Math.round((knownWords / totalWords) * 100) : 0;

        return {
            totalWords,
            knownWords,
            newWords,
            percentage
        };
    }

    showStatistics() {
        const stats = this.getStatistics();

        document.getElementById('totalWords').textContent = stats.totalWords;
        document.getElementById('knownWords').textContent = stats.knownWords;
        document.getElementById('newWords').textContent = stats.newWords;
        document.getElementById('progressBar').style.width = `${stats.percentage}%`;
        document.getElementById('progressText').textContent = `${stats.percentage}%`;

        document.getElementById('statsModal').classList.remove('hidden');
    }

    closeStatistics() {
        document.getElementById('statsModal').classList.add('hidden');
    }

    // ========================================================================
    // GITHUB GIST SYNC
    // ========================================================================

    async pushToGist() {
        const { gistId, githubToken } = this.settings;

        if (!githubToken) {
            alert('Please configure your GitHub Token in settings first.');
            this.showSettings();
            return;
        }

        // Get current user's password
        const userPassword = this.users[this.currentUser]?.password;
        if (!userPassword) {
            alert(`Please set a password for user "${this.currentUser}" in User Management first.`);
            this.showUserManagement();
            return;
        }

        // Prompt for password
        const enteredPassword = prompt(`Enter password for ${this.currentUser} to push:`);
        if (!enteredPassword) {
            return; // User cancelled
        }

        if (enteredPassword !== userPassword) {
            alert('Incorrect password. Push cancelled.');
            return;
        }

        try {
            const knownWords = this.getKnownWordsList();

            // Prepare user data
            const userData = {
                knownWords: knownWords,
                lastUpdated: new Date().toISOString(),
                totalCount: knownWords.length
            };

            let response;
            let newGistId = gistId;

            if (!gistId) {
                // First-time push: Create new Gist
                console.log('Creating new Gist...');
                const existingData = { users: {} };
                existingData.users[this.currentUser] = userData;

                response = await fetch('https://api.github.com/gists', {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${githubToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        description: 'DK Illustrated Dictionary - Known Words Sync',
                        public: false,
                        files: {
                            'known-words.json': {
                                content: JSON.stringify(existingData, null, 2)
                            }
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
                }

                const gist = await response.json();
                newGistId = gist.id;

                // Save the new Gist ID
                this.settings.gistId = newGistId;
                this.saveSettings();

                console.log(`Created new Gist with ID: ${newGistId}`);
            } else {
                // Update existing Gist
                let existingData = { users: {} };
                try {
                    const getResponse = await fetch(`https://api.github.com/gists/${gistId}`, {
                        headers: { 'Authorization': `token ${githubToken}` }
                    });
                    if (getResponse.ok) {
                        const gist = await getResponse.json();
                        const fileContent = gist.files['known-words.json']?.content;
                        if (fileContent) {
                            const parsed = JSON.parse(fileContent);
                            if (parsed.users) {
                                existingData = parsed;
                            }
                        }
                    }
                } catch (e) {
                    console.log('Could not fetch existing Gist data');
                }

                // Update current user's data
                existingData.users[this.currentUser] = userData;

                response = await fetch(`https://api.github.com/gists/${gistId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `token ${githubToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        files: {
                            'known-words.json': {
                                content: JSON.stringify(existingData, null, 2)
                            }
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
                }
            }

            this.settings.lastSyncTime = new Date().toISOString();
            this.saveSettings();
            this.updateSyncStatus();

            const message = !gistId
                ? `Successfully created Gist and pushed ${knownWords.length} known words!\n\nGist ID: ${newGistId}\n\nShare this ID and the token with family members.`
                : `Successfully pushed ${knownWords.length} known words to Gist!`;

            alert(message);
        } catch (error) {
            console.error('Push to Gist failed:', error);
            alert(`Failed to push to Gist: ${error.message}\n\nPlease check your GitHub Token.`);
        }
    }

    async pullFromGist() {
        const { gistId, githubToken } = this.settings;

        if (!githubToken) {
            alert('Please configure your GitHub Token in settings first.');
            this.showSettings();
            return;
        }

        if (!gistId) {
            alert('No Gist ID found.\n\nIf you\'re the admin: Push first to create a Gist, then share the Gist ID with family.\n\nIf you\'re a family member: Ask the admin for the Gist ID and enter it in Settings.');
            this.showSettings();
            return;
        }

        // Get current user's password
        const userPassword = this.users[this.currentUser]?.password;
        if (!userPassword) {
            alert(`Please set a password for user "${this.currentUser}" in User Management first.`);
            this.showUserManagement();
            return;
        }

        // Prompt for password
        const enteredPassword = prompt(`Enter password for ${this.currentUser} to pull:`);
        if (!enteredPassword) {
            return; // User cancelled
        }

        if (enteredPassword !== userPassword) {
            alert('Incorrect password. Pull cancelled.');
            return;
        }

        try {
            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                headers: {
                    'Authorization': `token ${githubToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }

            const gist = await response.json();
            const fileContent = gist.files['known-words.json']?.content;

            if (!fileContent) {
                throw new Error('known-words.json not found in Gist');
            }

            const data = JSON.parse(fileContent);

            // Handle both old format (single user) and new format (multi-user)
            let knownWords = [];
            if (data.users && data.users[this.currentUser]) {
                // New multi-user format - user exists in Gist
                knownWords = data.users[this.currentUser].knownWords || [];
            } else if (data.knownWords) {
                // Old single-user format
                knownWords = data.knownWords || [];
            } else {
                // User doesn't exist in Gist yet - first time pull
                // Return empty list (user starts fresh)
                knownWords = [];
            }

            // Convert array of words back to wordStates object (only for learning words)
            const newWordStates = {};
            this.pageKeys.forEach(pageKey => {
                const pageWords = this.data[pageKey].words;
                pageWords.forEach((word, index) => {
                    // Only process learning words
                    if (this.isLearningWordForUser(word)) {
                        const wordId = this.getWordId(pageKey, index);
                        if (knownWords.includes(word.text)) {
                            newWordStates[wordId] = 'known';
                        }
                    }
                });
            });

            // Replace current wordStates with pulled data (last write wins)
            this.wordStates = newWordStates;
            this.saveWordStates();

            this.settings.lastSyncTime = new Date().toISOString();
            this.saveSettings();
            this.updateSyncStatus();

            // Re-render current page to show updated states
            this.renderPage();

            alert(`Successfully pulled ${knownWords.length} known words for ${this.currentUser} from Gist!`);
        } catch (error) {
            console.error('Pull from Gist failed:', error);
            alert(`Failed to pull from Gist: ${error.message}\n\nPlease check your Gist ID and GitHub Token.`);
        }
    }

    getKnownWordsList() {
        const knownWords = [];
        this.pageKeys.forEach(pageKey => {
            const pageWords = this.data[pageKey].words;
            pageWords.forEach((word, index) => {
                // Only process learning words
                if (this.isLearningWordForUser(word)) {
                    const wordId = this.getWordId(pageKey, index);
                    const state = this.getWordState(wordId);
                    if (state === 'known') {
                        knownWords.push(word.text);
                    }
                }
            });
        });
        return knownWords.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    }

    updateSyncStatus() {
        const syncStatusEl = document.getElementById('syncStatus');
        if (syncStatusEl && this.settings.lastSyncTime) {
            const lastSync = new Date(this.settings.lastSyncTime);
            const now = new Date();
            const diffMs = now - lastSync;
            const diffMins = Math.floor(diffMs / 60000);

            let timeAgo;
            if (diffMins < 1) {
                timeAgo = 'just now';
            } else if (diffMins < 60) {
                timeAgo = `${diffMins}m ago`;
            } else if (diffMins < 1440) {
                timeAgo = `${Math.floor(diffMins / 60)}h ago`;
            } else {
                timeAgo = `${Math.floor(diffMins / 1440)}d ago`;
            }

            syncStatusEl.textContent = `Last sync: ${timeAgo}`;
        }
    }

    showSettings() {
        document.getElementById('gistIdInput').value = this.settings.gistId || '';
        document.getElementById('githubTokenInput').value = this.settings.githubToken || '';
        document.getElementById('settingsModal').classList.remove('hidden');
    }

    closeSettings() {
        document.getElementById('settingsModal').classList.add('hidden');
    }

    saveSettingsFromModal() {
        this.settings.gistId = document.getElementById('gistIdInput').value.trim();
        this.settings.githubToken = document.getElementById('githubTokenInput').value.trim();
        this.saveSettings();
        this.closeSettings();
        alert('Settings saved! Remember to set passwords for each user in User Management.');
    }

    // ========================================================================
    // USER MANAGEMENT
    // ========================================================================

    populateUserSelector() {
        const selector = document.getElementById('userSelector');
        const usernames = Object.keys(this.users);
        selector.innerHTML = usernames.map(username =>
            `<option value="${username}" ${username === this.currentUser ? 'selected' : ''}>${username}</option>`
        ).join('');
    }

    showUserManagement() {
        this.renderUserList();
        document.getElementById('userManagementModal').classList.remove('hidden');
    }

    closeUserManagement() {
        document.getElementById('userManagementModal').classList.add('hidden');
    }

    renderUserList() {
        const userList = document.getElementById('userList');
        const usernames = Object.keys(this.users);
        userList.innerHTML = usernames.map(username => {
            const hasPassword = this.users[username].password !== '';
            return `
            <div class="user-item">
                <div class="user-item-header">
                    <span class="user-item-name">${username}${username === this.currentUser ? ' (current)' : ''}</span>
                    ${usernames.length > 1 ? `<button class="user-item-delete" data-user="${username}">Delete</button>` : ''}
                </div>
                <div class="user-item-password">
                    <input type="password"
                           class="user-password-input"
                           data-user="${username}"
                           placeholder="${hasPassword ? '••••••• (password set)' : 'Set password for sync'}"
                           value="" />
                    <button class="user-password-save" data-user="${username}">Save Password</button>
                </div>
            </div>
        `}).join('');

        // Add delete event listeners
        userList.querySelectorAll('.user-item-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const username = btn.dataset.user;
                this.deleteUser(username);
            });
        });

        // Add password save event listeners
        userList.querySelectorAll('.user-password-save').forEach(btn => {
            btn.addEventListener('click', () => {
                const username = btn.dataset.user;
                const input = userList.querySelector(`.user-password-input[data-user="${username}"]`);
                const password = input.value.trim();

                if (!password) {
                    alert('Please enter a password');
                    return;
                }

                this.users[username].password = password;
                this.saveUsers();
                input.value = '';
                this.renderUserList();
                alert(`Password set for ${username}`);
            });
        });
    }

    addUser() {
        const input = document.getElementById('newUserInput');
        const username = input.value.trim();

        if (!username) {
            alert('Please enter a name');
            return;
        }

        if (this.users[username]) {
            alert('This user already exists');
            return;
        }

        this.users[username] = { password: '' };
        this.saveUsers();
        this.populateUserSelector();
        this.renderUserList();
        input.value = '';

        alert(`User "${username}" added successfully! Don't forget to set a password for sync.`);
    }

    deleteUser(username) {
        const usernames = Object.keys(this.users);
        if (usernames.length === 1) {
            alert('Cannot delete the last user');
            return;
        }

        if (!confirm(`Are you sure you want to delete user "${username}"? Their progress will be lost.`)) {
            return;
        }

        // Remove user from object
        delete this.users[username];
        this.saveUsers();

        // If deleting current user, switch to first remaining user
        if (this.currentUser === username) {
            const remainingUsers = Object.keys(this.users);
            this.switchUser(remainingUsers[0]);
            this.populateUserSelector();
        }

        // Delete user's word states
        const key = `vocabularyApp_wordStates_${username}`;
        localStorage.removeItem(key);

        this.renderUserList();
        alert(`User "${username}" deleted`);
    }

    // ========================================================================
    // SEARCH
    // ========================================================================

    displaySearchResults(results) {
        const dropdown = document.getElementById('searchDropdown');

        if (results.length === 0) {
            dropdown.innerHTML = '<div class="search-item"><div class="search-item-word">No results found</div></div>';
            dropdown.classList.remove('hidden');
            return;
        }

        dropdown.innerHTML = results.map(result => `
            <div class="search-item" data-word="${result.word}">
                <div class="search-item-word">${result.word}</div>
                <div class="search-item-pages">
                    Found on ${result.pages.length} page${result.pages.length > 1 ? 's' : ''}:
                    <div class="page-list">
                        ${result.pages.map(pageNum =>
                            `<span class="page-link" data-page="${pageNum}">Page ${pageNum}</span>`
                        ).join('')}
                    </div>
                </div>
            </div>
        `).join('');

        dropdown.classList.remove('hidden');

        // Add click handlers for page links
        dropdown.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.stopPropagation();
                const dictPageNum = parseInt(e.target.dataset.page);
                // Convert dictionary page number to view page number
                const viewPageNum = Math.ceil(dictPageNum / this.pagesPerView);
                this.jumpToPage(viewPageNum);
                dropdown.classList.add('hidden');
                document.getElementById('searchInput').value = '';
            });
        });
    }

    // ========================================================================
    // EVENT LISTENERS
    // ========================================================================

    setupEventListeners() {
        // User selector
        document.getElementById('userSelector').addEventListener('change', (e) => {
            this.switchUser(e.target.value);
        });

        // User management
        document.getElementById('manageUsersBtn').addEventListener('click', () => this.showUserManagement());
        document.getElementById('closeUserManagementBtn').addEventListener('click', () => this.closeUserManagement());
        document.getElementById('userManagementOverlay').addEventListener('click', () => this.closeUserManagement());
        document.getElementById('addUserBtn').addEventListener('click', () => this.addUser());
        document.getElementById('newUserInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addUser();
        });

        // Search
        const searchInput = document.getElementById('searchInput');
        const searchDropdown = document.getElementById('searchDropdown');

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length === 0) {
                searchDropdown.classList.add('hidden');
                return;
            }

            const results = this.searchWords(query);
            this.displaySearchResults(results);
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                searchDropdown.classList.add('hidden');
            }
        });

        // Navigation
        document.getElementById('prevBtn').addEventListener('click', () => this.prevPage());
        document.getElementById('nextBtn').addEventListener('click', () => this.nextPage());
        document.getElementById('randomBtn').addEventListener('click', () => this.randomPage());

        // Page jump
        document.getElementById('pageJumpBtn').addEventListener('click', () => {
            const pageNum = parseInt(document.getElementById('pageJumpInput').value);
            if (pageNum) {
                this.jumpToPage(pageNum);
                document.getElementById('pageJumpInput').value = '';
            }
        });

        // Page jump on Enter key
        document.getElementById('pageJumpInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const pageNum = parseInt(e.target.value);
                if (pageNum) {
                    this.jumpToPage(pageNum);
                    e.target.value = '';
                }
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            // Only navigate if not typing in input field
            if (e.target.tagName !== 'INPUT') {
                if (e.key === 'ArrowLeft') this.prevPage();
                if (e.key === 'ArrowRight') this.nextPage();
            }
        });

        // Statistics
        document.getElementById('statsBtn').addEventListener('click', () => this.showStatistics());
        document.getElementById('closeStatsBtn').addEventListener('click', () => this.closeStatistics());

        // Close modal on background click
        document.getElementById('statsModal').addEventListener('click', (e) => {
            if (e.target.id === 'statsModal') {
                this.closeStatistics();
            }
        });

        // Sync buttons
        document.getElementById('pushBtn').addEventListener('click', () => this.pushToGist());
        document.getElementById('pullBtn').addEventListener('click', () => this.pullFromGist());
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettings());

        // Settings modal
        document.getElementById('closeSettingsBtn').addEventListener('click', () => this.closeSettings());
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettingsFromModal());

        // Close settings modal on background click
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') {
                this.closeSettings();
            }
        });

        // Update sync status on load
        this.updateSyncStatus();
    }
}

// ============================================================================
// INITIALIZE APP
// ============================================================================

let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new VocabularyApp();
});
