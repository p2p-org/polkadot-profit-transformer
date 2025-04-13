FROM postgres:13
COPY *.sql /docker-entrypoint-initdb.d/
CMD ["postgres", "-c", "max_connection=500"]
