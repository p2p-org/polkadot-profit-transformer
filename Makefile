.DEFAULT_GOAL := help
help:
	@echo "Commands:\n\tup - create and run\n\tps - show processes\n\tstop - stop all containers\n\tclean - stop and remove all containers, volumes and networks\n\trebuild streamer - rebuild streamer service\n\tredash.recreate - remove redash and reinit it"
up:
	./run.sh
ps:
	docker-compose -f docker-compose.yml -f docker-compose.graphql.yml -f docker-compose.graphql.yml -f docker-compose.ksql.yml -f docker-compose.redash.yml ps -a
stop:
	docker-compose -f docker-compose.yml -f docker-compose.graphql.yml -f docker-compose.graphql.yml -f docker-compose.ksql.yml -f docker-compose.redash.yml stop
clean: down docker.removenetwork
down: redash.down
	docker-compose -f docker-compose.yml -f docker-compose.graphql.yml -f docker-compose.graphql.yml -f docker-compose.ksql.yml down -v
psql:
	docker-compose -f docker-compose.yml -f docker-compose.ksql.yml exec db psql -U sink -d raw
rebuild streamer:
	docker-compose -f docker-compose.yml -f docker-compose.ksql.yml up -d --force-recreate --build --no-deps streamer
redash.recreate: redash.down redash.init
redash.init: docker.createnetwork redash.up redash.createdatabase redash.createdashboard
redash.up:
	docker-compose -f docker-compose.redash.yml up --remove-orphans -d redash-server redash-scheduler redash-scheduled-worker redash-adhoc-worker postgres redis email
redash.createdatabase:
	docker-compose -f docker-compose.redash.yml run --rm redash-server create_db
redash.createdashboard:
	docker-compose -f docker-compose.redash.yml run --rm redash-init
redash.down:
	docker-compose -f docker-compose.redash.yml down -v
docker.createnetwork:
	docker network create streamer_network || exit 0
docker.removenetwork:
	docker network rm streamer_network