up:
	./run.sh
ps:
	docker-compose -f docker-compose.yml ps -a
stop:
	@echo "Stop all services"
	docker-compose -f docker-compose.yml stop
start:
	@echo "Start all services"
	docker-compose -f docker-compose.yml start
clean: down docker.removenetwork
	@echo "Purge all services and data"
down: 
	docker-compose -f docker-compose.yml down -v
rebuild streamer:
	@echo "Rebuild streamer service"
	docker-compose -f docker-compose.yml up -d --force-recreate --build --no-deps streamer
docker.createnetwork:
	@echo "Create docker network"
	docker network create --attachable streamer_network || exit 0
docker.removenetwork:
	@echo "Remove docker network"
	docker network rm streamer_network
