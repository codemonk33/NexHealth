import json
import logging
from typing import Dict, List, Tuple, Any, Union

import chromadb

logger = logging.getLogger("bionex.chroma_service")
# Ensure logging output goes to console if logger is not configured elsewhere
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)


def load_hf_dataset(dataset_name: str = "omi-health/medical-dialogue-to-soap-summary") -> Any:
    """
    Loads a Hugging Face dataset directly using the datasets library.
    
    Args:
        dataset_name (str): The identifier of the Hugging Face dataset.
        
    Returns:
        Dataset or DatasetDict: The loaded dataset.
    """
    logger.info(f"Loading dataset '{dataset_name}' from Hugging Face...")
    try:
        from datasets import load_dataset
        dataset = load_dataset(dataset_name)
        logger.info(f"Successfully loaded dataset '{dataset_name}'.")
        return dataset
    except Exception as e:
        logger.error(f"Failed to load dataset '{dataset_name}': {e}", exc_info=True)
        raise


def detect_dialogue_column(dataset_split: Any) -> str:
    """
    Inspects the dataset and automatically determines which field contains
    the dialogue text instead of hardcoding column names.
    
    Args:
        dataset_split (Dataset): A split of the Hugging Face dataset to analyze.
        
    Returns:
        str: The detected column name containing dialogue.
    """
    column_names = dataset_split.column_names
    logger.info(f"Inspecting columns: {column_names}")
    
    # 1. Priority: Exact lowercase match with common dialogue-related keywords
    common_names = ["dialogue", "dialog", "conversation", "transcript", "text"]
    for col in column_names:
        if col.lower() in common_names:
            logger.info(f"Heuristic Match: Exactly found dialogue column '{col}'")
            return col
            
    # 2. Priority: Substring match with common dialogue keywords
    for col in column_names:
        for common in common_names:
            if common in col.lower():
                logger.info(f"Heuristic Match: Found dialogue keyword in column name '{col}'")
                return col
                
    # 3. Fallback: Content-based heuristic by inspecting the first few rows
    logger.info("No simple column name match. Applying content-based heuristics...")
    candidates = []
    num_rows = min(5, len(dataset_split))
    
    for col in column_names:
        # Check if first few records are strings
        first_vals = [dataset_split[i][col] for i in range(num_rows)]
        if all(isinstance(v, str) for v in first_vals):
            avg_len = sum(len(v) for v in first_vals) / num_rows
            
            # Score the content for dialogue-like structure
            score = 0
            for val in first_vals:
                lower_val = val.lower()
                # Colons indicate speaker: message structures
                if ":" in val:
                    score += 2
                # Dialogue segments usually contain line breaks
                if "\n" in val:
                    score += 1
                # Dialogue keywords in the text
                if any(spk in lower_val for spk in ["doctor", "patient", "physician", "doctor:", "patient:"]):
                    score += 5
            
            candidates.append((col, avg_len, score))
            logger.debug(f"Candidate column '{col}' -> Avg Len: {avg_len:.1f}, Dialogue Score: {score}")
            
    if candidates:
        # Sort candidates primarily by dialogue score (descending), then by average length (descending)
        candidates.sort(key=lambda x: (x[2], x[1]), reverse=True)
        detected_col = candidates[0][0]
        logger.info(f"Heuristic Match: Selected '{detected_col}' based on content analysis (Score: {candidates[0][2]}, Avg Len: {candidates[0][1]:.1f})")
        return detected_col
        
    # Default fallback: return the first column
    fallback_col = column_names[0]
    logger.warning(f"No text candidates found. Falling back to first column: '{fallback_col}'")
    return fallback_col


def get_embedding_model(model_name: str = "sentence-transformers/all-MiniLM-L6-v2") -> Any:
    """
    Loads and returns the sentence-transformers embedding model.
    
    Args:
        model_name (str): Sentence-transformer model ID.
        
    Returns:
        SentenceTransformer: Loaded embedding model.
    """
    logger.info(f"Loading embedding model '{model_name}'...")
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer(model_name)
        logger.info(f"Successfully loaded embedding model '{model_name}'.")
        return model
    except Exception as e:
        logger.error(f"Failed to load embedding model '{model_name}': {e}", exc_info=True)
        raise


def get_chroma_collection(
    api_key: str = "",
    tenant: str = "",
    database: str = "Dev",
    persist_dir: str = "chroma_db",
    collection_name: str = "medical_dialogues"
) -> Tuple[Union[chromadb.PersistentClient, chromadb.CloudClient], chromadb.Collection]:
    """
    Initializes a ChromaDB client (CloudClient when an API key is configured,
    otherwise PersistentClient) and returns the client and collection.
    
    Args:
        api_key (str): API key for Chroma Cloud.
        tenant (str): Chroma Cloud tenant identifier.
        database (str): Chroma Cloud database name.
        persist_dir (str): Local directory path on disk (used when cloud credentials are absent).
        collection_name (str): Name of the ChromaDB collection.
        
    Returns:
        Tuple[Union[chromadb.PersistentClient, chromadb.CloudClient], chromadb.Collection]: Client and collection objects.
    """
    try:
        if api_key:
            logger.info("Initializing ChromaDB CloudClient...")
            client = chromadb.CloudClient(
                api_key=api_key,
                tenant=tenant,
                database=database,
            )
        else:
            logger.info(f"Initializing ChromaDB PersistentClient at '{persist_dir}'...")
            client = chromadb.PersistentClient(path=persist_dir)
            
        collection = client.get_or_create_collection(name=collection_name)
        logger.info(f"ChromaDB collection '{collection_name}' initialized.")
        return client, collection
    except Exception as e:
        logger.error(f"Failed to initialize ChromaDB client or collection: {e}", exc_info=True)
        raise


def prepare_document_and_metadata(
    row: Dict[str, Any],
    dialogue_col: str,
    split_name: str
) -> Tuple[str, Dict[str, Any]]:
    """
    Extracts the dialogue document text and formats all remaining useful fields as metadata.
    
    Args:
        row (Dict[str, Any]): A single row from the dataset.
        dialogue_col (str): The column designated as the dialogue text.
        split_name (str): The name of the dataset split (e.g. 'train', 'test').
        
    Returns:
        Tuple[str, Dict[str, Any]]: Document string and clean metadata dictionary.
    """
    document = row.get(dialogue_col, "")
    metadata = {}
    
    for key, val in row.items():
        if key == dialogue_col:
            continue
        
        # Format values to satisfy ChromaDB metadata requirements (str, int, float, bool)
        if val is None:
            metadata[key] = ""
        elif isinstance(val, (str, int, float, bool)):
            metadata[key] = val
        else:
            # Serialize lists, dictionaries, or custom objects to JSON string
            metadata[key] = json.dumps(val)
            
    # Include dataset split for tracking/filtering in future phases
    metadata["split"] = split_name
    return document, metadata


def process_and_store_dataset(
    dataset: Any,
    collection: chromadb.Collection,
    model: Any,
    dialogue_col: str,
    batch_size: int = 128
) -> int:
    """
    Processes dataset records, generates embeddings in batches, and stores them in ChromaDB.
    
    Args:
        dataset (Any): The loaded Hugging Face dataset (Dataset or DatasetDict).
        collection (chromadb.Collection): ChromaDB collection target.
        model (SentenceTransformer): Sentence-transformer model.
        dialogue_col (str): Name of the dialogue text column.
        batch_size (int): Batch size for embedding and DB insertion.
        
    Returns:
        int: The number of dataset records successfully processed and stored.
    """
    total_processed = 0
    
    # Handle DatasetDict vs single Dataset
    if hasattr(dataset, "keys"):
        splits = list(dataset.keys())
        dataset_dict = dataset
    else:
        splits = ["train"]
        dataset_dict = {"train": dataset}
        
    logger.info(f"Beginning processing across splits: {splits}")
    
    for split_name in splits:
        split_data = dataset_dict[split_name]
        num_records = len(split_data)
        logger.info(f"Processing split '{split_name}' with {num_records} records...")
        
        for i in range(0, num_records, batch_size):
            batch_end = min(i + batch_size, num_records)
            batch_rows = [split_data[j] for j in range(i, batch_end)]
            
            batch_docs = []
            batch_metadatas = []
            batch_ids = []
            
            for idx, row in enumerate(batch_rows):
                doc, meta = prepare_document_and_metadata(row, dialogue_col, split_name)
                # Ensure we skip blank records
                if doc and doc.strip():
                    batch_docs.append(doc)
                    batch_metadatas.append(meta)
                    # Unique ID: combination of split name and absolute split index
                    doc_id = f"doc_{split_name}_{i + idx}"
                    batch_ids.append(doc_id)
                    
            if not batch_docs:
                continue
                
            try:
                logger.info(f"Processing batch {i // batch_size + 1} ({len(batch_docs)} records, indices {i} to {batch_end - 1})...")
                
                # 1. Generate embeddings using sentence-transformers
                embeddings = model.encode(batch_docs, convert_to_numpy=True, show_progress_bar=False)
                # Convert numpy array to standard list of lists of floats for ChromaDB
                embeddings_list = embeddings.tolist()
                
                # 2. Insert into ChromaDB collection (using upsert to support idempotency)
                collection.upsert(
                    ids=batch_ids,
                    embeddings=embeddings_list,
                    metadatas=batch_metadatas,
                    documents=batch_docs
                )
                
                total_processed += len(batch_docs)
                logger.info(f"Inserted batch. Total documents stored: {total_processed}")
                
            except Exception as e:
                logger.error(f"Error processing batch from index {i} to {batch_end}: {e}", exc_info=True)
                raise
                
    return total_processed
