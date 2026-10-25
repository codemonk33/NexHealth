from uuid import UUID

from pydantic import BaseModel


class HealthPackageCreate(BaseModel):
    name: str
    description: str
    price: int


class HealthPackageOut(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    name: str
    description: str
    price: int
    is_active: bool

class PackageTestCreate(BaseModel):
    lab_test_ids: list[UUID]