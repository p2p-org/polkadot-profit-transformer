.DEFAULT_GOAL := help
help:
	@echo "Commands:\n\tup - create and run\n\tps - show processes\n\tstop - stop all containers\n\tclean - stop and remove all containers, volumes and networks\n\trebuild streamer - rebuild streamer service\n\tredash.recreate - remove redash and reinit it"
up:
	./run.sh
ps:
	docker-compose -f docker-compose.yml -f docker-compose.redash.yml ps -a
stop:
	@echo "Stop all services"
	docker-compose -f docker-compose.yml -f docker-compose.redash.yml stop
start:
	@echo "Start all services"
	docker-compose -f docker-compose.yml -f docker-compose.redash.yml start
clean: down docker.removenetwork
	@echo "Purge all services and data"
down: redash.down
	docker-compose -f docker-compose.yml -f docker-compose.graphql.yml -f docker-compose.ksql.yml down -v
psql:
	docker-compose -f docker-compose.yml -f docker-compose.ksql.yml exec db psql -U sink -d raw
rebuild streamer:
	@echo "Rebuild streamer service"
	docker-compose -f docker-compose.yml -f docker-compose.ksql.yml up -d --force-recreate --build --no-deps streamer
redash.recreate: redash.down redash.init
	@echo "Purge old and start new redash instance"
redash.init: docker.createnetwork redash.up redash.createdatabase redash.createdashboard
redash.up: docker.createnetwork
	@echo "Start redash services"
	docker-compose -f docker-compose.redash.yml up -d redash-server redash-scheduler redash-scheduled-worker redash-adhoc-worker redash-postgres redis email
redash.createdatabase:
	@echo "Init redash database"
	docker-compose -f docker-compose.redash.yml run --rm redash-server create_db
redash.createdashboard:
	@echo "Init redash dashboard and queries"
	docker-compose -f docker-compose.redash.yml run --rm redash-init
redash.down:
	@echo "Remove redash/redis/db containers and volumes"
	docker-compose -f docker-compose.redash.yml down -v
docker.createnetwork:
	@echo "Create docker network"
	docker network create --attachable streamer_network || exit 0
docker.removenetwork:
	@echo "Remove docker network"
	docker network rm streamer_network