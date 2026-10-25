FROM python:3.11-slim

WORKDIR /workspace

COPY services/health_service/requirements.txt /workspace/services/health_service/requirements.txt
RUN pip install --no-cache-dir -r services/health_service/requirements.txt

COPY libs /workspace/libs
COPY app /workspace/app
COPY services/health_service /workspace/services/health_service

EXPOSE 8007

CMD ["uvicorn", "services.health_service.app.main:app", "--host", "0.0.0.0", "--port", "8007"]
