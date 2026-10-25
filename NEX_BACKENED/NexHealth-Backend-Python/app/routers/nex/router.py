from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from typing import Optional
from pydantic import BaseModel
from app.services.intent_detection import detect_intent
from app.routers.nex.rag_agent.agent import run_rag_agent

router = APIRouter()


class IntentResult(BaseModel):
    text: str
    intent: str
    confidence: float


class VoiceMessageResponse(BaseModel):
    status: str
    transcription: str
    intent: IntentResult
    rag_answer: Optional[str] = None


def mock_transcribe_audio(file: UploadFile) -> str:
    """
    Dummy transcription function.
    In the future, this will call an actual speech-to-text API.
    """
    # Simply returning a dummy text regardless of the input file.
    return "what all health conditions do i have?"

@router.post("/voice-message", summary="Process NEX Voice Message", response_model=VoiceMessageResponse)
async def process_voice_message(
    file: Optional[UploadFile] = File(None),
    message: Optional[str] = Form(None)
):
    """
    Receives a voice message or direct text message, transcribes it 
    (or uses the provided text), and sends it to the intent detection module.
    """
    if message:
        # If the user sends a direct text message via Postman, use it!
        transcribed_text = message
    elif file:
        # 1. Transcribe the voice note (currently a dummy implementation)
        transcribed_text = mock_transcribe_audio(file)
    else:
        raise HTTPException(status_code=400, detail="Please provide either an audio 'file' or a text 'message'.")
    
    # 2. Pass the transcribed text to the intent detection module
    intent_result = detect_intent(transcribed_text)
    
    # 3. If intent needs additional data, query the RAG agent
    intent_name = intent_result.get("intent", "")
    rag_answer = None
    
    if intent_name in ["General Conversation", "Report Summary"]:
        rag_answer = run_rag_agent(transcribed_text)
    
    return VoiceMessageResponse(
        status="success",
        transcription=transcribed_text,
        intent=IntentResult(**intent_result),
        rag_answer=rag_answer
    )

