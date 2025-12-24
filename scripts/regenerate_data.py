#!/usr/bin/env python3
"""
Regenerate data.json from existing images with all English words.
"""
import os
import json
from pathlib import Path
from dotenv import load_dotenv
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
from PIL import Image
import re

# Load environment variables
load_dotenv()

PROJECT_ROOT = Path(__file__).parent.parent
IMAGES_DIR = PROJECT_ROOT / "web-app" / "images"  # Use web-app images, not output
OUTPUT_DIR = PROJECT_ROOT / "web-app"  # Save directly to web-app
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
vocabulary = set()
with open(SOURCE_DIR / "vocabulary-list.csv", 'r', encoding='utf-8') as f:
    for line in f:
        word = line.strip()
        if word and not word.startswith('#'):
            vocabulary.add(word.lower())

print(f"Loaded {len(vocabulary)} vocabulary words")

# Get all existing images (only first 19 pages for the web app)
image_files = sorted(IMAGES_DIR.glob("page_*.png"))[:19]
print(f"Found {len(image_files)} pages to process")

all_pages_data = {}

for idx, image_path in enumerate(image_files, 1):
    page_num = int(image_path.stem.split('_')[1])
    page_key = f"page_{page_num:04d}"

    print(f"\nProcessing {page_key}...")

    # Run OCR
    with open(image_path, "rb") as f:
        poller = client.begin_analyze_document(model_id="prebuilt-read", document=f)
    result = poller.result()

    # Get image dimensions
    with Image.open(image_path) as img:
        img_width, img_height = img.size

    # Extract all words
    words = []
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

    print(f"  Extracted {len(words)} words")

    # Filter to English words only
    english_pattern = re.compile(r'^[a-zA-Z]+$')
    english_words = [w for w in words if english_pattern.match(w['text'])]
    print(f"  Filtered to {len(english_words)} English words")

    # Mark learning words
    matched_count = 0
    for word in english_words:
        is_learning = word['text'].lower() in vocabulary
        word['is_learning_word'] = is_learning
        if is_learning:
            matched_count += 1

    print(f"  Matched {matched_count} learning words")

    all_pages_data[page_key] = {
        'image': f"images/{image_path.name}",
        'words': english_words,
        'total_words_extracted': len(words),
        'english_words': len(english_words),
        'matched_words': matched_count
    }

# Save data.json
data_json_path = OUTPUT_DIR / "data.json"
with open(data_json_path, 'w', encoding='utf-8') as f:
    json.dump(all_pages_data, f, indent=2, ensure_ascii=False)

print(f"\n{'='*60}")
print("PROCESSING COMPLETE")
print(f"{'='*60}")
print(f"Data file: {data_json_path}")
print(f"Total pages processed: {len(all_pages_data)}")
print(f"Total learning words: {sum(p['matched_words'] for p in all_pages_data.values())}")
