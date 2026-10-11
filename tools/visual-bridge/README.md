# KOACH Visual Bridge

Servidor MCP que genera fotos de ejercicios con Gemini, las guarda en Supabase Storage (`ejercicios-media`)
y registra su estado en `public.recursos_visuales`. Proyecto Vercel separado (root: `tools/visual-bridge`).

Variables: `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `BRIDGE_TOKEN`, `SUPABASE_URL` (opcional `GEMINI_IMAGE_MODEL`).
Conector: `https://<dominio>/mcp/<BRIDGE_TOKEN>`

Desplegado como proyecto Vercel `koach-visual-bridge`.
