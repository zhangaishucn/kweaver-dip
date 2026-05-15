ARG BASE_IMAGE=acr.aishu.cn/public/openjdk-temurin:8u422-b05-jdk
FROM ${BASE_IMAGE}
ENV TZ "Asia/Shanghai"

RUN groupadd --gid 5000 workflow \
    && useradd --home-dir /home --create-home --uid 5000 \
    --gid 5000 --shell /bin/sh --skel /dev/null workflow

RUN mkdir -p /home/doc-audit-rest /home/workflow-rest \
    && chown -R workflow:workflow /home

#RUN apt-get update && apt-get install ttf-dejavu fontconfig -y
COPY --chown=workflow:workflow ./doc-audit-rest-0.0.1.jar /home/doc-audit-rest/
COPY --chown=workflow:workflow ./workflow-rest-0.0.1.jar /home/workflow-rest/
COPY --chown=workflow:workflow ./config /conf/workflowconfig

USER workflow

WORKDIR /home

CMD ["sleep", "infinity"]