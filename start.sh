#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="snorkel-conditions-checker"
CONTAINER_NAME="snorkel-conditions-checker"
ENV_FILE=".env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.example to .env and add your keys." >&2
  exit 1
fi

docker build -t "$IMAGE_NAME" .

if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
fi

docker run --env-file "$ENV_FILE" -p 4173:4173 --name "$CONTAINER_NAME" --rm "$IMAGE_NAME"
