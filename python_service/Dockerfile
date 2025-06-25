# Use an official Python runtime as a parent image
# Using -slim variant to keep the image size down
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Install nodejs and npm to use npx, which is the recommended way
# to install playwright system dependencies.
# Then, clean up apt cache to keep image small.
RUN apt-get update && \
    apt-get install -y nodejs npm && \
    npx --yes playwright install-deps && \
    apt-get purge -y --auto-remove nodejs npm && \
    rm -rf /var/lib/apt/lists/*

# Copy the dependencies file to the working directory
COPY ./python_service/requirements.txt .

# Install Python packages
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (without system deps, as they are already installed)
RUN playwright install

# Copy the rest of the application's code to the working directory
COPY ./python_service/ .

# Expose the port the app runs on
EXPOSE 10000

# The command to run the application
CMD ["uvicorn", "crawl4ai_service:app", "--host", "0.0.0.0", "--port", "10000"]
