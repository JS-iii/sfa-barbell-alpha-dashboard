# v7B.0.1 Canary Rollback Checklist

**Status:** Planning document  
**Purpose:** Defines exact rollback steps if a canary write goes wrong.  

---

## Immediate Rollback (within 5 minutes)

- [ ] Set `OPENBRAIN_WRITE_DISABLED=true` (kill switch)
- [ ] Verify kill switch is active by checking adapter status
- [ ] Document the incident timestamp

## Short-Term Rollback (within 1 hour)

- [ ] Identify which observation records were affected
- [ ] Open Brain support: request record deletion/mark-as-revoked
- [ ] Rotate credentials if compromise suspected
- [ ] Review audit log for all writes in incident window

## Post-Incident (within 24 hours)

- [ ] Full audit log review
- [ ] Credential audit (check for leaks)
- [ ] Update operator checklist with lessons learned
- [ ] File incident report

## Emergency Contacts

| Role | Contact | Purpose |
|------|---------|---------|
| Primary Operator | ________________________________ | Kill switch, decisions |
| Security | ________________________________ | Credential rotation, breach |
| Open Brain Support | ________________________________ | Record deletion |

## Rollback Verification Steps

```bash
# 1. Verify kill switch is active
OPENBRAIN_WRITE_DISABLED=true npm run bridge:live-write-adapter

# 2. Verify no writes are occurring
cat data/dry-run/v7b-audit-log-v7a4.jsonl | tail -5

# 3. Verify adapter status shows blocked
```

---

*This is a planning document. Not executable code.*
