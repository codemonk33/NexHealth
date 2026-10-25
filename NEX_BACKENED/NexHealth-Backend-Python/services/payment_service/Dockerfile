FROM python:3.11-slim

WORKDIR /workspace

COPY services/payment_service/requirements.txt /workspace/services/payment_service/requirements.txt
RUN pip install --no-cache-dir -r services/payment_service/requirements.txt

COPY libs /workspace/libs
COPY app /workspace/app
COPY services/payment_service /workspace/services/payment_service

EXPOSE 8004

CMD ["uvicorn", "services.payment_service.app.main:app", "--host", "0.0.0.0", "--port", "8004"]
