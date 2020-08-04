FROM confluentinc/cp-ksqldb-cli:5.5.1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip

WORKDIR /polkadot-profit-transformer
COPY transformer_queries.json .
COPY automation automation

WORKDIR /polkadot-profit-transformer/automation
RUN pip3 install -r requirements.txt

ENV DISPLAY=:99
ENV TEAMCITY_VERSION=1
ENV KSQL_CONFIG_DIR=/etc/ksqldb


ENTRYPOINT [ "./entrypoint.sh" ]