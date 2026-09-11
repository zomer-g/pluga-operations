#!/bin/sh
# xhostd runtime step — runs at boot as user `app` with the full env.
# server/index.js applies database migrations, then listens on $XHOST_HTTP_PORT.
# exec makes node PID 1 so it receives stop signals.
set -eu
exec node server/index.js
