FROM python:3.11-slim

WORKDIR /workspace

COPY services/auth_service/requirements.txt /workspace/services/auth_service/requirements.txt
RUN pip install --no-cache-dir -r services/auth_service/requirements.txt

COPY libs /workspace/libs
COPY app /workspace/app
COPY services/auth_service /workspace/services/auth_service

EXPOSE 8001

CMD ["uvicorn", "services.auth_service.app.main:app", "--host", "0.0.0.0", "--port", "8001"]
