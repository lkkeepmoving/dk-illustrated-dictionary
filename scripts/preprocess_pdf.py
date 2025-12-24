"""
Preprocessing script to extract vocabulary words from dictionary PDF using Azure OCR.

This script:
1. Converts PDF pages to images
2. Runs Azure Document Intelligence OCR to extract text and coordinates
3. Matches extracted words against the vocabulary list
4. Generates data.json with word positions for the web app
"""

import os
import json
import re
from pathlib import Path
from typing import List, Dict, Tuple
from dotenv import load_dotenv
from pdf2image import convert_from_path
from PIL import Image
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential

# Load environment variables
load_dotenv()

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
SOURCE_DIR = PROJECT_ROOT / "source-materials"
OUTPUT_DIR = PROJECT_ROOT / "output"
IMAGES_DIR = OUTPUT_DIR / "images"

# Azure credentials
AZURE_ENDPOINT = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
AZURE_API_KEY = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_KEY")


def load_vocabulary_list(csv_path: Path) -> set:
    """Load vocabulary words from CSV file."""
    words = set()
    with open(csv_path, 'r', encoding='utf-8') as f:
        for line in f:
            word = line.strip()
            if word and not word.startswith('#'):  # Skip empty lines and comments
                # Store lowercase for case-insensitive matching
                words.add(word.lower())

    print(f"Loaded {len(words)} vocabulary words")
    return words


def convert_pdf_to_images(pdf_path: Path, output_dir: Path, first_page: int = None, last_page: int = None) -> List[Path]:
    """Convert PDF pages to PNG images."""
    print(f"\nConverting PDF to images...")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Convert PDF to images
    images = convert_from_path(
        pdf_path,
        dpi=200,  # High DPI for better OCR accuracy
        first_page=first_page,
        last_page=last_page,
        fmt='png'
    )

    image_paths = []
    for i, image in enumerate(images, start=first_page or 1):
        image_path = output_dir / f"page_{i:04d}.png"
        image.save(image_path, 'PNG')
        image_paths.append(image_path)
        print(f"  Saved: {image_path.name}")

    return image_paths


def extract_words_from_image(image_path: Path, client: DocumentAnalysisClient) -> List[Dict]:
    """
    Extract words and their bounding boxes from an image using Azure OCR.

    Returns a list of dictionaries with:
    - text: the word text
    - x, y, width, height: bounding box coordinates (normalized 0-1)
    """
    print(f"\n  Running OCR on {image_path.name}...")

    with open(image_path, "rb") as f:
        poller = client.begin_analyze_document(
            model_id="prebuilt-read",
            document=f
        )

    result = poller.result()

    # Get image dimensions for coordinate normalization
    with Image.open(image_path) as img:
        img_width, img_height = img.size

    words = []
    for page in result.pages:
        for word in page.words:
            # Extract bounding box coordinates
            # Azure returns polygon with 4 points, we convert to x, y, width, height
            if word.polygon and len(word.polygon) >= 4:
                # Get min/max coordinates from polygon
                x_coords = [p.x for p in word.polygon]
                y_coords = [p.y for p in word.polygon]

                x_min = min(x_coords)
                y_min = min(y_coords)
                x_max = max(x_coords)
                y_max = max(y_coords)

                # Normalize coordinates to 0-1 range
                words.append({
                    'text': word.content,
                    'x': x_min / img_width,
                    'y': y_min / img_height,
                    'width': (x_max - x_min) / img_width,
                    'height': (y_max - y_min) / img_height,
                    'confidence': word.confidence if hasattr(word, 'confidence') else 1.0
                })

    print(f"    Extracted {len(words)} words")
    return words


def filter_english_words(words: List[Dict]) -> List[Dict]:
    """Filter out non-English words (Chinese characters, numbers, symbols)."""
    english_pattern = re.compile(r'^[a-zA-Z]+$')
    filtered = [w for w in words if english_pattern.match(w['text'])]
    print(f"    Filtered to {len(filtered)} English words")
    return filtered


def match_vocabulary(words: List[Dict], vocabulary: set) -> List[Dict]:
    """Match extracted words against vocabulary list."""
    matched = []
    for word in words:
        if word['text'].lower() in vocabulary:
            matched.append(word)

    print(f"    Matched {len(matched)} vocabulary words")
    return matched


def process_pdf(pdf_path: Path, vocabulary_path: Path, output_dir: Path,
                first_page: int = None, last_page: int = None):
    """Main processing function."""

    # Validate Azure credentials
    if not AZURE_ENDPOINT or not AZURE_API_KEY:
        raise ValueError("Azure credentials not found. Please check your .env file.")

    print(f"Using Azure endpoint: {AZURE_ENDPOINT}")

    # Create Azure client
    client = DocumentAnalysisClient(
        endpoint=AZURE_ENDPOINT,
        credential=AzureKeyCredential(AZURE_API_KEY)
    )

    # Load vocabulary
    vocabulary = load_vocabulary_list(vocabulary_path)

    # Convert PDF to images
    image_paths = convert_pdf_to_images(pdf_path, IMAGES_DIR, first_page, last_page)

    # Process each image
    all_pages_data = {}

    for i, image_path in enumerate(image_paths, start=first_page or 1):
        print(f"\nProcessing page {i}...")

        # Extract words with OCR
        words = extract_words_from_image(image_path, client)

        # Filter to English words only
        english_words = filter_english_words(words)

        # Match against vocabulary
        matched_words = match_vocabulary(english_words, vocabulary)

        # Mark which words are learning words
        learning_word_texts = {w['text'].lower() for w in matched_words}
        for word in english_words:
            word['is_learning_word'] = word['text'].lower() in learning_word_texts

        # Store page data with ALL English words
        all_pages_data[f"page_{i:04d}"] = {
            'image': f"images/page_{i:04d}.png",
            'words': english_words,  # Changed from matched_words to english_words
            'total_words_extracted': len(words),
            'english_words': len(english_words),
            'matched_words': len(matched_words)
        }

    # Save data.json
    data_json_path = output_dir / "data.json"
    with open(data_json_path, 'w', encoding='utf-8') as f:
        json.dump(all_pages_data, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print("PROCESSING COMPLETE")
    print(f"{'='*60}")
    print(f"Output directory: {output_dir}")
    print(f"Data file: {data_json_path}")
    print(f"Total pages processed: {len(all_pages_data)}")

    # Summary statistics
    total_matched = sum(page['matched_words'] for page in all_pages_data.values())
    print(f"Total vocabulary words found: {total_matched}")


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description='Process dictionary PDF with Azure OCR')
    parser.add_argument('--sample', action='store_true',
                        help='Process sample PDF instead of full PDF')
    parser.add_argument('--first-page', type=int,
                        help='First page to process (default: 1)')
    parser.add_argument('--last-page', type=int,
                        help='Last page to process (default: all)')

    args = parser.parse_args()

    # Select PDF file
    if args.sample:
        pdf_path = SOURCE_DIR / "sample DK中英双语10000词.pdf"
        print("Processing SAMPLE PDF")
    else:
        pdf_path = SOURCE_DIR / "DK中英双语10000词.pdf"
        print("Processing FULL PDF")

    vocabulary_path = SOURCE_DIR / "vocabulary-list.csv"

    # Validate inputs
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")
    if not vocabulary_path.exists():
        raise FileNotFoundError(f"Vocabulary list not found: {vocabulary_path}")

    # Process
    process_pdf(
        pdf_path=pdf_path,
        vocabulary_path=vocabulary_path,
        output_dir=OUTPUT_DIR,
        first_page=args.first_page,
        last_page=args.last_page
    )


if __name__ == "__main__":
    main()
