import logging
import chromadb
from chromadb.config import Settings
from app.config import get_settings

logger = logging.getLogger(__name__)

# Cache the client instance so we don't recreate it on every request
_chroma_client = None

def get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
        settings = get_settings()
        logger.info(f"Connecting to Chroma Cloud for tenant: {settings.CHROMA_TENANT}")
        
        try:
            _chroma_client = chromadb.CloudClient(
                tenant=settings.CHROMA_TENANT,
                database=settings.CHROMA_DATABASE,
                api_key=settings.CHROMA_API_KEY
            )
        except Exception as e:
            logger.error(f"Failed to connect to Chroma DB: {e}")
            raise e
            
    return _chroma_client

def query_medical_dialogues(query_text: str, n_results: int = 3) -> list:
    """
    Queries the medical_dialogues collection for relevant context.
    Returns a list of document strings.
    """
    try:
        client = get_chroma_client()
        settings = get_settings()
        
        # Get the collection
        collection = client.get_collection(name=settings.CHROMA_COLLECTION_NAME)
        
        # Query
        results = collection.query(
            query_texts=[query_text],
            n_results=n_results
        )
        
        # Results is a dict with 'documents', 'metadatas', 'distances', etc.
        # Documents are usually a list of lists.
        documents = results.get("documents", [[]])
        
        if documents and len(documents) > 0:
            return documents[0]
            
        return []
    except Exception as e:
        logger.error(f"Error querying Chroma DB: {e}")
        return []
