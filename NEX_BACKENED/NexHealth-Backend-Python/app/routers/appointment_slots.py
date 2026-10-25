from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.appointment_slot import AppointmentSlot
from app.models.user import User

from app.schemas.appointment_slot import (
    AppointmentSlotCreate,
    AppointmentSlotOut,
)

router = APIRouter()


@router.post("", response_model=AppointmentSlotOut)
def create_slot(
    payload: AppointmentSlotCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    slot = AppointmentSlot(**payload.model_dump())

    db.add(slot)
    db.commit()
    db.refresh(slot)

    return slot