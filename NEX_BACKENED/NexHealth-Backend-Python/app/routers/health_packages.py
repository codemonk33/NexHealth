from fastapi import APIRouter
from fastapi import Depends
from sqlalchemy.orm import Session
from app.routers import health_packages
from fastapi import HTTPException
from uuid import UUID
from app.models.package_test import PackageTest


from app.database import get_db
from app.dependencies import require_admin
from app.models.health_package import HealthPackage
from app.models.user import User
from app.schemas.health_package import (
    HealthPackageCreate,
    HealthPackageOut,
    PackageTestCreate,
)
from app.routers import health_packages


router = APIRouter()

@router.post("", response_model=HealthPackageOut)
def create_package(
    payload: HealthPackageCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    package = HealthPackage(
        **payload.model_dump()
    )

    db.add(package)
    db.commit()
    db.refresh(package)

    return package

@router.get("", response_model=list[HealthPackageOut])
def list_packages(
    db: Session = Depends(get_db),
):
    return (
        db.query(HealthPackage)
        .filter(HealthPackage.is_active == True)
        .all()
    )

@router.get("/{package_id}", response_model=HealthPackageOut)
def get_package(
    package_id: UUID,
    db: Session = Depends(get_db),
):
    package = (
        db.query(HealthPackage)
        .filter(HealthPackage.id == package_id)
        .first()
    )

    if not package:
        raise HTTPException(
            status_code=404,
            detail="Package not found"
        )

    return package

@router.put("/{package_id}", response_model=HealthPackageOut)
def update_package(
    package_id: UUID,
    payload: HealthPackageCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    package = (
        db.query(HealthPackage)
        .filter(HealthPackage.id == package_id)
        .first()
    )

    if not package:
        raise HTTPException(
            status_code=404,
            detail="Package not found"
        )

    package.name = payload.name
    package.description = payload.description
    package.price = payload.price

    db.commit()
    db.refresh(package)

    return package

@router.delete("/{package_id}")
def delete_package(
    package_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    package = (
        db.query(HealthPackage)
        .filter(HealthPackage.id == package_id)
        .first()
    )

    if not package:
        raise HTTPException(
            status_code=404,
            detail="Package not found"
        )

    package.is_active = False

    db.commit()

    return {
        "message": "Package deactivated successfully"
    }

@router.post("/{package_id}/tests")
def add_tests_to_package(
    package_id: UUID,
    payload: PackageTestCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    package = (
        db.query(HealthPackage)
        .filter(HealthPackage.id == package_id)
        .first()
    )

    if not package:
        raise HTTPException(
            status_code=404,
            detail="Package not found",
        )

    for test_id in payload.lab_test_ids:
        package_test = PackageTest(
            package_id=package_id,
            lab_test_id=test_id,
        )

        db.add(package_test)

    db.commit()

    return {
        "message": "Tests added successfully"
    }