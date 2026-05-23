#!/bin/bash
set -euo pipefail

# AWS_REGION, ECR_REPO_URI, POSTGRES_SECRET_ID, GEMINI_SECRET_ID
# are exported by the CDK UserData block before this script runs.

dnf install -y docker jq aws-cli
systemctl enable --now docker

aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "$ECR_REPO_URI"

DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "$POSTGRES_SECRET_ID" \
  --query SecretString \
  --output text \
  --region "$AWS_REGION")
DB_USER=$(echo "$DB_SECRET" | jq -r '.username')
DB_PASS=$(echo "$DB_SECRET" | jq -r '.password')
DB_HOST=$(echo "$DB_SECRET" | jq -r '.host')
DB_NAME=$(echo "$DB_SECRET" | jq -r '.dbname')
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@$DB_HOST:5432/$DB_NAME"

GEMINI_API_KEY=$(aws secretsmanager get-secret-value \
  --secret-id "$GEMINI_SECRET_ID" \
  --query SecretString \
  --output text \
  --region "$AWS_REGION")

docker pull "$ECR_REPO_URI:latest"

docker run -d --restart unless-stopped -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="$DATABASE_URL" \
  -e GEMINI_API_KEY="$GEMINI_API_KEY" \
  "$ECR_REPO_URI:latest"
