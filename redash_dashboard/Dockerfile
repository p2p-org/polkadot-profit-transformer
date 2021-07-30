FROM python:3.9
COPY . /app
WORKDIR /app
RUN pip3 install requests python-dotenv redash-api-client
CMD [ "/usr/bin/env", "python3", "/app/dashboard.py" ]