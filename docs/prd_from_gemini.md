# PRD: Interactive Visual Dictionary (Cross-Device)

## 1. Project Objective

To create an interactive study tool that transforms a static, scanned PDF dictionary into a dynamic web-based application. The tool will use OCR coordinates to "mask" specific English words for active recall and synchronize learning progress across MacBook, iPad, and iPhone using Google Sheets as a database.

---

## 2. Core User Experience

1. **The Mask:** When viewing a page, English words that the user is currently learning are covered by an opaque box.
2. **The Reveal:** Tapping the box reveals the text and plays high-quality American English audio.
3. **Mastery Tracking:** Users can mark a word as "Known," which updates a central Google Sheet, removing the mask for that word on all other devices automatically.

---

## 3. Functional Requirements

### 3.1. OCR & Data Mapping (The "Brain")

* **Dual-Engine OCR:** Process PDF pages to extract word strings and bounding box coordinates ().
* **Primary:** Microsoft Azure Document Intelligence (Layout API).
* **Backup:** Google Cloud Vision OCR.


* **Coordinate Mapping:** Generate a JSON "Map" linking every word to its specific location on its specific page.

### 3.2. Dynamic Web Interface

* **Responsive Image Rendering:** Display high-resolution page images.
* **Interactive Overlay Layer:** Draw SVG or Canvas boxes over the English words based on coordinates.
* **Touch Optimization:** Support pinch-to-zoom and panning, ensuring masks remain aligned with the text during zoom.
* **State Persistence:** Remember the last page viewed so the user can resume study on any device.

### 3.3. Audio Engine

* **Native TTS:** Use the **Web Speech API** to provide instant pronunciation.
* **Voice Selection:** Must be set to a high-quality American English (`en-US`) profile.
* **Replay Functionality:** Tapping the revealed text must trigger the audio repeatedly.

### 3.4. Synchronization & Mastery (Google Sheets API)

* **Single Source of Truth:** All devices read from and write to one Google Spreadsheet.
* **Mastery Toggle:** A "Mark as Known" button appears upon word reveal.
* **Cloud Sync:** Updating a status to "Known" must reflect across all devices in real-time.
* **Known Word Exclusion:** The app must check the "Mastered" list upon page load; if a word is mastered, it is **never** masked.

---

## 4. Technical Stack

| Component | Technology |
| --- | --- |
| **OCR Processing** | Python + Azure Document Intelligence |
| **Frontend** | React / Next.js (Tailwind CSS for UI) |
| **Database** | Google Sheets API (via a simple Node.js or Python backend) |
| **Deployment** | Vercel or Netlify (for private mobile access via URL) |
| **Audio** | Browser-native `window.speechSynthesis` |

---

## 5. Workflow & Maintenance

* **Initial Setup:** Run the Python script on a Mac to process the 402 pages and upload coordinates to the app.
* **Ongoing Study:** User interacts with the app on iPad/MacBook.
* **Monthly Cleanup:** * A feature to "Export Mastered List" to a separate tab.
* Automatically delete "Mastered" entries from the active "Words to Learn" sheet to keep the application lightweight.



---

## 6. Constraints & Success Criteria

* **Accuracy:** Masks must be within 2-3 pixels of the actual text in the image.
* **Sync Speed:** Updates to Google Sheets must happen in the background without interrupting the user.
* **Audio Quality:** Must use a natural-sounding American accent, not a robotic default.

---

### What would you like to do next?

I can help you with the most technical part of this PRD: **Step 1 (The Python OCR Script).** Since you have Azure access, I can write a script that sends your PDF pages to Azure and creates that `coordinates.json` file for you. Would you like to start with that?