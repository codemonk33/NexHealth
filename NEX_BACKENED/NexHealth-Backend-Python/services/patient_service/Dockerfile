FROM python:3.11-slim

WORKDIR /workspace

COPY services/patient_service/requirements.txt /workspace/services/patient_service/requirements.txt
RUN pip install --no-cache-dir -r services/patient_service/requirements.txt

COPY libs /workspace/libs
COPY app /workspace/app
COPY services/patient_service /workspace/services/patient_service

EXPOSE 8002

CMD ["uvicorn", "services.patient_service.app.main:app", "--host", "0.0.0.0", "--port", "8002"]
