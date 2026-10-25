"""Wearable device model for tracking connected health devices."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, ForeignKey, String, Boolean
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class WearableDevice(Base, TimestampMixin):
    """
    Represents a wearable health device (smartwatch, fitness tracker, etc.)
    that is connected to a user's account.
    """

    __tablename__ = "wearable_devices"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=False)
    
    # Device identification
    name = Column(String(255), nullable=False)  # e.g., "OnePlus Watch 2"
    type = Column(
        String(50),
        nullable=False,
        comment="Device type: APPLE_HEALTH, GOOGLE_HEALTH, FITBIT, SAMSUNG, GARMIN, OTHER"
    )
    
    # Connection status
    connected = Column(Boolean, default=False, nullable=False)
    last_sync = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", back_populates="wearable_devices")

    def __repr__(self) -> str:
        return f"<WearableDevice(id={self.id}, user_id={self.user_id}, name={self.name}, type={self.type}, connected={self.connected})>"
