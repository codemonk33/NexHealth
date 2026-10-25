FROM python:3.11-slim

WORKDIR /workspace

COPY gateway/requirements.txt /workspace/gateway/requirements.txt
RUN pip install --no-cache-dir -r gateway/requirements.txt

COPY libs /workspace/libs
COPY gateway /workspace/gateway
COPY alembic /workspace/alembic
COPY alembic.ini /workspace/alembic.ini

EXPOSE 8000

CMD ["uvicorn", "gateway.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
