import uuid

from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class PackageTest(Base):
    __tablename__ = "package_tests"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    package_id = Column(
        UUID(as_uuid=True),
        ForeignKey("health_packages.id"),
        nullable=False,
    )

    lab_test_id = Column(
        UUID(as_uuid=True),
        ForeignKey("lab_tests.id"),
        nullable=False,
    )

    # Relationships
    health_package = relationship("HealthPackage", back_populates="package_tests")
    lab_test = relationship("LabTest")