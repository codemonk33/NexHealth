import uuid

from sqlalchemy import Boolean, Column, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin


class HealthPackage(Base, TimestampMixin):
    __tablename__ = "health_packages"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    name = Column(String(255), nullable=False, unique=True)

    description = Column(Text)

    price = Column(Integer, nullable=False)

    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
    )

    # Relationships
    package_tests = relationship("PackageTest", back_populates="health_package", cascade="all, delete-orphan")