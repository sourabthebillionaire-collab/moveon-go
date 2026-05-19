Local dev setup (Docker)

This workspace includes a Docker Compose setup to run MongoDB and the backend for local E2E testing.

1) Requirements
- Docker & Docker Compose installed
- Node.js (for frontend dev)

2) Start services

From repo root:

```bash
# build and start mongo + backend
docker-compose up --build
```

This will start MongoDB on `localhost:27017` and the backend on `localhost:3001`.

3) Seed test accounts

Open a new terminal and run:

```bash
# inside the backend container or locally if you have node + deps installed
cd backend
npm run seed
```

This creates a test rider (`+911234567890`) and a test driver (vehicleId `E2E-DRIVER-1`, PIN `1234`).

4) Run frontend

Start the frontend dev server as you normally do (e.g. from `frontend/` run `npm run dev`).

5) Quick test

- Use the rider UI to create a booking.
- Use the driver UI to log in with Vehicle ID `E2E-DRIVER-1` and PIN `1234`.
- Use the on-screen debug panels (bottom-right) to observe socket events.

Troubleshooting
- If ports conflict, adjust `docker-compose.yml` ports.
- Make sure `NODE_ENV=development` when using the debug endpoint.
