from __future__ import annotations

from datetime import datetime
from datetime import time as TimeOfDay
from uuid import UUID

from pydantic import BaseModel

from app.models.reminder import ReminderFrequency, ReminderPriority, ReminderStatus


# ─── Medication nested schema for reminder responses ────────────────────────
class MedicationSummary(BaseModel):
    """Summary of medication info nested in Reminder response."""
    model_config = {"from_attributes": True}
    
    id: UUID
    name: str
    dosage: str
    frequency: str


# ─── Reminder schemas ─────────────────────────────────────────────────────────
class ReminderCreate(BaseModel):
    medication_id: UUID
    time: TimeOfDay
    frequency: ReminderFrequency = ReminderFrequency.DAILY
    days_of_week: str | None = None
    priority: ReminderPriority = ReminderPriority.ROUTINE  # ← NEW (Phase 2)


class ReminderUpdate(BaseModel):
    time: TimeOfDay | None = None
    frequency: ReminderFrequency | None = None
    days_of_week: str | None = None
    is_active: bool | None = None
    priority: ReminderPriority | None = None  # ← NEW (Phase 2)


class ReminderOut(BaseModel):
    """Response schema for reminder (includes computed status and medication info)."""
    model_config = {"from_attributes": True}

    id: UUID
    medication_id: UUID
    medication: MedicationSummary  # ← NEW (Phase 2) - nested medication data
    time: TimeOfDay
    frequency: ReminderFrequency
    days_of_week: str | None
    priority: ReminderPriority  # ← NEW (Phase 2)
    is_active: bool
    # Computed status: UPCOMING, OVERDUE, DONE, MISSED (based on today's ReminderLog)
    status: str | None = None  # ← NEW (Phase 2) - computed server-side
    created_at: datetime
    updated_at: datetime


class ReminderLogCreate(BaseModel):
    scheduled_date: str  # ISO format: "2026-04-03"
    status: ReminderStatus


class ReminderLogOut(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    reminder_id: UUID
    scheduled_date: str
    status: ReminderStatus
    logged_at: str | None
