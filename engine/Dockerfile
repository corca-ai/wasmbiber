# Rebuilding packages must pass the recorded package inventory check.
FROM --platform=linux/amd64 emscripten/emsdk@sha256:61aa4ca6e3dcdf0cfce9c3018767a0698bdc0f7ff72ca5982a0536c5caff93f7
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends biber xindy ecl libgmp-dev libgc-dev libffi-dev libncurses-dev texlive-latex-base texlive-bibtex-extra autoconf automake libtool pkg-config curl xz-utils git && rm -rf /var/lib/apt/lists/*
WORKDIR /work
