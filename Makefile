.DEFAULT_GOAL := help
help:
	@echo "Commands:\n\tup - create and run\n\tps - show processes\n\tstop - stop all containers\n\trm - remove force all containers"
up:
	./run.sh
ps:
	docker-compose -f docker-compose.yml -f docker-compose.graphql.yml -f docker-compose.graphql.yml -f docker-compose.ksql.yml -f docker-compose.redash.yml ps
stop:
	docker-compose -f docker-compose.yml -f docker-compose.graphql.yml -f docker-compose.graphql.yml -f docker-compose.ksql.yml -f docker-compose.redash.yml stop
rm:
	make stop && docker-compose -f docker-compose.yml -f docker-compose.graphql.yml -f docker-compose.graphql.yml -f docker-compose.ksql.yml -f docker-compose.redash.yml rm -f
psql:
	docker-compose -f docker-compose.yml -f docker-compose.ksql.yml exec db psql -U sink -d raw