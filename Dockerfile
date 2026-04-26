FROM python:3.10-slim

WORKDIR /app

# Install backend dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY backend /app/backend

# Copy the built frontend
COPY frontend/dist /app/frontend/dist

# Set working directory to backend so relative imports work
WORKDIR /app/backend

# Expose port (Cloud Run sets PORT env var)
EXPOSE 8080

# Command to run
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
