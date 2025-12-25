#!/usr/bin/env python3
"""
Process the full DK dictionary PDF book (402 pages).
This script:
1. Extracts all pages as PNG images
2. Runs Azure OCR on each page
3. Generates data.json with all words and phrases
"""
import os
import json
from pathlib import Path
from dotenv import load_dotenv
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
from pdf2image import convert_from_path
from PIL import Image
import re
import time

# Load environment variables
load_dotenv()

PROJECT_ROOT = Path(__file__).parent.parent
SOURCE_PDF = PROJECT_ROOT / "source-materials" / "DK中英双语10000词.pdf"
IMAGES_DIR = PROJECT_ROOT / "web-app" / "images"
OUTPUT_DIR = PROJECT_ROOT / "web-app"
SOURCE_DIR = PROJECT_ROOT / "source-materials"

AZURE_ENDPOINT = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
AZURE_API_KEY = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_KEY")

print(f"Using Azure endpoint: {AZURE_ENDPOINT}")
print(f"Source PDF: {SOURCE_PDF}")
print(f"Output images: {IMAGES_DIR}")

# Create directories
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# Create Azure client
client = DocumentAnalysisClient(
    endpoint=AZURE_ENDPOINT,
    credential=AzureKeyCredential(AZURE_API_KEY)
)

# Load vocabulary - separate single-word and multi-word entries
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

# Step 1: Convert PDF to images (if not already done)
print("\n" + "="*60)
print("STEP 1: Converting PDF to images")
print("="*60)

existing_images = list(IMAGES_DIR.glob("page_*.png"))
print(f"Found {len(existing_images)} existing images")

if len(existing_images) < 402:
    print("Converting PDF pages to images (this may take a while)...")
    pages = convert_from_path(str(SOURCE_PDF), dpi=200)
    print(f"Extracted {len(pages)} pages from PDF")

    for i, page in enumerate(pages, 1):
        image_path = IMAGES_DIR / f"page_{i:04d}.png"
        if not image_path.exists():
            page.save(str(image_path), 'PNG')
            if i % 50 == 0:
                print(f"  Saved {i}/{len(pages)} pages")

    print(f"All {len(pages)} pages converted to PNG images")
else:
    print("All pages already converted, skipping PDF conversion")

# Step 2: Run OCR on all images
print("\n" + "="*60)
print("STEP 2: Running OCR on all pages")
print("="*60)

# Get all images
image_files = sorted(IMAGES_DIR.glob("page_*.png"))
print(f"Found {len(image_files)} pages to process")

all_pages_data = {}

for idx, image_path in enumerate(image_files, 1):
    page_num = int(image_path.stem.split('_')[1])
    page_key = f"page_{page_num:04d}"

    print(f"\nProcessing {page_key} ({idx}/{len(image_files)})...")

    # Run OCR with retry logic
    max_retries = 3
    retry_delay = 5
    result = None

    for attempt in range(max_retries):
        try:
            with open(image_path, "rb") as f:
                poller = client.begin_analyze_document(model_id="prebuilt-read", document=f)
            result = poller.result()
            break  # Success, exit retry loop
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"  Error on attempt {attempt + 1}: {str(e)[:100]}")
                print(f"  Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                print(f"  Failed after {max_retries} attempts: {str(e)[:100]}")
                print(f"  Skipping page {page_key}")
                continue

    if result is None:
        continue  # Skip this page if OCR failed

    # Get image dimensions
    with Image.open(image_path) as img:
        img_width, img_height = img.size

    # Extract all words and lines
    words = []
    lines = []
    for page in result.pages:
        # Extract individual words
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

        # Extract lines (may contain multi-word phrases)
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
    matched_phrases = set()  # Track to avoid duplicates

    for line in lines:
        line_text = line['text']
        line_lower = line_text.lower()

        # Check each multi-word vocab entry to see if it appears in this line
        for vocab_phrase in multi_word_vocab:
            # Use word boundary to match whole phrases
            pattern = r'\b' + re.escape(vocab_phrase) + r'\b'
            if re.search(pattern, line_lower):
                # Create a unique key to avoid duplicate matches
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

# Save data.json
print("\n" + "="*60)
print("STEP 3: Saving data.json")
print("="*60)

data_json_path = OUTPUT_DIR / "data.json"
with open(data_json_path, 'w', encoding='utf-8') as f:
    json.dump(all_pages_data, f, indent=2, ensure_ascii=False)

print(f"\n{'='*60}")
print("PROCESSING COMPLETE")
print(f"{'='*60}")
print(f"Data file: {data_json_path}")
print(f"Total pages processed: {len(all_pages_data)}")
print(f"Total learning words: {sum(p['matched_words'] for p in all_pages_data.values())}")
print(f"File size: {round(os.path.getsize(data_json_path) / 1024 / 1024, 2)} MB")
