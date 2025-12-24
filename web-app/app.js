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

class VocabularyApp {
    constructor() {
        this.data = null;
        this.currentPage = 1;
        this.totalPages = 0;
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
            lastSyncTime: null
        };
    }

    saveSettings() {
        localStorage.setItem('vocabularyApp_settings', JSON.stringify(this.settings));
    }

    restoreLastPage() {
        this.currentPage = Math.min(this.settings.lastPage, this.totalPages);
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
        const pageKey = this.pageKeys[this.currentPage - 1];
        const pageData = this.data[pageKey];

        // Update page info
        document.getElementById('pageInfo').textContent = `Page ${this.currentPage} of ${this.totalPages}`;

        // Enable/disable navigation buttons
        document.getElementById('prevBtn').disabled = this.currentPage === 1;
        document.getElementById('nextBtn').disabled = this.currentPage === this.totalPages;

        // Load image
        const img = document.getElementById('pageImage');
        img.src = pageData.image;

        // Wait for image to load before rendering overlays
        img.onload = () => {
            this.renderOverlays(pageKey, pageData.words);
        };

        // Save current page
        this.settings.lastPage = this.currentPage;
        this.saveSettings();
    }

    renderOverlays(pageKey, words) {
        const svg = document.getElementById('overlayLayer');
        const img = document.getElementById('pageImage');

        // Clear existing overlays
        svg.innerHTML = '';

        // Set SVG dimensions to match image
        const imgRect = img.getBoundingClientRect();
        svg.setAttribute('viewBox', `0 0 ${img.naturalWidth} ${img.naturalHeight}`);

        // Render each word
        words.forEach((word, index) => {
            const wordId = this.getWordId(pageKey, index);
            const state = this.getWordState(wordId);

            if (state === 'known') {
                this.renderKnownWord(svg, word, wordId, img.naturalWidth, img.naturalHeight);
            } else if (state === 'revealed') {
                this.renderRevealedWord(svg, word, wordId, img.naturalWidth, img.naturalHeight);
            } else {
                // state === 'new'
                this.renderMaskedWord(svg, word, wordId, 'new', img.naturalWidth, img.naturalHeight);
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

        rect.addEventListener('click', () => this.handleWordReveal(wordId, word.text, x, y, width, height));

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
            const pageKey = this.pageKeys[this.currentPage - 1];
            const pageData = this.data[pageKey];
            this.renderOverlays(pageKey, pageData.words);
        });

        svg.appendChild(btnGroup);
    }

    renderKnownWord(svg, word, wordId, imgWidth, imgHeight) {
        // Convert normalized coordinates
        const x = word.x * imgWidth;
        const y = word.y * imgHeight;
        const width = word.width * imgWidth;
        const height = word.height * imgHeight;

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

        // Click handlers - replay pronunciation
        g.addEventListener('click', () => {
            this.handleKnownWordClick(wordId, word.text);
        });

        svg.appendChild(g);
    }

    // ========================================================================
    // INTERACTION HANDLERS
    // ========================================================================

    handleWordReveal(wordId, wordText) {
        // Play pronunciation
        this.pronounce(wordText);

        // Mark as revealed temporarily (only in memory, not saved to localStorage)
        // This allows the word to show the "Mark as Known" button during this session
        // but will reset to "new" on page refresh
        this.wordStates[wordId] = 'revealed';

        // Re-render to show revealed state with "Mark as Known" button
        const pageKey = this.pageKeys[this.currentPage - 1];
        const pageData = this.data[pageKey];
        this.renderOverlays(pageKey, pageData.words);
    }

    handleKnownWordClick(wordId, wordText) {
        // Clicking the green circle marks the word back as "new" (unknown)
        this.setWordState(wordId, 'new');

        // Re-render to show gray overlay
        const pageKey = this.pageKeys[this.currentPage - 1];
        const pageData = this.data[pageKey];
        this.renderOverlays(pageKey, pageData.words);
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
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.renderPage();
        }
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderPage();
        }
    }

    // ========================================================================
    // STATISTICS
    // ========================================================================

    getStatistics() {
        let totalWords = 0;
        let knownWords = 0;
        let newWords = 0;

        // Count all words across all pages
        this.pageKeys.forEach(pageKey => {
            const pageWords = this.data[pageKey].words;
            totalWords += pageWords.length;

            pageWords.forEach((word, index) => {
                const wordId = this.getWordId(pageKey, index);
                const state = this.getWordState(wordId);

                if (state === 'known') knownWords++;
                else newWords++; // state === 'new' or 'revealed'
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
        const { gistId, githubToken } = this.settings;

        if (!gistId || !githubToken) {
            alert('Please configure your Gist ID and GitHub Token in settings first.');
            this.showSettings();
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

            // Convert array of words back to wordStates object
            const newWordStates = {};
            this.pageKeys.forEach(pageKey => {
                const pageWords = this.data[pageKey].words;
                pageWords.forEach((word, index) => {
                    const wordId = this.getWordId(pageKey, index);
                    if (knownWords.includes(word.text)) {
                        newWordStates[wordId] = 'known';
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
                const wordId = this.getWordId(pageKey, index);
                const state = this.getWordState(wordId);
                if (state === 'known') {
                    knownWords.push(word.text);
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
        alert('Settings saved! You can now sync your known words.');
    }

    // ========================================================================
    // EXPORT
    // ========================================================================

    exportKnownWords() {
        const knownWords = [];

        // Collect all known words
        this.pageKeys.forEach(pageKey => {
            const pageWords = this.data[pageKey].words;

            pageWords.forEach((word, index) => {
                const wordId = this.getWordId(pageKey, index);
                const state = this.getWordState(wordId);

                if (state === 'known') {
                    knownWords.push(word.text);
                }
            });
        });

        // Sort alphabetically
        knownWords.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

        // Generate CSV content
        const csvContent = knownWords.join('\n');

        // Create download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        // Generate filename with today's date
        const today = new Date().toISOString().split('T')[0];
        const filename = `known-words-${today}.csv`;

        // Trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Show confirmation
        alert(`Exported ${knownWords.length} known words to ${filename}`);
    }

    // ========================================================================
    // EVENT LISTENERS
    // ========================================================================

    setupEventListeners() {
        // Navigation
        document.getElementById('prevBtn').addEventListener('click', () => this.prevPage());
        document.getElementById('nextBtn').addEventListener('click', () => this.nextPage());

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.prevPage();
            if (e.key === 'ArrowRight') this.nextPage();
        });

        // Export
        document.getElementById('exportBtn').addEventListener('click', () => this.exportKnownWords());

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
