#!/bin/sh

WEAVE_SERVER_DEBUG=true WEAVE_SERVER_ENABLE_LOGGING=true WEAVE_WANDB_GQL_NUM_TIMEOUT_RETRIES=1 FLASK_APP=weave.weave_server flask run --port 9994
