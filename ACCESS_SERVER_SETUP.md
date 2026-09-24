# SIXTH SENSE — Users & Access server (one-time setup, about 10 minutes)

The access server is a small Google Apps Script that runs in the admin's Google account.
It keeps only two things, in a private Google Sheet called **"SIXTH SENSE — Users & Logs"**:
- the user list: e-mail, name, role, status, last sign-in and IP
- the activity log: sign-ins, access requests, sign-outs, reports, backups and admin changes

Case data (statements, CDR, IPDR, KYC) is **never** sent to this server.

## 1. Create the script
1. Sign in to Google as **cyberpskochi@gmail.com** and open https://script.google.com.
2. Click **New project** and rename it `SIXTH SENSE Access`.
3. Delete everything in `Code.gs`, then paste the full contents of **backend/Code.gs**. Save (Ctrl+S).

## 2. Set the two script properties
Open **Project Settings** (gear icon on the left) → **Script properties** → **Add script property**.

| Property | Value |
|---|---|
| `CLIENT_ID` | the same OAuth Client ID you put in the GitHub variable `GOOGLE_CLIENT_ID` |
| `ADMIN_EMAIL` | `cyberpskochi@gmail.com` (the main admin; this account cannot be blocked or deleted) |

Click **Save script properties**.

## 3. Run setup once
1. Go back to **Editor**, choose the function **setup** in the toolbar, and click **Run**.
2. Allow the permissions. If Google shows "Google hasn't verified this app", click **Advanced** → **Go to SIXTH SENSE Access** → **Allow**.
3. The execution log shows the link to the new Users & Logs sheet.

## 4. Deploy as a Web app
1. Click **Deploy** → **New deployment** → gear icon → **Web app**.
2. Set **Execute as: Me** and **Who has access: Anyone**. ("Anyone" is safe here: the script rejects any request that does not carry a Google sign-in token issued to SIXTH SENSE.)
3. Click **Deploy** and copy the **Web app URL**. It ends in `/exec`.

## 5. Connect it to the website
1. On GitHub, go to **sixthsense → Settings → Secrets and variables → Actions → Variables → New repository variable**.
2. Name: `SIXTHSENSE_BACKEND_URL`. Value: the `/exec` URL.
3. Go to **Actions → Build and deploy SIXTH SENSE → Run workflow**.

## 6. Let officers sign in
While the Google OAuth app is in **Testing**, only the Gmail IDs listed under Google Cloud → **Google Auth Platform → Audience → Test users** can sign in (a maximum of 100).
The easier option is **Audience → Publish app → In production**. SIXTH SENSE uses only basic scopes (email, profile, and drive.file), so Google does not require a review. After publishing, the **Users & Access** page is the only gate.

## How approval works
- A new officer clicks **Sign in with Google** and sees "Access request sent". That officer appears as **pending** in **Users & Access**, with a pink count in the menu.
- The admin clicks **✓ Approve**, or adds users in advance with **＋ ADD & APPROVE**.
- An admin can block, change the role, or delete a user (delete needs `DELETE` typed). A blocked or deleted user is signed out within 3 minutes.
- All actions appear in the Activity log and in the Google Sheet.

## Updating Code.gs later
Deploy → **Manage deployments** → pencil icon → Version: **New version** → Deploy. The URL stays the same.
