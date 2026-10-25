import os
import sys
import logging

# Ensure project root is in python path to allow importing from 'app'
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from app.config import get_settings
from app.services.chroma_service import (
    load_hf_dataset,
    detect_dialogue_column,
    get_embedding_model,
    get_chroma_collection,
    process_and_store_dataset
)

# Set up logging to console
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("initialize_chroma")


def main():
    """
    Main orchestration function to run the data collection, embedding generation,
    and ChromaDB insertion pipeline.
    """
    try:
        logger.info("Starting ChromaDB database initialization pipeline...")
        
        # 1. Load Hugging Face dataset
        dataset = load_hf_dataset()
        
        # 2. Print dataset info and columns
        print("\n=== Dataset Information ===")
        print(f"Dataset object: {dataset}")
        
        # Determine available column names based on dataset format
        if hasattr(dataset, "keys"):
            splits = list(dataset.keys())
            sample_split = splits[0]
            column_names = dataset[sample_split].column_names
            print(f"Splits found: {splits}")
            print(f"Available column names in split '{sample_split}': {column_names}")
            detect_split = dataset[sample_split]
        else:
            column_names = dataset.column_names
            print(f"Available column names: {column_names}")
            detect_split = dataset
            
        # 3. Detect dialogue column name using content & naming heuristic functions
        dialogue_col = detect_dialogue_column(detect_split)
        print(f"Heuristically detected dialogue column: '{dialogue_col}'\n")
        
        # 4. Initialize embedding model (Sentence-Transformers)
        model = get_embedding_model()
        
        # 5. Initialize ChromaDB client and collection (CloudClient or PersistentClient)
        settings = get_settings()
        persist_dir = os.path.join(project_root, settings.CHROMA_PERSIST_DIR)
        client, collection = get_chroma_collection(
            api_key=settings.CHROMA_API_KEY,
            tenant=settings.CHROMA_TENANT,
            database=settings.CHROMA_DATABASE,
            persist_dir=persist_dir,
            collection_name=settings.CHROMA_COLLECTION_NAME
        )
        
        # 6. Process and store dataset in ChromaDB in batches
        logger.info("Starting processing and insertion of records into ChromaDB...")
        processed_count = process_and_store_dataset(
            dataset=dataset,
            collection=collection,
            model=model,
            dialogue_col=dialogue_col,
            batch_size=256  # 256 size is optimized for speed and memory
        )
        
        # 7. Print statistics and verify contents
        db_count = collection.count()
        print("\n=== Pipeline Execution Summary ===")
        print(f"Number of dataset records processed: {processed_count}")
        print(f"Number of vectors stored in ChromaDB: {db_count}")
        
        # Retrieve a sample document and metadata to prove correctness
        if db_count > 0:
            peek_result = collection.peek(limit=1)
            sample_id = peek_result["ids"][0]
            sample_doc = peek_result["documents"][0]
            sample_meta = peek_result["metadatas"][0]
            print("\n=== Sample Stored Document ===")
            print(f"ID: {sample_id}")
            print(f"Document snippet:\n{sample_doc[:500]}...")  # Show first 500 characters
            print(f"Metadata: {sample_meta}")
        else:
            print("Warning: Collection is empty!")
            
        logger.info("ChromaDB database initialization pipeline completed successfully.")
        
    except Exception as e:
        logger.error(f"An error occurred during ChromaDB database initialization: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
