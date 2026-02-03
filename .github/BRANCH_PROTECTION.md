# Recommended Branch Protection Rules

Configure these rules in GitHub Settings > Branches > Branch protection rules.

## Main Branch (`main`)

### Rule: Protect main branch

**Branch name pattern:** `main`

### Settings

#### Protect matching branches

- [x] **Require a pull request before merging**
  - [x] Require approvals: `1`
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [ ] Require review from Code Owners (enable if CODEOWNERS file exists)

- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging
  - Status checks required:
    - `typecheck` (if CI configured)
    - `test` (if CI configured)
    - `build` (if CI configured)

- [x] **Require conversation resolution before merging**

- [ ] **Require signed commits** (optional, enable if team uses GPG)

- [x] **Require linear history**
  - Enforces squash or rebase merging

- [ ] **Include administrators** (enable for stricter enforcement)

#### Rules applied to everyone including administrators

- [x] **Do not allow bypassing the above settings**

- [x] **Restrict who can push to matching branches**
  - Allow: Maintainers only

- [x] **Block force pushes**

- [x] **Block deletions**

## GitHub CLI Setup

If you prefer CLI, run:

```bash
gh api repos/{owner}/{repo}/branches/main/protection -X PUT -f \
  required_status_checks='{"strict":true,"contexts":[]}' \
  enforce_admins=false \
  required_pull_request_reviews='{"dismiss_stale_reviews":true,"require_code_owner_reviews":false,"required_approving_review_count":1}' \
  restrictions=null \
  required_linear_history=true \
  allow_force_pushes=false \
  allow_deletions=false \
  required_conversation_resolution=true
```

## For Repository Rulesets (Recommended)

GitHub's newer Rulesets feature provides more granular control:

1. Go to Settings > Rules > Rulesets
2. Click "New ruleset" > "New branch ruleset"
3. Name: `main-branch-protection`
4. Target: Default branch
5. Add rules:
   - Restrict deletions
   - Require linear history
   - Require pull request (1 approval, dismiss stale)
   - Require status checks to pass
   - Block force pushes
