# Deploying Sequence Numbers to Railway

This guide takes the game from your PC to a public web link anyone can play.
You only need to do **Part 1** yourself — Claude handles the rest.

---

## Part 1 — Log into GitHub (you do this once)

GitHub stores your code online. Railway reads it from there.

### 1a. Make sure you have a GitHub account
- If you don't, go to **https://github.com/signup** and create a free account.
- Remember the username and password.

### 1b. Log in from your computer
Open a terminal **in this project folder** and run:

```
gh auth login
```

Answer the prompts like this (use arrow keys + Enter):
- **What account do you want to log into?** → `GitHub.com`
- **What is your preferred protocol?** → `HTTPS`
- **Authenticate Git with your GitHub credentials?** → `Yes`
- **How would you like to authenticate?** → `Login with a web browser`
- It shows a **one-time code** (like `ABCD-1234`). Copy it.
- Press Enter — your browser opens. Paste the code and click **Authorize**.

When it says **"Logged in as <your-username>"**, you're done.
Tell Claude "I'm logged in" and Claude will create the repo and push the code.

---

## Part 2 — Push the code to GitHub (Claude does this)

The repo is **RogerChouSPC/my-games**, and this game lives in the `sequence-numbers/`
subfolder. Once you're logged in, Claude pushes with:
```
git push -u origin main
```

---

## Part 3 — Deploy on Railway (Claude guides, you click)

1. Go to **https://railway.com** and sign up (click **"Login with GitHub"** — easiest).
2. Click **New Project** → **Deploy from GitHub repo**.
3. The first time, Railway asks to connect to GitHub — approve it, and give it access to the
   **my-games** repository.
4. Pick the **my-games** repo. Railway starts trying to build.
5. **IMPORTANT — set the root directory:** because the game is in a subfolder, open
   **Settings → Source → Root Directory** and set it to `sequence-numbers`, then redeploy.
   (Without this, Railway won't find the game.)
6. Wait ~2-3 minutes for the build to finish (you'll see logs).
7. Go to **Settings → Networking → Generate Domain**. This gives you a public URL like
   `https://my-games-production.up.railway.app`.
8. Open that URL — that's your game! Share it with friends to play.

### Notes
- The `sequence-numbers/railway.json` file tells Railway how to build and run the game once the
  root directory is set. You don't need to configure anything else.
- Free trial credit covers light use; after that it's about **$5/month** for an always-on server.
- Every time the code is pushed to GitHub, Railway automatically rebuilds and redeploys.

---

## Updating the game later

When you want changes, Claude makes them, then runs:
```
git add -A
git commit -m "describe the change"
git push
```
Railway notices the push and redeploys within a couple of minutes. No extra steps.
