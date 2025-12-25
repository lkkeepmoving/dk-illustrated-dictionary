#!/usr/bin/env python3
"""
Test Azure OCR to see if it can extract lines (phrases) in addition to words.
"""
import os
import json
from pathlib import Path
from dotenv import load_dotenv
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential

load_dotenv()

PROJECT_ROOT = Path(__file__).parent.parent
IMAGES_DIR = PROJECT_ROOT / "web-app" / "images"

AZURE_ENDPOINT = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
AZURE_API_KEY = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_KEY")

# Create Azure client
client = DocumentAnalysisClient(
    endpoint=AZURE_ENDPOINT,
    credential=AzureKeyCredential(AZURE_API_KEY)
)

# Test with page 1
image_path = IMAGES_DIR / "page_0001.png"

print("Testing Azure OCR output structure...")
print("="*60)

with open(image_path, "rb") as f:
    poller = client.begin_analyze_document(model_id="prebuilt-read", document=f)
result = poller.result()

print(f"\nOCR Result Structure:")
print(f"  Pages: {len(result.pages)}")

for page in result.pages:
    print(f"\n  Lines: {len(page.lines) if hasattr(page, 'lines') else 'N/A'}")
    print(f"  Words: {len(page.words)}")

    if hasattr(page, 'lines') and page.lines:
        print(f"\n  First 10 LINES (may contain phrases):")
        for i, line in enumerate(page.lines[:10], 1):
            word_count = len(line.content.split())
            print(f"    {i}. '{line.content}' ({word_count} words)")

        print(f"\n  Analysis:")
        multi_word_lines = [line for line in page.lines if len(line.content.split()) > 1]
        print(f"    Total lines: {len(page.lines)}")
        print(f"    Multi-word lines: {len(multi_word_lines)}")
        print(f"    Single-word lines: {len(page.lines) - len(multi_word_lines)}")

    print(f"\n  First 10 WORDS:")
    for i, word in enumerate(page.words[:10], 1):
        print(f"    {i}. '{word.content}'")

    break  # Just first page

print("\n" + "="*60)
print("CONCLUSION:")
print("If 'lines' are available and contain multi-word phrases,")
print("we can use proximity-based matching to reconstruct phrases!")
