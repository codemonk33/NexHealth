import uuid

from sqlalchemy import Boolean, Column, Date, Integer, Time
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base
from app.models.base import TimestampMixin


class AppointmentSlot(Base, TimestampMixin):
    __tablename__ = "appointment_slots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    slot_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)

    capacity = Column(Integer, nullable=False, default=10)
    booked_count = Column(Integer, nullable=False, default=0)

    is_active = Column(Boolean, nullable=False, default=True)