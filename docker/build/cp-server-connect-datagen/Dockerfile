FROM confluentinc/cp-kafka-connect:6.2.0
ENV CONNECT_PLUGIN_PATH="/usr/share/java,/usr/share/confluent-hub-components"
RUN confluent-hub install --no-prompt confluentinc/kafka-connect-jdbc:10.0.0 \
  && confluent-hub install --no-prompt jcustenborder/kafka-connect-transform-common:latest

