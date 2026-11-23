# Deploying the tutor to the ST website

The ST website (Vercel) cannot run Python, so the agent runs as its own small web service on
Render, and the site's "Ask the CSE110 Tutor" chat calls it. Nothing below has been done yet;
every step that creates an account, pushes code or makes something public is yours to do.

```
students ──> ST website (Vercel) ──> TutorChat ──HTTPS──> tutor service (Render, Docker)
                                                              ├─ MCP course server + index
                                                              └─ Groq / Gemini (your keys)
```

## Rules this setup keeps

- **Course material stays private.** The index (BRAC University's notes and lab sheets) is only in
  the Docker image and a **private** repository. It is git-ignored in the public ST repository.
- **Keys never leave the host.** `GROQ_API_KEY` and `GOOGLE_API_KEY` are set in Render's dashboard,
  not in any file. The website never sees them.
- **Strangers cannot drain your quota.** Only the ST site's address may call the API (CORS), each
  visitor gets 5 questions a minute and 40 a day, and everyone together gets 800 a day. Change these
  with `TUTOR_LIMIT_PER_MINUTE`, `TUTOR_LIMIT_PER_DAY` and `TUTOR_GLOBAL_PER_DAY`.
- **The chat can never take the site down.** It renders nothing until configured, and an error
  boundary hides it if anything inside it fails.

## 1. Build the deploy bundle

```powershell
cd A:\ST_BRACU_T07\agent
.\.venv\Scripts\python scripts\make_deploy_bundle.py A:\cse110-tutor-deploy
```

It copies the code, the built `index/`, `data/st/`, the `Dockerfile` and `render.yaml`, and refuses
if `.env` or raw course files would be included. Rebuild the bundle whenever you rebuild the index
or change the routine.

## 2. Push it to a private repository

Create a **private** GitHub repository (for example `cse110-tutor-deploy`), then push the bundle
folder to it. Never add this folder to the public ST repository.

## 3. Create the Render service

1. In Render: **New > Blueprint**, pick the private repository. It reads `render.yaml`
   (free web service, Docker, health check `/healthz`).
2. Paste `GROQ_API_KEY` and `GOOGLE_API_KEY` when asked.
3. Check `TUTOR_ALLOWED_ORIGINS` is your site's address (`https://st-imtiaz-t07.vercel.app`).
4. Wait for the first deploy, then open `https://<your-service>.onrender.com/healthz`. It should say `ok`.

The free tier sleeps after about 15 minutes without visitors. The first question after that waits
30 to 60 seconds while it wakes; the chat tells students so.

## 4. Turn the chat on in the ST website

In Vercel, add an environment variable to the ST project and redeploy:

```
VITE_TUTOR_API_URL = https://<your-service>.onrender.com
```

Until this variable exists, the site looks exactly as it does today.

## Test it locally first (what was checked on 23 November 2026)

```powershell
# terminal 1: the agent in "hosted" mode
cd A:\ST_BRACU_T07\agent
$env:TUTOR_ALLOWED_ORIGINS = 'http://localhost:5173'; $env:TUTOR_SHOW_MODEL_MENU = 'false'; .\.venv\Scripts\tutor-web.exe
```

```powershell
# terminal 2: the ST site pointed at it
cd A:\ST_BRACU_T07
$env:VITE_TUTOR_API_URL = 'http://127.0.0.1:8110'; npm run dev
```

Checked: `/healthz` answers `ok`; the site's address passes CORS and another site's is refused; the
sixth question in a minute from one visitor gets "please wait"; a question asked in the site's chat
streams a cited answer with a table in about 2 seconds; the chat survives every partial state of a
streaming answer. Not checked: the Docker image itself (Docker Desktop was not running), and Render.
