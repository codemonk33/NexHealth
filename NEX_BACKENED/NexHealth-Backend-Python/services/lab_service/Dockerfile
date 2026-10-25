FROM python:3.11-slim

WORKDIR /workspace

COPY services/lab_service/requirements.txt /workspace/services/lab_service/requirements.txt
RUN pip install --no-cache-dir -r services/lab_service/requirements.txt

COPY libs /workspace/libs
COPY app /workspace/app
COPY services/lab_service /workspace/services/lab_service

EXPOSE 8003

CMD ["uvicorn", "services.lab_service.app.main:app", "--host", "0.0.0.0", "--port", "8003"]
