# Security Alerts & Major Upgrade Analysis

**Date:** 2026-02-04
**Repository:** acedergren/oci-genai-examples

---

## 🔒 Security Alerts (3 Open)

### Alert #2 - **MEDIUM SEVERITY** ⚠️

**Package:** `esbuild`
**CVE:** N/A
**Summary:** esbuild enables any website to send any requests to the development server and read the response
**Status:** Open
**URL:** https://github.com/acedergren/oci-genai-examples/security/dependabot/2

**Impact:**
- Affects development server only
- Remote sites can send requests to local dev server

**Mitigation:**
- Development-only issue (not production)
- Upgrade esbuild to latest patched version
- Ensure dev server not exposed to untrusted networks

**Recommended Action:** Update esbuild in next maintenance cycle (LOW priority for production deployments)

---

### Alert #1 - LOW SEVERITY

**Package:** `cookie`
**CVE:** CVE-2024-47764
**Summary:** cookie accepts cookie name, path, and domain with out of bounds characters
**Status:** Open
**URL:** https://github.com/acedergren/oci-genai-examples/security/dependabot/1

**Impact:**
- Cookie parsing vulnerability
- Could allow malformed cookies to bypass validation

**Mitigation:**
- Update to patched version of cookie package
- Review cookie handling code for proper validation

**Recommended Action:** Include in next dependency update cycle

---

### Alert #3 - LOW SEVERITY

**Package:** `diff` (jsdiff)
**CVE:** CVE-2026-24001
**Summary:** jsdiff has a Denial of Service vulnerability in parsePatch and applyPatch
**Status:** Open
**URL:** https://github.com/acedergren/oci-genai-examples/security/dependabot/3

**Impact:**
- DoS vulnerability in patch parsing
- Likely affects testing/development tools only

**Mitigation:**
- Update jsdiff to patched version
- Review usage (likely in test dependencies)

**Recommended Action:** Low priority - update in next cycle

---

## 📊 Security Summary

| Severity | Count | Action Priority |
|----------|-------|----------------|
| **MEDIUM** | 1 | Low (dev-only) |
| **LOW** | 2 | Low |
| **TOTAL** | 3 | All manageable |

**Overall Assessment:** ✅ No critical production vulnerabilities. All alerts are low-medium severity and affect development dependencies or edge cases.

---

## 🚀 Major Version Updates Available

### Summary by Package

**Total Packages with MAJOR updates:** 36 across 11 projects
**Most Common Updates:**
- `vite`: 6.4.1 → 7.3.1 (9 packages)
- `vitest`: 2.1.9/3.2.4 → 4.0.18 (6 packages)
- `@sveltejs/vite-plugin-svelte`: 5.1.1 → 6.2.4 (8 packages)
- `zod`: 3.25.76 → 4.3.6 (4 packages)

---

## 🔍 Detailed Analysis by Priority

### HIGH PRIORITY - Test Before Applying

#### 1. **vite 6.x → 7.x** (9 packages affected)

**Breaking Changes:**
- Node.js requirement: ^20.19.0 || >=22.12.0
- Build output structure changes
- Plugin API updates
- HMR improvements with potential behavior changes

**Packages Affected:**
- chatbot-demo, fraud-analyst-agent, kyc-intelligence (x2), oci-ai-chat, realtime-stt-demo

**Migration Steps:**
1. Review [Vite 7 migration guide](https://vitejs.dev/guide/migration)
2. Update Node.js to >=22.12.0 if needed
3. Test build output in one package first
4. Check all vite plugins for v7 compatibility
5. Update rollup config if customized

**Recommended Timeline:** Next major release cycle (Q2 2026)

---

#### 2. **vitest 2.x/3.x → 4.x** (6 packages affected)

**Breaking Changes:**
- Node.js requirement: ^20.0.0 || ^22.0.0 || >=24.0.0
- Test configuration changes
- Snapshot format updates
- Coverage reporting changes

**Packages Affected:**
- chatbot-demo, fraud-analyst-agent, oci-ai-chat, oci-genai-query

**Migration Steps:**
1. Review [Vitest 4.0 changelog](https://github.com/vitest-dev/vitest/releases)
2. Update test configs
3. Regenerate snapshots if needed
4. Verify coverage thresholds still work
5. Test in CI/CD pipeline

**Recommended Timeline:** Next sprint (coordinate with vite upgrade)

---

#### 3. **zod 3.x → 4.x** (4 packages affected)

**Breaking Changes:**
- Schema inference changes
- Validation error format updates
- TypeScript requirements updated
- Performance improvements with behavioral changes

**Packages Affected:**
- fraud-analyst-agent, mcp-client, oci-genai-provider

**Migration Steps:**
1. Review [Zod 4.0 migration guide](https://github.com/colinhacks/zod/releases)
2. Update schema definitions
3. Test all validation logic
4. Update error handling code
5. Verify TypeScript types still work

**⚠️ IMPORTANT:** This affects API validation - thorough testing required

**Recommended Timeline:** Dedicated testing sprint before production

---

### MEDIUM PRIORITY - Safe to Upgrade with Testing

#### 4. **@sveltejs/vite-plugin-svelte 5.x → 6.x** (8 packages)

**Breaking Changes:**
- Node.js requirement: ^20.19 || ^22.12 || >=24
- Svelte 5 optimizations
- HMR improvements

**Migration:**
- Generally backward compatible with Svelte 5
- Test HMR behavior in development
- Verify build output

**Timeline:** With vite 7 upgrade

---

#### 5. **jsdom 24.x/26.x → 28.x** (2 packages)

**Breaking Changes:**
- Node.js version requirements
- DOM API updates to match latest standards

**Packages Affected:**
- chatbot-demo, fraud-analyst-agent

**Migration:**
- Update test suites
- Verify DOM API usage
- Check snapshot tests

**Timeline:** Low risk, can upgrade anytime

---

#### 6. **better-sqlite3 11.x → 12.x** (fraud-analyst-agent)

**Breaking Changes:**
- Node.js requirement: 20.x || 22.x || 23.x || 24.x || 25.x
- Database file format may need migration
- API improvements

**⚠️ CRITICAL:** Backup database files before upgrade!

**Migration:**
1. Backup all .db files
2. Test on development copy first
3. Run migration scripts if needed
4. Verify data integrity
5. Test all queries

**Timeline:** Next maintenance window with proper backup

---

#### 7. **drizzle-orm 0.38.x → 0.45.x** (fraud-analyst-agent)

**Breaking Changes:**
- Schema definition updates
- Query builder API changes
- Migration system improvements

**Migration:**
1. Review changelog for 0.38 → 0.45
2. Update schema definitions
3. Regenerate migrations
4. Test all database queries
5. Verify ORM behavior

**Timeline:** Coordinate with better-sqlite3 upgrade

---

### LOW PRIORITY - Can Wait

#### 8. **openai 4.x → 6.x** (chatbot-demo)

**Notes:**
- 2 major versions jump
- Extensive API changes
- New features and improvements

**Timeline:** Next feature development cycle

---

#### 9. **@faker-js/faker 9.x → 10.x** (fraud-analyst-agent)

**Notes:**
- Data generation library
- Test data only
- Low risk

**Timeline:** Anytime, low priority

---

#### 10. **commander 12.x/13.x → 14.x** (oci-tui, tui-agent)

**Notes:**
- CLI argument parsing
- Usually backward compatible
- Node.js >=20 required

**Timeline:** Next maintenance cycle

---

#### 11. **csv-parse 5.x → 6.x** (kyc-intelligence)

**Notes:**
- CSV parsing library
- Check API changes for data ingestion

**Timeline:** Before next data import operation

---

#### 12. **@tanstack/svelte-query 5.x → 6.x** (oci-ai-chat)

**Notes:**
- React Query for Svelte
- API improvements
- Migration guide available

**Timeline:** Next feature sprint

---

## 📋 Recommended Upgrade Strategy

### Phase 1: Security Fixes (IMMEDIATE)
```bash
# Fix moderate security issue
pnpm update esbuild@latest

# Fix low security issues
pnpm update cookie@latest
pnpm update diff@latest

# Test and commit
pnpm test
git add pnpm-lock.yaml
git commit -m "security: patch esbuild, cookie, and diff vulnerabilities"
```

### Phase 2: Foundation Updates (2-4 weeks)
1. **Node.js Update**
   - Upgrade to Node.js 22 LTS (required for vite 7, vitest 4)
   - Update in CI/CD pipelines
   - Update Docker base images

2. **Build Tool Updates**
   - vite 6 → 7
   - vitest 2/3 → 4
   - @sveltejs/vite-plugin-svelte 5 → 6

**Test in one package first:**
```bash
cd chatbot-demo
pnpm update vite@^7 vitest@^4 @sveltejs/vite-plugin-svelte@^6
pnpm test && pnpm build
# If successful, repeat for other packages
```

### Phase 3: Schema/Database Updates (4-6 weeks)
1. **zod 3 → 4**
   - Update validation schemas
   - Test all API endpoints
   - Update error handling

2. **Database Stack** (fraud-analyst-agent only)
   - better-sqlite3 11 → 12
   - drizzle-orm 0.38 → 0.45
   - Backup → Upgrade → Verify

### Phase 4: Nice-to-Have Updates (8-12 weeks)
- openai 4 → 6
- @tanstack/svelte-query 5 → 6
- commander 12/13 → 14
- csv-parse 5 → 6
- Other minor majors

---

## 🎯 Immediate Action Items

### This Week
- [ ] Apply security patches (esbuild, cookie, diff)
- [ ] Review Node.js 22 LTS compatibility
- [ ] Create upgrade testing plan

### Next 2 Weeks
- [ ] Test vite 7 in one isolated package
- [ ] Document breaking changes encountered
- [ ] Update CI/CD for Node.js 22

### Next Month
- [ ] Roll out vite 7 + vitest 4 across all packages
- [ ] Begin zod 4 migration planning
- [ ] Schedule database upgrade maintenance window

---

## 🔗 Resources

**Migration Guides:**
- [Vite 7.0 Migration](https://vitejs.dev/guide/migration)
- [Vitest 4.0 Changelog](https://github.com/vitest-dev/vitest/releases/tag/v4.0.0)
- [Zod 4.0 Migration](https://github.com/colinhacks/zod/releases/tag/v4.0.0)
- [Node.js 22 Release Notes](https://nodejs.org/en/blog/release/v22.0.0)

**Security Advisories:**
- Dependabot Alerts: https://github.com/acedergren/oci-genai-examples/security/dependabot

---

## 📝 Notes

- All MAJOR updates should be tested in development first
- Database upgrades require full backup and migration testing
- Coordinate upgrades that have dependencies (vite + vitest)
- Security patches can be applied immediately
- No production-critical vulnerabilities detected

**Last Updated:** 2026-02-04
**Next Review:** 2026-03-04 (monthly)
