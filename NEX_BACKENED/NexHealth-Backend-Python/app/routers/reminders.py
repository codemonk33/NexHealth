from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_patient_profile, require_patient
from app.models.medication import Medication
from app.models.patient import Patient
from app.models.reminder import Reminder, ReminderLog, ReminderStatus
from app.models.user import User
from app.schemas.reminder import (
    MedicationSummary,
    ReminderCreate,
    ReminderLogCreate,
    ReminderLogOut,
    ReminderOut,
    ReminderUpdate,
)

router = APIRouter()


def _get_reminder(reminder_id: UUID, patient: Patient, db: Session) -> Reminder:
    reminder = (
        db.query(Reminder)
        .join(Medication, Medication.id == Reminder.medication_id)
        .filter(Reminder.id == reminder_id, Medication.patient_id == patient.id)
        .first()
    )
    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found"
        )
    return reminder


def _compute_reminder_status(reminder: Reminder, db: Session) -> str:
    """
    Compute reminder status based on today's ReminderLog.
    
    Returns:
      - "DONE": reminder was taken today
      - "MISSED": reminder time passed but not marked as taken
      - "UPCOMING": reminder time hasn't passed yet
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Check if there's a log for today
    today_log = (
        db.query(ReminderLog)
        .filter(
            ReminderLog.reminder_id == reminder.id,
            ReminderLog.scheduled_date == today,
        )
        .first()
    )
    
    if today_log:
        # Map backend status to frontend status
        if today_log.status == ReminderStatus.TAKEN:
            return "DONE"
        elif today_log.status == ReminderStatus.MISSED:
            return "MISSED"
        else:  # SKIPPED
            return "SKIPPED"
    
    # No log for today, check if reminder time has passed
    current_time = datetime.now(timezone.utc).time()
    if current_time >= reminder.time:
        return "OVERDUE"  # Time passed but not logged
    
    return "UPCOMING"


def _reminder_to_out(reminder: Reminder, db: Session) -> ReminderOut:
    """Convert Reminder ORM model to ReminderOut schema with computed fields."""
    # Get medication info
    medication = reminder.medication
    medication_summary = MedicationSummary(
        id=medication.id,
        name=medication.name,
        dosage=medication.dosage,
        frequency=medication.frequency.value if hasattr(medication.frequency, 'value') else str(medication.frequency),
    )
    
    # Compute status
    status = _compute_reminder_status(reminder, db)
    
    return ReminderOut(
        id=reminder.id,
        medication_id=reminder.medication_id,
        medication=medication_summary,
        time=reminder.time,
        frequency=reminder.frequency,
        days_of_week=reminder.days_of_week,
        priority=reminder.priority,
        is_active=reminder.is_active,
        status=status,
        created_at=reminder.created_at,
        updated_at=reminder.updated_at,
    )


@router.get("", response_model=list[ReminderOut])
def list_reminders(
    medication_id: UUID | None = None,
    patient: Patient = Depends(get_patient_profile),
    db: Session = Depends(get_db),
):
    """List reminders for the authenticated patient."""
    q = (
        db.query(Reminder)
        .join(Medication, Medication.id == Reminder.medication_id)
        .filter(Medication.patient_id == patient.id)
    )
    if medication_id:
        q = q.filter(Reminder.medication_id == medication_id)
    
    reminders = q.all()
    return [_reminder_to_out(reminder, db) for reminder in reminders]


@router.post("", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
def create_reminder(
    payload: ReminderCreate,
    current_user: User = Depends(require_patient),
    patient: Patient = Depends(get_patient_profile),
    db: Session = Depends(get_db),
):
    """Create a new reminder for a medication."""
    med = (
        db.query(Medication)
        .filter(
            Medication.id == payload.medication_id,
            Medication.patient_id == patient.id,
        )
        .first()
    )
    if not med:
        raise HTTPException(status_code=400, detail="Medication not found")

    reminder = Reminder(**payload.model_dump())
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return _reminder_to_out(reminder, db)


@router.put("/{reminder_id}", response_model=ReminderOut)
def update_reminder(
    reminder_id: UUID,
    payload: ReminderUpdate,
    current_user: User = Depends(require_patient),
    patient: Patient = Depends(get_patient_profile),
    db: Session = Depends(get_db),
):
    """Update a reminder."""
    reminder = _get_reminder(reminder_id, patient, db)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(reminder, field, value)
    db.commit()
    db.refresh(reminder)
    return _reminder_to_out(reminder, db)


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(
    reminder_id: UUID,
    current_user: User = Depends(require_patient),
    patient: Patient = Depends(get_patient_profile),
    db: Session = Depends(get_db),
):
    """Delete a reminder."""
    reminder = _get_reminder(reminder_id, patient, db)
    db.delete(reminder)
    db.commit()


@router.post(
    "/{reminder_id}/log",
    response_model=ReminderLogOut,
    status_code=status.HTTP_201_CREATED,
)
def log_reminder(
    reminder_id: UUID,
    payload: ReminderLogCreate,
    current_user: User = Depends(require_patient),
    patient: Patient = Depends(get_patient_profile),
    db: Session = Depends(get_db),
):
    """Log a reminder completion (taken, missed, skipped)."""
    reminder = _get_reminder(reminder_id, patient, db)
    entry = ReminderLog(
        reminder_id=reminder.id,
        scheduled_date=payload.scheduled_date,
        status=payload.status,
        logged_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/{reminder_id}/logs", response_model=list[ReminderLogOut])
def get_reminder_logs(
    reminder_id: UUID,
    patient: Patient = Depends(get_patient_profile),
    db: Session = Depends(get_db),
):
    """Get all logs for a specific reminder."""
    reminder = _get_reminder(reminder_id, patient, db)
    return db.query(ReminderLog).filter(ReminderLog.reminder_id == reminder.id).all()
