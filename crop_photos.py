#!/usr/bin/env python3
"""
AI Face Cropper for Tennis Player Photos
Uses MediaPipe for face detection and creates circular face crops
"""

import cv2
import numpy as np
import mediapipe as mp
import json
import logging
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import os

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class FaceCropper:
    def __init__(self, input_dir="./tennis-scrollytelling/images/players",
                 output_dir="./tennis-scrollytelling/images/players/cropped",
                 crop_size=400):
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.crop_size = crop_size

        # Initialize MediaPipe Face Detection
        self.mp_face_detection = mp.solutions.face_detection
        self.mp_drawing = mp.solutions.drawing_utils
        self.face_detection = self.mp_face_detection.FaceDetection(
            model_selection=1,  # 1 for full range detection (better for photos)
            min_detection_confidence=0.3
        )

    def detect_face(self, image):
        """Detect face in image using MediaPipe"""
        # Convert BGR to RGB
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = self.face_detection.process(rgb_image)

        if results.detections:
            # Get the first (most confident) detection
            detection = results.detections[0]
            bboxC = detection.location_data.relative_bounding_box

            # Convert relative coordinates to pixel coordinates
            h, w, _ = image.shape
            x = int(bboxC.xmin * w)
            y = int(bboxC.ymin * h)
            width = int(bboxC.width * w)
            height = int(bboxC.height * h)

            # Expand the bounding box to include more of the head/shoulders
            expansion_factor = 0.7  # Expand by 70%
            center_x = x + width // 2
            center_y = y + height // 2

            new_width = int(width * (1 + expansion_factor))
            new_height = int(height * (1 + expansion_factor))

            new_x = max(0, center_x - new_width // 2)
            new_y = max(0, center_y - new_height // 2)
            new_x2 = min(w, new_x + new_width)
            new_y2 = min(h, new_y + new_height)

            return {
                'bbox': (new_x, new_y, new_x2, new_y2),
                'confidence': detection.score[0],
                'center': (center_x, center_y)
            }

        return None

    def create_circular_crop(self, image, bbox, output_size):
        """Create a circular crop from the detected face"""
        x1, y1, x2, y2 = bbox

        # Crop the face region
        face_crop = image[y1:y2, x1:x2]

        # Convert to PIL for easier manipulation
        face_pil = Image.fromarray(cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB))

        # Make it square (crop from center)
        width, height = face_pil.size
        size = min(width, height)

        left = (width - size) // 2
        top = (height - size) // 2
        face_square = face_pil.crop((left, top, left + size, top + size))

        # Resize to desired output size
        face_resized = face_square.resize((output_size, output_size), Image.Resampling.LANCZOS)

        # Create circular mask
        mask = Image.new('L', (output_size, output_size), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, output_size, output_size), fill=255)

        # Apply Gaussian blur to the mask for smoother edges
        mask = mask.filter(ImageFilter.GaussianBlur(radius=2))

        # Create transparent background
        result = Image.new('RGBA', (output_size, output_size), (0, 0, 0, 0))

        # Paste the face using the circular mask
        result.paste(face_resized, (0, 0))
        result.putalpha(mask)

        return result

    def process_image(self, input_path, output_path, player_name):
        """Process a single image"""
        try:
            # Read image
            image = cv2.imread(str(input_path))
            if image is None:
                logger.error(f"Could not load image: {input_path}")
                return False

            # Detect face
            face_data = self.detect_face(image)
            if not face_data:
                logger.warning(f"No face detected in {player_name} ({input_path.name})")
                return False

            logger.info(f"Face detected for {player_name} (confidence: {face_data['confidence']:.2f})")

            # Create circular crop
            circular_face = self.create_circular_crop(image, face_data['bbox'], self.crop_size)

            # Save as PNG to preserve transparency
            output_path_png = output_path.with_suffix('.png')
            circular_face.save(output_path_png, 'PNG')

            logger.info(f"[SUCCESS] Cropped face saved: {output_path_png.name}")
            return True

        except Exception as e:
            logger.error(f"Error processing {player_name}: {e}")
            return False

    def batch_process(self, player_list_file="player_list.json"):
        """Process all player images"""
        # Load player data
        if not Path(player_list_file).exists():
            logger.error(f"Player list file not found: {player_list_file}")
            return

        with open(player_list_file, 'r', encoding='utf-8') as f:
            players = json.load(f)

        logger.info(f"Processing {len(players)} player images...")
        logger.info(f"Input directory: {self.input_dir}")
        logger.info(f"Output directory: {self.output_dir}")
        logger.info(f"Crop size: {self.crop_size}x{self.crop_size} pixels")

        successful = 0
        failed = 0
        skipped = 0

        for i, player in enumerate(players, 1):
            player_name = player['player_name']
            filename = player['filename']

            input_path = self.input_dir / filename
            # Create output filename (keep same name but change to PNG)
            output_filename = Path(filename).stem + '_cropped.png'
            output_path = self.output_dir / output_filename

            logger.info(f"\n--- Processing {i}/{len(players)}: {player_name} ---")

            # Check if input file exists
            if not input_path.exists():
                logger.warning(f"Input file not found: {input_path}")
                failed += 1
                continue

            # Check if output already exists
            if output_path.exists():
                logger.info(f"Skipping {player_name} - cropped version already exists")
                skipped += 1
                continue

            # Process the image
            success = self.process_image(input_path, output_path, player_name)
            if success:
                successful += 1
            else:
                failed += 1

        # Summary
        logger.info(f"\n=== FACE CROPPING COMPLETE ===")
        logger.info(f"Successful: {successful}")
        logger.info(f"Failed: {failed}")
        logger.info(f"Skipped (already existed): {skipped}")
        logger.info(f"Total: {len(players)}")


def main():
    """Main entry point"""
    cropper = FaceCropper(
        input_dir="./tennis-scrollytelling/images/players",
        output_dir="./tennis-scrollytelling/images/players/cropped",
        crop_size=400  # 400x400 pixel circular crops
    )
    cropper.batch_process("player_list.json")


if __name__ == "__main__":
    main()