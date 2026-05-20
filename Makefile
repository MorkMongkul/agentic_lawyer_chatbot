# Makefile
.PHONY: backend frontend install

backend:
	cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

install-backend:
	cd backend && pip install -r requirements.txt

install-frontend:
	cd frontend && npm install

# Run both (requires 'concurrently' or two terminals)
dev:
	@echo "Run 'make backend' and 'make frontend' in separate terminals"