# KontextMind Deployment Guide

## Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/your-org/kontextmind.git
cd kontextmind
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your values
nano .env
```

Required environment variables:
- `GITHUB_TOKEN` - GitHub PAT for cloning repos
- `LLM_API_KEY` - Your LLM provider API key
- `API_KEY` - Your desired API key for authentication

### 3. Build and Run

Using Docker:

```bash
# Development
docker compose up -d

# Production
docker compose -f docker-compose.prod.yml up -d
```

Using Docker directly:

```bash
# Build image
docker build -t kontextmind-api .

# Run container
docker run -d \
  --name kontextmind-api \
  -p 7331:7331 \
  -e GITHUB_TOKEN=your_github_token \
  -e LLM_API_KEY=your_llm_api_key \
  -e API_KEY=your_api_key \
  kontextmind-api
```

### 4. Verify

```bash
# Check health
curl http://localhost:7331/health

# Expected response:
# {"status":"healthy","version":"0.1.0",...}
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `7331` | Server port |
| `HOST` | No | `0.0.0.0` | Server host |
| `DATA_DIR` | No | `/kontextmind/projects` | Projects directory |
| `API_KEY` | No | - | API authentication key |
| `GITHUB_TOKEN` | Yes* | - | GitHub PAT for cloning |
| `LLM_API_KEY` | Yes* | - | LLM provider API key |
| `LLM_PROVIDER` | No | `openai` | LLM provider |
| `LLM_MODEL` | No | `gpt-4o` | Model name |
| `LLM_BASE_URL` | No | - | Custom endpoint |

*Required for project setup and ask operations.

---

## Docker Volumes

To persist projects across container restarts, mount a volume:

```yaml
volumes:
  - /path/to/your/data:/kontextmind/projects
```

---

## Health Checks

The container includes a health check that verifies the `/health/live` endpoint.

```bash
# Check container health
docker inspect kontextmind-api --format='{{.State.Health.Status}}'

# View logs
docker logs kontextmind-api
```

---

## Resource Limits

Production compose includes resource limits:

- **CPU**: 0.5 - 2 cores
- **Memory**: 512MB - 2GB

Adjust in `docker-compose.prod.yml` based on your workload.

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker logs kontextmind-api

# Verify environment variables
docker exec kontextmind-api env | grep -E "^(PORT|HOST|LLM_)"
```

### Health check failing

```bash
# Manually test
docker exec kontextmind-api wget --no-verbose --tries=1 --spider http://localhost:7331/health/live

# Check if port is exposed
docker port kontextmind-api
```

### Projects not persisting

Ensure your volume mount is correct:
```bash
docker inspect kontextmind-api --format='{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
```

---

## Security Notes

1. **Never commit `.env` to version control**
2. Use strong API keys: `openssl rand -hex 32`
3. In production, use HTTPS via reverse proxy (nginx, traefik)
4. Consider read-only volume mounts for source projects

---

## Next Steps

- See [API.md](API.md) for complete API documentation
- Configure your project chat UI to use the API
- Set up monitoring and alerting for production