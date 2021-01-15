.DEFAULT_GOAL := docker-up

docker-up:
	./run.sh
docker-stop:
	docker-compose -f docker-compose.yml -f docker-compose.graphql.yml -f docker-compose.graphql.yml -f docker-compose.ksql.yml -f docker-compose.redash.yml stop
docker-rm:
	make docker-stop && docker-compose -f docker-compose.yml -f docker-compose.graphql.yml -f docker-compose.graphql.yml -f docker-compose.ksql.yml -f docker-compose.redash.yml rm -f