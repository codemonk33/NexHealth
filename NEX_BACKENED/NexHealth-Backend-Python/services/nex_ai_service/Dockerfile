FROM python:3.11-slim

WORKDIR /workspace

COPY services/nex_ai_service/requirements.txt /workspace/services/nex_ai_service/requirements.txt
RUN pip install --no-cache-dir -r services/nex_ai_service/requirements.txt

COPY libs /workspace/libs
COPY app /workspace/app
COPY services/nex_ai_service /workspace/services/nex_ai_service

EXPOSE 8008

CMD ["uvicorn", "services.nex_ai_service.app.main:app", "--host", "0.0.0.0", "--port", "8008"]
