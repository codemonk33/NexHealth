"""Wearable device management endpoints (Phase 2 — Health Data Integration)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_patient
from app.models.user import User, UserRole
from app.models.wearable_device import WearableDevice
from app.schemas.wearable import (
    WearableDeviceCreate,
    WearableDeviceOut,
    WearableDeviceUpdate,
)

router = APIRouter()


def _authorize_user_access(user_id: UUID, current_user: User) -> None:
    """
    Check if current user can access another user's wearables.
    Only the user themselves or an administrator can.
    """
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot access wearable devices for another user",
        )


@router.get("/{user_id}", response_model=list[WearableDeviceOut])
def list_wearables(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all wearable devices connected to a user's account."""
    _authorize_user_access(user_id, current_user)

    devices = (
        db.query(WearableDevice)
        .filter(WearableDevice.user_id == user_id)
        .all()
    )
    return devices


@router.post(
    "/{user_id}", response_model=WearableDeviceOut, status_code=status.HTTP_201_CREATED
)
def create_wearable(
    user_id: UUID,
    payload: WearableDeviceCreate,
    current_user: User = Depends(require_patient),
    db: Session = Depends(get_db),
):
    """Connect a new wearable device to a user's account."""
    _authorize_user_access(user_id, current_user)

    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    device = WearableDevice(
        user_id=user_id,
        name=payload.name,
        type=payload.type,
        connected=True,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


@router.put(
    "/{user_id}/{device_id}", response_model=WearableDeviceOut
)
def update_wearable(
    user_id: UUID,
    device_id: UUID,
    payload: WearableDeviceUpdate,
    current_user: User = Depends(require_patient),
    db: Session = Depends(get_db),
):
    """Update a wearable device (e.g., sync status, connection status)."""
    _authorize_user_access(user_id, current_user)

    device = (
        db.query(WearableDevice)
        .filter(
            WearableDevice.id == device_id,
            WearableDevice.user_id == user_id,
        )
        .first()
    )
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wearable device not found",
        )

    # Update fields
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(device, field, value)

    db.commit()
    db.refresh(device)
    return device


@router.delete(
    "/{user_id}/{device_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_wearable(
    user_id: UUID,
    device_id: UUID,
    current_user: User = Depends(require_patient),
    db: Session = Depends(get_db),
):
    """Disconnect/remove a wearable device from a user's account."""
    _authorize_user_access(user_id, current_user)

    device = (
        db.query(WearableDevice)
        .filter(
            WearableDevice.id == device_id,
            WearableDevice.user_id == user_id,
        )
        .first()
    )
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wearable device not found",
        )

    db.delete(device)
    db.commit()
