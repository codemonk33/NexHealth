FROM python:3.11-slim

WORKDIR /workspace

COPY services/sharing_service/requirements.txt /workspace/services/sharing_service/requirements.txt
RUN pip install --no-cache-dir -r services/sharing_service/requirements.txt

COPY libs /workspace/libs
COPY app /workspace/app
COPY services/sharing_service /workspace/services/sharing_service

EXPOSE 8006

CMD ["uvicorn", "services.sharing_service.app.main:app", "--host", "0.0.0.0", "--port", "8006"]
