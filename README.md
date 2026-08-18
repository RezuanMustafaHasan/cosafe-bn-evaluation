# Onubad Review — CoSafe Bengali translation evaluation

A full-stack review workspace for the human evaluation of the Bengali 12B CoSafe translation. It imports the 1,400 English/Bengali conversation pairs already in this workspace, creates a reproducible category-balanced sample, and supports independent annotation plus admin analysis.

## What is included

- React + Vite interface with separate admin and annotator workspaces
- Firebase Email/Password Authentication
- Express API with verified Firebase ID tokens and role-based access
- Cloud Firestore persistence through the server-side Admin SDK
- Admin-created users, account enable/disable controls, and progress monitoring
- Reproducible random sample generation (500 by default), plus manual add/remove curation
- Side-by-side English/Bengali conversation review
- 1–5 ratings for adequacy, fluency, and semantic preservation
- Drafts, issue tags, notes, submission progress, item-level comparison, and Fleiss’ kappa
- Vercel deployment configuration

## Firebase setup from your account

### 1. Create the Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/) and choose **Add project**.
2. Give the project a name, such as `cosafe-translation-review`.
3. Analytics is optional for this research tool.
4. In **Build → Firestore Database**, choose **Create database**, select a nearby region, and start in **Production mode**.
5. In **Build → Authentication → Sign-in method**, enable **Email/Password**. Do not enable public self-registration in this app; admins create the study accounts.

### 2. Register the browser app

1. On **Project overview**, select the Web (`</>`) icon.
2. Register a web app; Firebase Hosting is not needed because Vercel serves the application.
3. Copy the values from the displayed `firebaseConfig` object into a local environment file:

```bash
cp .env.example .env
```

Fill the six `VITE_FIREBASE_*` values in `.env`. These identify the Firebase project for browser sign-in; the application contains no browser-side Firestore access.

### 3. Create server credentials

1. In Firebase Console, open **Project settings → Service accounts**.
2. Choose **Generate new private key** and download the JSON once.
3. Copy `project_id`, `client_email`, and `private_key` into `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` in `.env`.
4. Keep the private key quoted and represent line breaks as `\n`, as shown in `.env.example`.
5. Delete or securely archive the downloaded JSON; never commit it. The `.gitignore` excludes common service-account filenames and `.env` files.

The `VITE_` variables are intentionally browser-visible. The three Admin variables are secrets and must never receive a `VITE_` prefix.

### 4. Deploy the locked Firestore rules

The browser does not read Firestore directly. `firestore.rules` denies all client reads and writes; the authenticated Express API performs authorized operations through Firebase Admin.

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore
```

Select the Firebase project you created. The last command deploys both the rules and required indexes from this repository.

### 5. Create the first administrator and import the paired dataset

```bash
npm install
npm run firebase:admin -- admin@example.com 'a-strong-temporary-password' 'Admin Name'
npm run firebase:import
```

The importer reads these exact directories and aligns records by filename and line number:

- `Cosafe Dataset Translation/CoSafe datasets Main/`
- `Cosafe Dataset Translation/Cosafe dataset Bengali 12B/`

It validates that both sides have the same number of conversations before writing 1,400 paired `items` documents. Running it again safely overwrites the same deterministic item IDs.

### 6. Run locally

Use two terminals:

```bash
npm run dev:api
```

```bash
npm run dev
```

Open `http://localhost:5173`, sign in as the administrator, generate the 500-item sample, inspect or adjust it, then create the three annotator accounts.

To preview the interface without Firebase, temporarily set `VITE_DEMO_MODE=true`. Keep it `false` in production.

## Deploy to Vercel

1. Push this directory to a private Git repository and import the project into [Vercel](https://vercel.com/new), or run `vercel` from the project root.
2. In **Project settings → Environment Variables**, add every variable from `.env.example` for Production and Preview as appropriate.
3. Use `VITE_DEMO_MODE=false`.
4. Deploy. `vercel.json` builds the Vite client and routes `/api/*` to the Express server as one Node.js function.
5. After changing environment variables, redeploy; Vite browser variables are embedded during the build.

Do not upload the service-account JSON file to Vercel. Add only its three values as encrypted environment variables.

## Suggested evaluation protocol

Use three independent annotators, each rating all 500 sampled items. Keep the criteria and scale definitions fixed before annotation starts. The dashboard calculates Fleiss’ kappa using exact 1–5 categories on items submitted by every active annotator. Because the scale is ordinal, report a weighted agreement statistic as a sensitivity analysis in the thesis; export/report tooling can be added after the annotation protocol is finalized.

## Data model

- `items/{itemId}` — immutable paired source/translation conversations
- `settings/study` — active sample IDs, seed, method, target size, and revision
- `users/{uid}` — display name, role, and access state
- `annotations/{uid_itemId}` — one annotator’s ratings, issues, note, and status for one item

All study API routes verify a Firebase ID token. Admin routes additionally require the `admin` role custom claim/profile.

## Verification

```bash
npm test
npm run lint
npm run build
```
