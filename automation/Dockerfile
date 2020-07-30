FROM confluentinc/cp-ksqldb-cli:5.5.1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip

WORKDIR /polkadot-profit-transformer/automation
COPY requirements.txt .
RUN pip3 install -r requirements.txt


ENV DISPLAY=:99
ENV TEAMCITY_VERSION=1
ENV KSQL_CONFIG_DIR=/etc/ksqldb

COPY  . .

ENTRYPOINT [ "./entrypoint.sh" ]