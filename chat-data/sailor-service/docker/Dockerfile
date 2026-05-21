########################### Stage 0 ########################
ARG BUILD_IMAGE=golang:1.24.11
ARG BASE_IMAGE=ubuntu:24.04

FROM ${BUILD_IMAGE} AS builder

WORKDIR /build

# 构建上下文为 chat-data/sailor-service 目录
COPY go.mod go.sum ./

ARG GOPROXY_URL="http://goproxy.cn,direct"
ARG GOPRIVATE="github.com/kweaver-ai/*"

ENV GOPROXY=${GOPROXY_URL} \
    GOPRIVATE=${GOPRIVATE}

ARG GIT_AUTH_TOKEN
RUN if [ -n "${GIT_AUTH_TOKEN}" ]; then \
      git config --global url."https://x-access-token:${GIT_AUTH_TOKEN}@github.com/".insteadOf "https://github.com/"; \
    fi

RUN go mod download

RUN go install github.com/google/wire/cmd/wire@v0.5.0

COPY . .

RUN wire ./cmd/server || true

ARG SERVER_VERSION=0.1.0
RUN CGO_ENABLED=0 go build \
      -ldflags "-s -w -X main.Version=${SERVER_VERSION}" \
      -o ./bin/app ./cmd

########################### Stage 1 ########################
FROM ${BASE_IMAGE} AS prod

ARG UID=1001
ARG GID=1001

RUN groupadd -r -g $GID adp \
    && useradd -r -u $UID -g $GID adp

COPY --from=builder --chown=$UID:$GID /build/bin/app /opt/af/app

RUN mkdir -p /opt/af/static
COPY --from=builder --chown=$UID:$GID /build/cmd/server/config/static /opt/af/static/

RUN mkdir -p /opt/log/af && chown -R $UID:$GID /opt/log/af

WORKDIR /opt/af/

USER adp

EXPOSE 80

ENTRYPOINT ["./app"]
