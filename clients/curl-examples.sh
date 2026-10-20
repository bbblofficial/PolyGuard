#!/usr/bin/env bash
# Unicollect Guard API with curl.  Usage: ./curl-examples.sh https://xxxx.trycloudflare.com [api_key]
# Or find the live link automatically:  BASE=$(curl -s https://<user>.github.io/<repo>/api/links.txt)
set -euo pipefail
BASE="${1:?base url}"; KEY="${2:-}"
H=(-H "Content-Type: application/json"); [ -n "$KEY" ] && H+=(-H "X-API-Key: $KEY")
post() { echo "== POST $1"; curl -s "${H[@]}" -X POST "$BASE$1" -d "$2"; echo; }
get()  { echo "== GET $1";  curl -s "${H[@]}" "$BASE$1"; echo; }

get  /api/v1
get  /api/v1/health
get  /api/v1/models
get  /api/v1/config
get  "/api/v1/check?text=salam%20khoobi"
post /api/v1/check                   '{"text":"to khar hasti"}'
post /api/v1/check                   '{"text":"Have a nice day","detailed":false}'
post /api/v1/check/batch             '{"texts":["سلام وقت بخیر","You are stupid","kir"]}'
post /api/v1/verdict                 '{"text":"khafe sho ahmagh"}'
post /api/v1/score                   '{"text":"you idiot","models":["textdetox_lg","twitter_off"]}'
post /api/v1/sentences               '{"text":"Hello there. You are stupid! خوبی؟"}'
post /api/v1/censor                  '{"text":"you are a k1r, have a nice day"}'
post /api/v1/moderations             '{"input":["You are stupid","hello"]}'
post /api/v1/profanity               '{"text":"jakesh"}'
post /api/v1/language                '{"text":"salam khoobi"}'
post /api/v1/fingilish/detect        '{"text":"to khar hasti"}'
post /api/v1/fingilish/transliterate '{"text":"salam khoobi"}'
post /api/v1/normalize               '{"text":"K.1.R kiiiir"}'
get  /api/v1/stats
