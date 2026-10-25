FROM python:3.11-slim

WORKDIR /workspace

COPY services/crypto_service/requirements.txt /workspace/services/crypto_service/requirements.txt
RUN pip install --no-cache-dir -r services/crypto_service/requirements.txt

COPY libs /workspace/libs
COPY app /workspace/app
COPY services/crypto_service /workspace/services/crypto_service

EXPOSE 8005

CMD ["uvicorn", "services.crypto_service.app.main:app", "--host", "0.0.0.0", "--port", "8005"]
