# Nginx + Docker Setup for x-tracing-id

This setup uses Nginx as a reverse proxy in front of your NestJS app. Nginx will generate and forward the `x-tracing-id` header to the application layer.

## How it works
- If the incoming request does not have `x-tracing-id`, Nginx will generate one using `$request_id`.
- All requests to the app will have `x-tracing-id` set.

## Files
- `nginx.conf`: Nginx config to proxy and set tracing header.
- `Dockerfile`: Multi-stage build for NestJS and Nginx.
- `docker-compose.yml`: Orchestrates app and Nginx containers.

## Usage
1. Build and start with Docker Compose:
   ```sh
   docker-compose up --build
   ```
2. Access the app via Nginx at http://localhost:8080/sample/ping
3. The NestJS app will receive `x-tracing-id` in every request.

## Notes
- Nginx runs on port 80 in the container, mapped to 8080 on your host.
- The app runs on port 3000 in the container, mapped to 3000 on your host (for direct access).
- You can customize `nginx.conf` for more advanced tracing or logging.
