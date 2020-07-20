FROM confluentinc/ksqldb-cli:0.10.1


#RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
#    sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list' && \
#    apt -y update && \
#    apt install -y google-chrome-stable

USER root
RUN yum install python3-pip
RUN pip3 install pytest
RUN pip3 install colorlog
USER appuser
# upgrade pip and install selenium
#RUN pip install --upgrade pip && \
#    pip install selenium \
#    webdriver_manager \
#    pytest \
#    colorlog \
#    teamcity-messages

#WORKDIR /autotests
WORKDIR /polkadot-profit-transformer
ENV DISPLAY=:99
#ENV RUNNING_ENVIRONMENT=docker
#ENV TEAMCITY_VERSION=1
ENV KSQL_CONFIG_DIR=/etc/ksqldb

COPY . .

#CMD [ "/bin/sh", "-c", "python tester.py" ]
#CMD ['python','tester.py']
#ENTRYPOINT [ "./entrypoint.sh" ]
# ENV PATH='./project/automation/suites/rewardLimit.py'
# CMD [ 'python','-u','-m pytest -v ./automation/suites/rewardLimit.py' ]
# CMD [ "/bin/sh", "-c", "python -m pytest -v ./automation/suites/.py 2>&1" ]
