# Codespaces development environment

This repository is configured for GitHub Codespaces using Node.js 22.

## Safety and branch policy

- The production/default branch remains `main`.
- The pre-migration snapshot is preserved at `backup/pre-codespaces-2026-11-18`.
- Development work for this environment belongs on `environment/codespaces-bootstrap`.
- Do not force-push, delete the backup branch, or merge environment changes into `main` without review.
- Keep credentials in Codespaces/GitHub Secrets or environment variables. Never commit `.env` files, tokens, private keys, or credentials.

## Create the workspace

1. Open the repository: https://github.com/warchahirafiya-cloud/TLCE
2. Select the branch `environment/codespaces-bootstrap`.
3. Open the branch menu and choose **Create codespace on environment/codespaces-bootstrap**.
4. Wait for the dev container to finish creating. The `postCreateCommand` installs the repository dependencies.
5. In the terminal, run:

   ```sh
   npm run typecheck
   npm test
   ```

## Preview QuestPulse

From the Codespaces terminal, run:

```sh
python3 -m http.server 4173 --directory apps/web
```

Codespaces forwards port 4173. Open the forwarded URL to preview the static QuestPulse site.

## Daily workflow

1. Work only on a feature or environment branch.
2. Run type checks and tests before committing.
3. Review the diff with `git status` and `git diff`.
4. Push the branch and open a pull request.
5. Merge to `main` only after review and successful CI.

## Free-tier usage

Codespaces usage is subject to the account's monthly included compute and storage quota. Stop or delete idle codespaces when finished. GitHub may request billing setup even when staying within included quotas.
