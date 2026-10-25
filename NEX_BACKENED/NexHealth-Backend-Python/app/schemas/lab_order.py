from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.lab_order import CollectionType, OrderStatus


class LabOrderCreate(BaseModel):
    lab_test_id: UUID
    collection_type: CollectionType = CollectionType.LAB
    scheduled_date: datetime | None = None
    collection_address: str | None = None
    notes: str | None = None
    family_member_id: UUID | None = None


class LabOrderStatusUpdate(BaseModel):
    status: OrderStatus
    report_url: str | None = None
    report_generated_at: datetime | None = None


class LabOrderOut(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID

    patient_id: UUID
    family_member_id: UUID | None
    lab_test_id: UUID
    status: OrderStatus
    collection_type: CollectionType
    slot_id: UUID | None = None
    collector_name: str | None = None
    collector_phone: str | None = None
    scheduled_date: datetime | None
    collection_address: str | None
    sample_collected_at: datetime | None
    processing_started_at: datetime | None
    report_url: str | None
    report_generated_at: datetime | None
    completed_at: datetime | None

    notes: str | None
    created_at: datetime
    updated_at: datetime

class HomeCollectionUpdate(BaseModel):
    collector_name: str | None = None
    collector_phone: str | None = None
    status: OrderStatus