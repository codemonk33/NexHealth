from sqlalchemy import MetaData, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from libs.common.config import get_settings

settings = get_settings()

# All tables reside within the 'bionex' PostgreSQL schema
SCHEMA = "bionex"

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base(metadata=MetaData(schema=SCHEMA))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
