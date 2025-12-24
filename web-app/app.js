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
        this.wordStates = this.loadWordStates();
        this.settings = this.loadSettings();

        // Speech synthesis
        this.synth = window.speechSynthesis;
        this.voice = null;

        this.init();
    }

    async init() {
        await this.loadData();
        this.setupVoice();
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

    loadWordStates() {
        const stored = localStorage.getItem('vocabularyApp_wordStates');
        return stored ? JSON.parse(stored) : {};
    }

    saveWordStates() {
        localStorage.setItem('vocabularyApp_wordStates', JSON.stringify(this.wordStates));
    }

    loadSettings() {
        const stored = localStorage.getItem('vocabularyApp_settings');
        return stored ? JSON.parse(stored) : {
            lastPage: 1,
            audioEnabled: true,
            gistId: '',
            githubToken: '',
            pushPassword: '',
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

        // Update page jump input max
        const pageJumpInput = document.getElementById('pageJumpInput');
        pageJumpInput.max = this.totalPages;

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

        // Render each word
        words.forEach((word, index) => {
            const wordId = this.getWordId(pageKey, index);

            // Check if this is a learning word
            if (word.is_learning_word) {
                // Learning words: show overlays and track progress
                const state = this.getWordState(wordId);

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
        // Play pronunciation
        this.pronounce(wordText);

        // Mark as revealed temporarily (only in memory, not saved to localStorage)
        this.wordStates[wordId] = 'revealed';

        // Re-render current view
        this.renderPage();
    }

    handleKnownWordClick(wordId) {
        // Clicking the green circle marks the word back as "new" (unknown)
        this.setWordState(wordId, 'new');

        // Re-render current view
        this.renderPage();
    }

    pronounce(text) {
        if (!this.settings.audioEnabled) return;

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

    jumpToPage(pageNum) {
        if (pageNum < 1 || pageNum > this.totalPages) {
            alert(`Please enter a page number between 1 and ${this.totalPages}`);
            return;
        }

        // Calculate which view page contains this page number
        this.currentViewPage = Math.ceil(pageNum / this.pagesPerView);
        this.renderPage();

        // Scroll to specific page
        setTimeout(() => {
            const pageElement = document.getElementById(`page-${pageNum}`);
            if (pageElement) {
                pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
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
        let totalWords = 0;
        let knownWords = 0;
        let newWords = 0;

        // Count only learning words across all pages
        this.pageKeys.forEach(pageKey => {
            const pageWords = this.data[pageKey].words;

            pageWords.forEach((word, index) => {
                // Only count learning words
                if (word.is_learning_word) {
                    totalWords++;
                    const wordId = this.getWordId(pageKey, index);
                    const state = this.getWordState(wordId);

                    if (state === 'known') knownWords++;
                    else newWords++; // state === 'new' or 'revealed'
                }
            });
        });

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
        const { gistId, githubToken, pushPassword } = this.settings;

        if (!gistId || !githubToken) {
            alert('Please configure your Gist ID and GitHub Token in settings first.');
            this.showSettings();
            return;
        }

        // Check password protection
        if (!pushPassword) {
            alert('Please set a push password in settings first for security.');
            this.showSettings();
            return;
        }

        // Prompt for password
        const enteredPassword = prompt('Enter push password to continue:');
        if (!enteredPassword) {
            return; // User cancelled
        }

        if (enteredPassword !== pushPassword) {
            alert('Incorrect password. Push cancelled.');
            return;
        }

        try {
            const knownWords = this.getKnownWordsList();

            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    files: {
                        'known-words.json': {
                            content: JSON.stringify({
                                knownWords: knownWords,
                                lastUpdated: new Date().toISOString(),
                                totalCount: knownWords.length
                            }, null, 2)
                        }
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }

            this.settings.lastSyncTime = new Date().toISOString();
            this.saveSettings();
            this.updateSyncStatus();

            alert(`Successfully pushed ${knownWords.length} known words to Gist!`);
        } catch (error) {
            console.error('Push to Gist failed:', error);
            alert(`Failed to push to Gist: ${error.message}\n\nPlease check your Gist ID and GitHub Token.`);
        }
    }

    async pullFromGist() {
        const { gistId, githubToken } = this.settings;

        if (!gistId || !githubToken) {
            alert('Please configure your Gist ID and GitHub Token in settings first.');
            this.showSettings();
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
            const knownWords = data.knownWords || [];

            // Convert array of words back to wordStates object (only for learning words)
            const newWordStates = {};
            this.pageKeys.forEach(pageKey => {
                const pageWords = this.data[pageKey].words;
                pageWords.forEach((word, index) => {
                    // Only process learning words
                    if (word.is_learning_word) {
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

            alert(`Successfully pulled ${knownWords.length} known words from Gist!`);
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
                if (word.is_learning_word) {
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
        document.getElementById('pushPasswordInput').value = this.settings.pushPassword || '';
        document.getElementById('settingsModal').classList.remove('hidden');
    }

    closeSettings() {
        document.getElementById('settingsModal').classList.add('hidden');
    }

    saveSettingsFromModal() {
        this.settings.gistId = document.getElementById('gistIdInput').value.trim();
        this.settings.githubToken = document.getElementById('githubTokenInput').value.trim();
        this.settings.pushPassword = document.getElementById('pushPasswordInput').value.trim();
        this.saveSettings();
        this.closeSettings();
        alert('Settings saved! You can now sync your known words.');
    }

    // ========================================================================
    // EVENT LISTENERS
    // ========================================================================

    setupEventListeners() {
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
