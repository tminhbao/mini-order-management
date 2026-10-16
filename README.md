
# Mini Order Management

A REST API for managing products and orders, built with NestJS, PostgreSQL, TypeORM, BullMQ, and Redis.

## Features

### Products

- Create, retrieve, update, and soft-delete products.
- Unique SKU and non-negative stock validation.
- Search by product name.
- Filter by minimum and maximum price.
- Pagination with `page` and `limit`.

### Orders

- Create orders with customer information and multiple items.
- Validate product availability and reserve stock in a database transaction.
- Store each item's purchase-time unit price.
- List orders with pagination and status filtering.
- Retrieve order details and processing job status.
- Cancel eligible orders and restore reserved stock.

### Background processing

- Process orders asynchronously using BullMQ and Redis.
- Simulate a 3–5 second processing time and approximately 30% random failures.
- Retry failed jobs up to 3 attempts with exponential backoff.
- Change successful orders to `CONFIRMED` and record a notification log.
- Mark permanently failed orders as `FAILED` and restore stock.
- Schedule a delayed cancellation job for each order; pending orders are cancelled after 30 minutes and their stock is restored.

## Tech Stack

- Node.js and TypeScript
- NestJS
- PostgreSQL
- TypeORM migrations
- BullMQ and Redis
- Swagger / OpenAPI
- Docker Compose

## Prerequisites

- Node.js compatible with the project dependencies
- npm
- Docker Desktop with Docker Compose

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env`.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

On macOS/Linux:

```bash
cp .env.example .env
```

Adjust the values if your local setup uses different ports or credentials.

### 3. Start PostgreSQL and Redis

```bash
docker compose up -d
```

Check service status:

```bash
docker compose ps
```

Wait until PostgreSQL and Redis are healthy.

### 4. Run database migrations

```bash
npm run migration:run
```

The application uses `synchronize: false`; database schema changes are managed through migrations.

### 5. Start the API

Development mode:

```bash
npm run start:dev
```

The API listens on the port configured by `PORT` (default: `3000`).

Swagger documentation:

<http://localhost:3000/api/docs>

## API Overview

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/products` | Create a product |
| GET | `/products` | Search and list products |
| GET | `/products/:id` | Get a product |
| PATCH | `/products/:id` | Update a product |
| DELETE | `/products/:id` | Soft-delete a product |
| POST | `/orders` | Create an order |
| GET | `/orders` | List orders |
| GET | `/orders/:id` | Get order details |
| PATCH | `/orders/:id/cancel` | Cancel an eligible order |
| GET | `/orders/:id/jobs` | Inspect processing job status |

Refer to Swagger for request schemas, validation rules, and response formats.

## Order Processing Flow

1. The API validates the order request.
2. A database transaction locks the requested products, checks stock, deducts quantities, and creates the order with status `PENDING`.
3. After the transaction commits, the API enqueues an order-processing job.
4. The worker processes the order asynchronously.
5. On success, the order becomes `CONFIRMED` and a notification log is written.
6. After the final processing failure, the order becomes `FAILED` and reserved stock is restored.
7. A delayed job cancels an order if it is still `PENDING` after 30 minutes and restores its stock.

## Concurrency and Stock Consistency

Product rows are locked during order creation to prevent concurrent requests from reserving more stock than is available. Product IDs are processed in sorted order to reduce the risk of deadlocks.

Cancellation and final-failure stock restoration run in database transactions and lock the order before changing its status. This prevents the same order from being refunded multiple times through the normal processing flow.

Order creation and queue submission are separate operations. A Redis or queue failure after the database transaction commits can leave an order without a processing job; a transactional outbox would be a stronger production solution.

## Database Migrations

Run pending migrations:

```bash
npm run migration:run
```

Revert the latest migration:

```bash
npm run migration:revert
```

Do not use destructive database reset commands against data you need to preserve.

## Tests

Run the unit test suite:

```bash
npm run test
```

Run end-to-end tests:

```bash
npm run test:e2e
```

Build the application:

```bash
npm run build
```

## Deployment

The API and BullMQ worker are registered in the NestJS application. Run the application with its required PostgreSQL and Redis services available.

Before deploying:

- Configure production environment variables.
- Run database migrations.
- Build the application with `npm run build`.
- Start the application with `npm run start:prod`.
- Verify the Swagger endpoint and the order-processing flow.

Deployment URL: not yet configured.
