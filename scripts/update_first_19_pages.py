#!/usr/bin/env python3
"""
Update OCR data for pages 1-19 in data.json (these were from sample PDF, need to replace with full PDF data)
"""
import os
import json
from pathlib import Path
from dotenv import load_dotenv
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
from PIL import Image
import re
import time

# Load environment variables
load_dotenv()

PROJECT_ROOT = Path(__file__).parent.parent
IMAGES_DIR = PROJECT_ROOT / "web-app" / "images"
OUTPUT_DIR = PROJECT_ROOT / "web-app"
SOURCE_DIR = PROJECT_ROOT / "source-materials"

AZURE_ENDPOINT = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
AZURE_API_KEY = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_KEY")

print(f"Using Azure endpoint: {AZURE_ENDPOINT}")

# Create Azure client
client = DocumentAnalysisClient(
    endpoint=AZURE_ENDPOINT,
    credential=AzureKeyCredential(AZURE_API_KEY)
)

# Load vocabulary
single_word_vocab = set()
multi_word_vocab = set()
with open(SOURCE_DIR / "vocabulary-list.csv", 'r', encoding='utf-8') as f:
    for line in f:
        word = line.strip()
        if word and not word.startswith('#'):
            word_lower = word.lower()
            if ' ' in word_lower:
                multi_word_vocab.add(word_lower)
            else:
                single_word_vocab.add(word_lower)

vocabulary = single_word_vocab | multi_word_vocab
print(f"Loaded {len(vocabulary)} vocabulary words ({len(single_word_vocab)} single-word, {len(multi_word_vocab)} multi-word)")

# Load existing data.json
data_json_path = OUTPUT_DIR / "data.json"
with open(data_json_path, 'r', encoding='utf-8') as f:
    all_pages_data = json.load(f)

print(f"Loaded existing data.json with {len(all_pages_data)} pages")

# Process only pages 1-19
for page_num in range(1, 20):
    page_key = f"page_{page_num:04d}"
    image_path = IMAGES_DIR / f"page_{page_num:04d}.png"

    print(f"\nProcessing {page_key}...")

    # Run OCR
    with open(image_path, "rb") as f:
        poller = client.begin_analyze_document(model_id="prebuilt-read", document=f)
    result = poller.result()

    # Get image dimensions
    with Image.open(image_path) as img:
        img_width, img_height = img.size

    # Extract all words and lines
    words = []
    lines = []
    for page in result.pages:
        for word in page.words:
            polygon = word.polygon
            x_coords = [p.x for p in polygon]
            y_coords = [p.y for p in polygon]

            words.append({
                'text': word.content,
                'x': min(x_coords) / img_width,
                'y': min(y_coords) / img_height,
                'width': (max(x_coords) - min(x_coords)) / img_width,
                'height': (max(y_coords) - min(y_coords)) / img_height,
                'confidence': word.confidence
            })

        if hasattr(page, 'lines'):
            for line in page.lines:
                polygon = line.polygon
                x_coords = [p.x for p in polygon]
                y_coords = [p.y for p in polygon]

                lines.append({
                    'text': line.content,
                    'x': min(x_coords) / img_width,
                    'y': min(y_coords) / img_height,
                    'width': (max(x_coords) - min(x_coords)) / img_width,
                    'height': (max(y_coords) - min(y_coords)) / img_height
                })

    print(f"  Extracted {len(words)} words and {len(lines)} lines")

    # Filter to English words only
    english_pattern = re.compile(r'^[a-zA-Z]+$')
    english_words = [w for w in words if english_pattern.match(w['text'])]
    print(f"  Filtered to {len(english_words)} English words")

    # Match single-word vocabulary entries
    single_word_matches = 0
    for word in english_words:
        is_learning = word['text'].lower() in single_word_vocab
        word['is_learning_word'] = is_learning
        if is_learning:
            single_word_matches += 1

    # Match multi-word vocabulary entries from lines
    multi_word_matches = []
    matched_phrases = set()

    for line in lines:
        line_text = line['text']
        line_lower = line_text.lower()

        for vocab_phrase in multi_word_vocab:
            pattern = r'\b' + re.escape(vocab_phrase) + r'\b'
            if re.search(pattern, line_lower):
                match_key = (page_key, vocab_phrase, round(line['y'], 3))
                if match_key not in matched_phrases:
                    matched_phrases.add(match_key)
                    multi_word_matches.append({
                        'text': vocab_phrase,
                        'x': line['x'],
                        'y': line['y'],
                        'width': line['width'],
                        'height': line['height'],
                        'confidence': 1.0,
                        'is_learning_word': True
                    })

    # Combine single-word and multi-word matches
    all_learning_items = english_words + multi_word_matches
    matched_count = single_word_matches + len(multi_word_matches)

    print(f"  Matched {single_word_matches} single-word + {len(multi_word_matches)} multi-word = {matched_count} total learning items")

    # Update in all_pages_data
    all_pages_data[page_key] = {
        'image': f"images/{image_path.name}",
        'words': all_learning_items,
        'total_words_extracted': len(words),
        'english_words': len(english_words),
        'matched_words': matched_count,
        'single_word_matches': single_word_matches,
        'multi_word_matches': len(multi_word_matches)
    }

    # Small delay to avoid rate limiting
    time.sleep(0.5)

# Save updated data.json
with open(data_json_path, 'w', encoding='utf-8') as f:
    json.dump(all_pages_data, f, indent=2, ensure_ascii=False)

print(f"\n{'='*60}")
print("UPDATE COMPLETE")
print(f"{'='*60}")
print(f"Updated pages 1-19 in {data_json_path}")
print(f"Total pages in data.json: {len(all_pages_data)}")
