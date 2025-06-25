# Use the official Playwright image which comes with browsers and dependencies pre-installed.
# Using a specific version for reproducibility.
FROM mcr.microsoft.com/playwright/python:v1.44.0-jammy

# Set the working directory in the container
WORKDIR /app

# Copy the dependencies file to the working directory
COPY ./python_service/requirements.txt .

# Install Python packages
# The --system flag is important when using the official Playwright image
# to avoid conflicts with the pre-installed virtual environment.
RUN pip install --no-cache-dir -r requirements.txt

# The Playwright browsers are already included in the base image, so no need to run `playwright install`

# Copy the rest of the application's code to the working directory
COPY ./python_service/ .

# Expose the port the app runs on
EXPOSE 10000

# The command to run the application
CMD ["uvicorn", "crawl4ai_service:app", "--host", "0.0.0.0", "--port", "10000"]
