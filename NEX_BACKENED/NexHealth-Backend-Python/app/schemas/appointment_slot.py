from datetime import date, time
from uuid import UUID

from pydantic import BaseModel


class AppointmentSlotCreate(BaseModel):
    slot_date: date
    start_time: time
    end_time: time
    capacity: int = 10


class AppointmentSlotUpdate(BaseModel):
    slot_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    capacity: int | None = None
    is_active: bool | None = None


class AppointmentSlotOut(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    slot_date: date
    start_time: time
    end_time: time
    capacity: int
    booked_count: int
    is_active: bool