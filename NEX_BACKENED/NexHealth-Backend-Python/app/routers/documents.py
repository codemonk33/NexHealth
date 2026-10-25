"""
Document upload and management router.

Supports:
- Document upload with categories and source app tracking
- Batch file uploads for share scenarios
- Document download and deletion
- Share token generation
- Share upload with temporary tokens
"""

from __future__ import annotations

import json
import os
import shutil
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.dependencies import get_current_user, require_patient
from app.models.document import Document
from app.models.share_token import ShareToken
from app.models.user import User
from app.schemas.document import DocumentOut, ShareTokenOut
from app.services.audit_service import log_event

router = APIRouter()
settings = get_settings()

# Ensure uploads directory exists
Path(settings.UPLOADS_DIR).mkdir(parents=True, exist_ok=True)

# Allowed file types for document upload
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
    "text/csv",
    "application/vnd.ms-excel",
}

# Rejected file types (executable, script, etc.)
REJECTED_CONTENT_TYPES = {
    "application/x-msdownload",
    "application/x-msdos-program",
    "application/x-executable",
    "application/x-elf",
    "application/x-sharedlib",
}


def _validate_file_upload(file: UploadFile, content_type: str, file_size: int) -> None:
    """Validate file for security before upload."""
    # Check content type
    if content_type in REJECTED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed: {file.content_type}",
        )
    
    # Check file size
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty files not allowed",
        )
    
    if file_size > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large (max {settings.MAX_UPLOAD_SIZE_BYTES / 1024 / 1024:.0f}MB)",
        )


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(default=""),
    category: str = Form(default="other"),
    source_app: str = Form(default="direct_upload"),
    current_user: User = Depends(require_patient),
    db: Session = Depends(get_db),
):
    """Upload a document with optional category and source app tracking."""
    try:
        # Read file content
        file_content = await file.read()
        file_size = len(file_content)
        
        # Validate file
        _validate_file_upload(file, file.content_type or "application/octet-stream", file_size)
        
        # Save file with UUID as filename
        file_id = str(uuid4())
        file_path = Path(settings.UPLOADS_DIR) / file_id
        file_path.write_bytes(file_content)
        
        # Create document record
        document = Document(
            owner_user_id=current_user.id,
            file_path=str(file_path),
            original_filename=file.filename or "document",
            size_bytes=file_size,
            content_type=file.content_type or "application/octet-stream",
            title=title,
            description=description,
            category=category or "other",
            source_app=source_app or "direct_upload",
            is_shared_upload=False,
        )
        db.add(document)
        db.commit()
        db.refresh(document)
        
        ip = request.client.host if request.client else None
        log_event(
            db,
            "UPLOAD_DOCUMENT",
            "Document",
            str(document.id),
            current_user.id,
            ip_address=ip,
        )
        
        return document
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}",
        )


@router.get("", response_model=list[DocumentOut])
def list_documents(
    current_user: User = Depends(require_patient),
    db: Session = Depends(get_db),
):
    """List all documents for current user."""
    documents = (
        db.query(Document)
        .filter(Document.owner_user_id == current_user.id)
        .order_by(Document.created_at.desc())
        .all()
    )
    return documents


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: UUID,
    request: Request,
    current_user: User = Depends(require_patient),
    db: Session = Depends(get_db),
):
    """Get document metadata."""
    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.owner_user_id == current_user.id)
        .first()
    )
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )
    
    ip = request.client.host if request.client else None
    log_event(
        db,
        "VIEW_DOCUMENT",
        "Document",
        str(document.id),
        current_user.id,
        ip_address=ip,
    )
    
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: UUID,
    request: Request,
    current_user: User = Depends(require_patient),
    db: Session = Depends(get_db),
):
    """Delete a document."""
    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.owner_user_id == current_user.id)
        .first()
    )
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )
    
    # Delete file
    if document.file_path:
        file_path = Path(document.file_path)
        if file_path.exists():
            file_path.unlink()
    
    # Delete record
    db.delete(document)
    db.commit()
    
    ip = request.client.host if request.client else None
    log_event(
        db,
        "DELETE_DOCUMENT",
        "Document",
        str(document.id),
        current_user.id,
        ip_address=ip,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Share Token Management
# ─────────────────────────────────────────────────────────────────────────────


@router.post("/share/create-token", response_model=ShareTokenOut, status_code=status.HTTP_201_CREATED)
def create_share_token(
    request: Request,
    current_user: User = Depends(require_patient),
    db: Session = Depends(get_db),
):
    """Create a single-use share token for document uploads."""
    # Generate token
    token = str(uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.SHARE_TOKEN_EXPIRE_MINUTES
    )
    
    share_token = ShareToken(
        token=token,
        user_id=current_user.id,
        expires_at=expires_at,
        is_used=False,
    )
    db.add(share_token)
    db.commit()
    db.refresh(share_token)
    
    ip = request.client.host if request.client else None
    log_event(
        db,
        "CREATE_SHARE_TOKEN",
        "ShareToken",
        str(share_token.id),
        current_user.id,
        ip_address=ip,
    )
    
    return share_token


@router.post("/share/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def share_upload(
    request: Request,
    token: str = Form(...),
    file: UploadFile = File(...),
    title: str = Form(default=""),
    category: str = Form(default="other"),
    source_app: str = Form(default="share_upload"),
    db: Session = Depends(get_db),
):
    """Upload documents using a share token."""
    # Validate token
    share_token = (
        db.query(ShareToken)
        .filter(ShareToken.token == token)
        .first()
    )
    
    if not share_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid share token",
        )
    
    if share_token.is_used:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Share token has already been used",
        )
    
    if share_token.is_expired:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Share token has expired",
        )
    
    try:
        # Read file content
        file_content = await file.read()
        file_size = len(file_content)
        
        # Validate file
        _validate_file_upload(file, file.content_type or "application/octet-stream", file_size)
        
        # Save file with UUID as filename
        file_id = str(uuid4())
        file_path = Path(settings.UPLOADS_DIR) / file_id
        file_path.write_bytes(file_content)
        
        # Create document record
        document = Document(
            owner_user_id=share_token.user_id,
            file_path=str(file_path),
            original_filename=file.filename or "document",
            size_bytes=file_size,
            content_type=file.content_type or "application/octet-stream",
            title=title or file.filename or "Shared Document",
            description="Uploaded via share link",
            category=category or "other",
            source_app=source_app or "share_upload",
            is_shared_upload=True,
        )
        db.add(document)
        
        # Mark token as used
        share_token.is_used = True
        
        db.commit()
        db.refresh(document)
        
        return document
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Share upload failed: {str(e)}",
        )
