import os
import sys
import logging

# Ensure project root is in python path to allow importing from 'app'
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from app.config import get_settings
from app.services.chroma_service import get_chroma_collection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_chroma_connection")


def main():
    """
    Verification script to test connection to ChromaDB in whichever mode is currently configured.
    """
    try:
        settings = get_settings()
        print("\n=== Configured ChromaDB Settings ===")
        print(f"CHROMA_API_KEY: {'configured (masked)' if settings.CHROMA_API_KEY else 'not set'}")
        print(f"CHROMA_TENANT: '{settings.CHROMA_TENANT}'")
        print(f"CHROMA_DATABASE: '{settings.CHROMA_DATABASE}'")
        print(f"CHROMA_PERSIST_DIR: '{settings.CHROMA_PERSIST_DIR}'")
        print(f"CHROMA_COLLECTION_NAME: '{settings.CHROMA_COLLECTION_NAME}'")
        
        persist_dir = os.path.join(project_root, settings.CHROMA_PERSIST_DIR)
        
        # Initialize connection based on configuration
        print("\nConnecting to database...")
        client, collection = get_chroma_collection(
            api_key=settings.CHROMA_API_KEY,
            tenant=settings.CHROMA_TENANT,
            database=settings.CHROMA_DATABASE,
            persist_dir=persist_dir,
            collection_name=settings.CHROMA_COLLECTION_NAME
        )
        
        print("\n=== Connection Verification Successful ===")
        print(f"Client Instance: {type(client).__name__}")
        print(f"Collection Name: {collection.name}")
        print(f"Stored Document Count: {collection.count()}")
        
        if collection.count() > 0:
            sample = collection.peek(limit=1)
            print(f"Sample Document ID: {sample['ids'][0]}")
            print(f"Sample Document Snippet: {sample['documents'][0][:150]}...")
            
    except Exception as e:
        print(f"\nConnection failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
