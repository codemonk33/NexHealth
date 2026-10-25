"""Pydantic schemas for wearable device management (Phase 2)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class WearableDeviceCreate(BaseModel):
    """Request schema for creating a new wearable device connection."""
    name: str = Field(..., min_length=1, max_length=255, description="Device name (e.g., 'OnePlus Watch 2')")
    type: str = Field(
        ...,
        description="Device type: APPLE_HEALTH, GOOGLE_HEALTH, FITBIT, SAMSUNG, GARMIN, OTHER"
    )


class WearableDeviceUpdate(BaseModel):
    """Request schema for updating a wearable device."""
    name: str | None = Field(None, min_length=1, max_length=255)
    connected: bool | None = Field(None, description="Connection status")
    last_sync: datetime | None = Field(None, description="Last sync timestamp")


class WearableDeviceOut(BaseModel):
    """Response schema for wearable device."""
    model_config = {"from_attributes": True}

    id: UUID
    user_id: UUID
    name: str
    type: str
    connected: bool
    last_sync: datetime | None = None
    created_at: datetime
    updated_at: datetime
