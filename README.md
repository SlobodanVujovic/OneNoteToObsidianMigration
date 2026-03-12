To run n8n Docker container use command:
`docker run -it --rm --name n8n -p 5678:5678 -e GENERIC_TIMEZONE="Europe/Belgrade" -e TZ="Europe/Belgrade" -e N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true -e N8N_RUNNERS_ENABLED=true -e NODE_FUNCTION_ALLOW_EXTERNAL: "jsdom" -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n`

See https://docs.n8n.io/hosting/installation/docker/#starting-n8n.
