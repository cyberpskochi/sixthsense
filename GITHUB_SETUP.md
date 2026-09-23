# Put CFITS on GitHub (GitHub Pages)

The repository builds itself. Every time you push to `main`, GitHub Actions downloads the pinned libraries, builds the single page with integrity hashes, and publishes it to GitHub Pages.

## A. Create the repository (5 minutes)

1. Sign in at **github.com** (for example the `cyberpskochi` account).
2. Click **+ → New repository**.
   - Name: `cfits`
   - Visibility: **Public** — GitHub Pages on a free account needs a public repository. That is safe here: the repository holds only code, no case data and no secrets.
   - Leave "Add a README" **unticked**.
3. Click **Create repository**.

## B. Upload the files

### Option 1 — Command line (keeps the prepared commit)
Unzip `cfits-github-repo.zip`, open a terminal inside the `cfits` folder and run:
```bash
git remote add origin https://github.com/cyberpskochi/cfits.git
git push -u origin main
```
When git asks for a password, use a **Personal Access Token** (GitHub → Settings → Developer settings → Tokens), not your GitHub password.

### Option 2 — Browser only (no git needed)
1. Unzip `cfits-github-repo.zip`.
2. On the new repository page, click **uploading an existing file**.
3. Drag in everything inside the `cfits` folder: `src`, `test`, `build.py`, `fetch_vendor.sh`, `README.md`, `SETUP_GUIDE.md`, `GITHUB_SETUP.md`, `.gitignore`. Commit.
4. The workflow sits in a hidden folder (`.github`), and hidden folders are often skipped by drag-and-drop. Create it by hand instead:
   **Add file → Create new file**, name it `.github/workflows/pages.yml`, paste in the contents of that file from the zip, then **Commit**.

## C. Switch on Pages and set the variables

1. Repository → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Repository → **Settings → Secrets and variables → Actions → Variables tab → New repository variable**. Add:

   | Name | Value | Notes |
   |---|---|---|
   | `GOOGLE_CLIENT_ID` | `xxxx.apps.googleusercontent.com` | From Google Cloud (SETUP_GUIDE §3). Leave it out to run in local mode. |
   | `CFITS_ALLOWED_EMAILS` | `io1.cyberkochi@gmail.com, sho.cyberkochi@gmail.com` | Comma-separated. |
   | `CFITS_ALLOWED_DOMAINS` | `kerala.gov.in` | Optional. |

   Use **Variables**, not Secrets. A client ID is public by design, and the build writes it into the page.
3. Go to **Actions → "Build and deploy CFITS to GitHub Pages" → Run workflow**. This is only needed the first time; after that every push deploys automatically.
4. After about 1–2 minutes the app is live at **`https://cyberpskochi.github.io/cfits/`**.

## D. Link Google sign-in to the site
In Google Cloud → Credentials → your OAuth client, add this **Authorised JavaScript origin**:
`https://cyberpskochi.github.io`
Then run the workflow again (Actions → Run workflow) so the page is rebuilt with the client ID.

## E. Rules for this repository
- Never commit bank statements, CDR, IPDR, KYC replies or `.enc` backups. The repository is public. `.gitignore` already blocks `*.enc`.
- Change the app by editing files under `src/`, then push. The Action rebuilds and redeploys it.
- To change who can sign in, edit the Actions variables and re-run the workflow. No code change is needed.
