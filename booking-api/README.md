# Inventory & Sales Ledger — Backend API

Quarkus 3 + MongoDB backend for tracking inventory purchases and sales.

## Prerequisites

- Java 21 (via SDKMAN: `sdk use java 21.0.9-jbr`)
- Docker (for MongoDB)

## Quick Start

```bash
# 1. Start MongoDB (make sure Docker Desktop is running)
docker run -d --name booking-mongo -p 27017:27017 mongo:7

# 2. Run the backend in dev mode
./mvnw quarkus:dev
```

Backend runs at http://localhost:8080. Dev UI at http://localhost:8080/q/dev/.

## Run Tests

```bash
./mvnw test
```

Tests use an embedded test MongoDB — no Docker needed. Stop any local MongoDB first (`docker stop booking-mongo`) to free port 27017.

## Run Frontend

```bash
cd ../booking-ui
npm install
npm run dev
```

Frontend runs at http://localhost:5173.

## Full Stack via Docker Compose

```bash
docker compose up
```

This starts MongoDB, the backend, the frontend, Mongo Express (http://localhost:8081), and Mailhog.

## API Endpoints

### Items
- `POST /api/v1/items` — Add inventory item
- `GET /api/v1/items?businessId=X&status=AVAILABLE` — List items
- `GET /api/v1/items/{id}?businessId=X` — Get item
- `PATCH /api/v1/items/{id}` — Update item
- `DELETE /api/v1/items/{id}?businessId=X` — Soft-delete item

### Sales
- `POST /api/v1/sales` — Record a sale
- `GET /api/v1/sales?businessId=X` — List sales
- `GET /api/v1/sales/{id}?businessId=X` — Get sale

### Analytics
- `GET /api/v1/analytics?businessId=X&from=YYYY-MM-DD&to=YYYY-MM-DD` — Summary, by-platform, by-category, by-month breakdowns
