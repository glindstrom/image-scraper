#!/bin/bash
prompt=$(jq -r '.prompt')
[ -z "$prompt" ] || [ "$prompt" = "null" ] && exit 0
file="/Users/gabriel/projects/image-scraper/prompts.md"
n=$(grep -cE '^[0-9]+\.' "$file" 2>/dev/null || echo 0)
printf '\n%d. %s\n' "$((n+1))" "$prompt" >> "$file"

