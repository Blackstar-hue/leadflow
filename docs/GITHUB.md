# GitHub and online deployment

GitHub stores the private source repository. It does not run the Node API or PostgreSQL database by itself. The deployment flow is:

```text
private GitHub repository -> managed Node host -> managed PostgreSQL
                                   |
                         public HTTPS app URL
                                   |
                    Twilio and website form webhooks
```

## Create the repository

1. Sign in to GitHub and create a new **private** empty repository.
2. Do not add a README, `.gitignore`, or license during creation because this project already has them.
3. From this project folder, configure your own Git identity if it is not already configured:

```powershell
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

4. Create the first commit and connect the private repository. Replace the placeholder URL with your own repository URL:

```powershell
git add --all
git commit -m "Prepare Leadflow app for deployment"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Do not put a GitHub password, personal access token, Twilio Auth Token, database URL, or `.env` file in the repository. If GitHub asks for authentication, use GitHub's browser sign-in or credential manager.

## Connect the host

Create a web service from the private repository with:

```text
Build:  npm ci && npx prisma generate && npx prisma migrate deploy && npm run build
Start:  npm start
Health: /healthz
```

The host must provide HTTPS, private environment variables, and a managed PostgreSQL connection. Set `NODE_ENV=production`, `AUTH_REQUIRED=true`, `PUBLIC_APP_URL` to the final HTTPS URL, `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, and a generated `ADMIN_PASSWORD_HASH`.

After the first deployment, check `/healthz`. It must report `ok: true`, `databaseHealthy: true`, and `persistenceMode: "postgresql"` before any live source is connected.
