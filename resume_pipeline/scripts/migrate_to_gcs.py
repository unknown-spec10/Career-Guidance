"""
Script to migrate existing local uploaded files (resumes, marksheets, avatars) to GCP Cloud Storage (GCS).

Usage:
    python scripts/migrate_to_gcs.py [--bucket BUCKET_NAME] [--local-dir LOCAL_DIR] [--force]
"""
import os
import sys
import argparse
import logging
from pathlib import Path

# Add package root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from resume_pipeline.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def migrate_files(bucket_name: str, local_dir: str, force: bool = False):
    try:
        from google.cloud import storage as gcs
    except ImportError:
        logger.error("google-cloud-storage library is required. Run: pip install google-cloud-storage")
        sys.exit(1)

    local_path = Path(local_dir).resolve()
    if not local_path.exists():
        logger.warning(f"Local storage directory '{local_path}' does not exist. Nothing to migrate.")
        return

    logger.info(f"Connecting to GCS bucket '{bucket_name}'...")
    client_kwargs = {}
    if settings.GCS_PROJECT_ID:
        client_kwargs["project"] = settings.GCS_PROJECT_ID
        
    client = gcs.Client(**client_kwargs)
    bucket = client.bucket(bucket_name)

    if not bucket.exists():
        logger.error(f"GCS bucket '{bucket_name}' does not exist or permission denied!")
        sys.exit(1)

    uploaded_count = 0
    skipped_count = 0
    failed_count = 0

    logger.info(f"Scanning files in '{local_path}'...")
    for root, _, files in os.walk(local_path):
        for file in files:
            full_path = Path(root) / file
            rel_path = full_path.relative_to(local_path)
            
            # Construct standard remote key
            # e.g., resumes/app_123/resume.pdf or avatars/user_1/avatar.jpg
            remote_key = str(rel_path).replace("\\", "/")

            blob = bucket.blob(remote_key)
            if not force and blob.exists():
                logger.info(f"[SKIP] Remote blob 'gs://{bucket_name}/{remote_key}' already exists.")
                skipped_count += 1
                continue

            try:
                import mimetypes
                content_type, _ = mimetypes.guess_type(str(full_path))
                if content_type:
                    blob.content_type = content_type

                logger.info(f"[UPLOADING] {full_path} -> gs://{bucket_name}/{remote_key}")
                blob.upload_from_filename(str(full_path))
                uploaded_count += 1
            except Exception as e:
                logger.error(f"[ERROR] Failed to upload {full_path}: {e}")
                failed_count += 1

    logger.info("==================================================")
    logger.info(f"Migration finished. Uploaded: {uploaded_count}, Skipped: {skipped_count}, Failed: {failed_count}")
    logger.info("==================================================")


def main():
    parser = argparse.ArgumentParser(description="Migrate local upload files to GCS.")
    parser.add_argument("--bucket", default=settings.GCS_BUCKET_NAME, help="GCS Bucket name")
    parser.add_argument("--local-dir", default=settings.FILE_STORAGE_PATH, help="Path to local file storage directory")
    parser.add_argument("--force", action="store_true", help="Overwrite existing remote files in GCS")

    args = parser.parse_args()
    migrate_files(bucket_name=args.bucket, local_dir=args.local_dir, force=args.force)


if __name__ == "__main__":
    main()
