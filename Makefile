.PHONY: start stop restart logs

start:
	docker compose up --build -d

stop:
	docker compose down

restart: stop start

logs:
	docker compose logs -f
