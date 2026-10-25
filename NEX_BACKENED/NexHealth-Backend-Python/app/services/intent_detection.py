import logging
import os
import json
import openai

logger = logging.getLogger(__name__)

def detect_intent(text: str) -> dict:
    """
    Intent detection module.
    Analyzes the provided text and returns an intent.
    """
    logger.info(f"Analyzing intent for text: {text}")
    
    api_key = os.environ.get("OPENAI_KEY", "").strip()
    if not api_key:
        logger.error("OPENAI_KEY not found in environment")
        return {
            "text": text,
            "intent": "unknown",
            "confidence": 0.0
        }
        
    try:
        client = openai.OpenAI(api_key=api_key)
        
        prompt = f"""
        Classify the following text into exactly one of these 4 categories:
        - General Conversation (Use this for general questions, and ALSO for questions about appointments, e.g., "when is my next appointment")
        - Report Summary (Use this for questions asking to summarize reports or test results)
        - Reminder Management (Use this for creating, updating, or asking about reminders)
        - Order Status (Use this STRICTLY for tracking medicine delivery, e.g., "how far are my medicines?" or "when will my meds arrive?")

        Respond in JSON format with two keys: "intent" (string) and "confidence" (float between 0.0 and 1.0).

        Text: {text}
        """
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful intent classification assistant. You always respond in valid JSON format."},
                {"role": "user", "content": prompt}
            ],
            response_format={ "type": "json_object" },
            max_tokens=200,
            temperature=0.0
        )
        
        result_content = response.choices[0].message.content
        result_json = json.loads(result_content)
        
        return {
            "text": text,
            "intent": result_json.get("intent", "unknown"),
            "confidence": result_json.get("confidence", 0.0)
        }
    except Exception as e:
        logger.error(f"Error calling OpenAI API: {e}")
        return {
            "text": text,
            "intent": "unknown",
            "confidence": 0.0
        }
