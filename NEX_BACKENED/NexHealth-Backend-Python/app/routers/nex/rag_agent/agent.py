import logging
import os
import openai
from app.routers.nex.rag_agent.chroma_client import query_medical_dialogues

logger = logging.getLogger(__name__)

def run_rag_agent(query: str) -> str:
    """
    Retrieves context from Chroma DB and generates an answer using OpenAI.
    """
    logger.info(f"Running RAG agent for query: {query}")
    
    # 1. Retrieve relevant context
    documents = query_medical_dialogues(query_text=query, n_results=3)
    
    if not documents:
        context_str = "No specific relevant context found in the database."
    else:
        context_str = "\n\n".join([f"Document {i+1}:\n{doc}" for i, doc in enumerate(documents)])
        
    logger.debug(f"Retrieved context:\n{context_str}")

    # 2. Generate answer
    api_key = os.environ.get("OPENAI_KEY")
    if not api_key:
        logger.error("OPENAI_KEY not found in environment")
        return "I'm sorry, my AI backend is not properly configured (missing OpenAI key)."
        
    try:
        client = openai.OpenAI(api_key=api_key)
        
        system_prompt = (
            "You are a helpful medical assistant for the Bionex platform. "
            "Use the provided context to answer the user's query. "
            "If the answer is not in the context, you can use your general knowledge, "
            "but prioritize the provided context. If you are unsure, say you don't know."
        )
        
        user_prompt = f"Context information is below.\n---------------------\n{context_str}\n---------------------\nGiven the context information, answer this query: {query}"
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=500,
            temperature=0.3
        )
        
        return response.choices[0].message.content
        
    except Exception as e:
        logger.error(f"Error calling OpenAI API in RAG agent: {e}")
        return "I encountered an error while trying to generate a response."
