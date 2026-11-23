# The CSE110 Tutor Agent web server, ready for a host such as Render.
#
# The image contains the built course index (index/) and the ST routine (data/st/), but never
# the raw course files or any API key. Keys are set as environment variables on the host.
# Course material belongs to BRAC University: push this image or its build context only to
# PRIVATE places (a private repository or registry), never to the public ST repository.
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HOST=0.0.0.0 \
    PORT=8110 \
    TUTOR_TRUST_PROXY=true \
    TUTOR_SHOW_MODEL_MENU=false

COPY pyproject.toml README.md ./
COPY src ./src
# editable install keeps the project root at /app, where the index and ST data live
RUN pip install -e .

COPY index ./index
COPY data/st ./data/st

EXPOSE 8110
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD python -c "import urllib.request,os; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8110\")}/healthz', timeout=4)"
CMD ["tutor-web"]
