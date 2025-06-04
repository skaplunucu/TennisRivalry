#!/usr/bin/env python3
"""
Tennis Player Image Downloader
Downloads player images from Wikimedia using Wikidata IDs
"""

import json
import os
import requests
import time
from pathlib import Path
from urllib.parse import urlparse
import logging

# Set up logging with proper encoding
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('image_download.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class TennisPlayerImageDownloader:
    def __init__(self, output_dir="./tennis-scrollytelling/images/players"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'TennisPlayerImageDownloader/1.0 (https://example.com/contact)'
        })

    def get_wikipedia_page_from_wikidata(self, wikidata_id):
        """Get Wikipedia page title from Wikidata ID"""
        url = "https://www.wikidata.org/w/api.php"
        params = {
            'action': 'wbgetentities',
            'format': 'json',
            'ids': wikidata_id,
            'props': 'sitelinks'
        }

        try:
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            if 'entities' in data and wikidata_id in data['entities']:
                entity = data['entities'][wikidata_id]
                if 'sitelinks' in entity and 'enwiki' in entity['sitelinks']:
                    return entity['sitelinks']['enwiki']['title']

        except Exception as e:
            logger.error(f"Error fetching Wikipedia page for {wikidata_id}: {e}")
        return None

    def get_main_image_from_wikipedia(self, page_title):
        """Get the main image from Wikipedia page"""
        # Method 1: Try Wikipedia REST API first (usually gives best main image)
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{page_title}"

        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()

            if 'originalimage' in data:
                return data['originalimage']['source']
            elif 'thumbnail' in data:
                return data['thumbnail']['source']

        except Exception as e:
            logger.warning(f"REST API failed for {page_title}, trying MediaWiki API: {e}")

        # Method 2: Fallback to MediaWiki API
        url = "https://en.wikipedia.org/w/api.php"
        params = {
            'action': 'query',
            'format': 'json',
            'titles': page_title,
            'prop': 'pageimages',
            'pithumbsize': 1000,  # Request large size
            'pilicense': 'any'
        }

        try:
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            pages = data['query']['pages']
            for page_id, page_data in pages.items():
                if 'thumbnail' in page_data:
                    return page_data['thumbnail']['source']

        except Exception as e:
            logger.error(f"MediaWiki API failed for {page_title}: {e}")

        return None

    def get_image_from_wikidata_direct(self, wikidata_id):
        """Try to get image directly from Wikidata entity"""
        url = "https://www.wikidata.org/w/api.php"
        params = {
            'action': 'wbgetentities',
            'format': 'json',
            'ids': wikidata_id,
            'props': 'claims'
        }

        try:
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            if 'entities' in data and wikidata_id in data['entities']:
                entity = data['entities'][wikidata_id]
                if 'claims' in entity:
                    # Look for image property (P18)
                    if 'P18' in entity['claims']:
                        image_claim = entity['claims']['P18'][0]
                        if 'mainsnak' in image_claim and 'datavalue' in image_claim['mainsnak']:
                            filename = image_claim['mainsnak']['datavalue']['value']
                            # Convert to Commons URL
                            filename_encoded = filename.replace(' ', '_')
                            return f"https://commons.wikimedia.org/wiki/Special:FilePath/{filename_encoded}"

        except Exception as e:
            logger.warning(f"Direct Wikidata image fetch failed for {wikidata_id}: {e}")

        return None

    def download_image(self, url, filepath, max_retries=3):
        """Download image from URL to filepath"""
        for attempt in range(max_retries):
            try:
                response = self.session.get(url, timeout=30, stream=True)
                response.raise_for_status()

                # Check if it's actually an image
                content_type = response.headers.get('content-type', '')
                if not content_type.startswith('image/'):
                    logger.warning(f"URL doesn't point to image: {url} (content-type: {content_type})")
                    return False

                with open(filepath, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)

                # Verify file was created and has content
                if filepath.exists() and filepath.stat().st_size > 0:
                    logger.info(f"Successfully downloaded: {filepath.name}")
                    return True
                else:
                    logger.error(f"Downloaded file is empty: {filepath}")
                    return False

            except Exception as e:
                logger.warning(f"Download attempt {attempt + 1} failed for {url}: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff

        return False

    def process_player(self, player_data):
        """Process a single player"""
        player_id = player_data['player_id']
        player_name = player_data['player_name']
        wikimedia_id = player_data['wikimedia_id']
        
        # Use player_id as filename instead of player name
        filename = f"{player_id}.jpg"

        # Create full filepath
        filepath = self.output_dir / filename

        # Skip if file already exists
        if filepath.exists():
            logger.info(f"Skipping {player_name} - file already exists: {filename}")
            return True

        logger.info(f"Processing {player_name} (ID: {player_id}, Wikidata: {wikimedia_id})")

        # Try different methods to get image URL
        image_url = None

        # Method 1: Direct from Wikidata
        image_url = self.get_image_from_wikidata_direct(wikimedia_id)

        # Method 2: Via Wikipedia page if direct method failed
        if not image_url:
            page_title = self.get_wikipedia_page_from_wikidata(wikimedia_id)
            if page_title:
                image_url = self.get_main_image_from_wikipedia(page_title)

        if not image_url:
            logger.error(f"Could not find image for {player_name} ({wikimedia_id})")
            return False

        # Download the image
        success = self.download_image(image_url, filepath)
        if success:
            logger.info(f"[SUCCESS] Downloaded {player_name} -> {filename}")
        else:
            logger.error(f"[FAILED] Failed to download {player_name}")

        return success

    def run(self, json_file="player_list.json"):
        """Main function to process all players"""
        if not Path(json_file).exists():
            logger.error(f"Player list file not found: {json_file}")
            return

        # Load player data
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                players = json.load(f)
        except Exception as e:
            logger.error(f"Error loading {json_file}: {e}")
            return

        if not isinstance(players, list):
            logger.error("Expected JSON file to contain a list of players")
            return

        logger.info(f"Starting download for {len(players)} players...")
        logger.info(f"Output directory: {self.output_dir.absolute()}")

        successful = 0
        failed = 0
        skipped = 0

        for i, player in enumerate(players, 1):
            logger.info(f"\n--- Processing {i}/{len(players)} ---")

            # Validate required fields
            required_fields = ['player_id', 'player_name', 'wikimedia_id']
            if not all(field in player for field in required_fields):
                logger.error(f"Player missing required fields: {player}")
                failed += 1
                continue

            # Check if file already exists (using player_id-based filename)
            filename = f"{player['player_id']}.jpg"
            filepath = self.output_dir / filename
            if filepath.exists():
                logger.info(f"Skipping {player['player_name']} - file already exists")
                skipped += 1
                continue

            # Process player
            try:
                success = self.process_player(player)
                if success:
                    successful += 1
                else:
                    failed += 1

                # Small delay to be nice to the servers
                time.sleep(1)

            except Exception as e:
                logger.error(f"Unexpected error processing {player['player_name']}: {e}")
                failed += 1

        # Summary
        logger.info(f"\n=== DOWNLOAD COMPLETE ===")
        logger.info(f"Successful: {successful}")
        logger.info(f"Failed: {failed}")
        logger.info(f"Skipped (already existed): {skipped}")
        logger.info(f"Total: {len(players)}")


def main():
    """Main entry point"""
    downloader = TennisPlayerImageDownloader()
    downloader.run("player_list.json")


if __name__ == "__main__":
    main()