#!/bin/bash
# Quick launcher for the 5-agent pipeline
cd "$(dirname "$0")"
node run_pipeline.js "$@"
