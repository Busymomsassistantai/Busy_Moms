# Bolt-Only Responses Policy

We deliver all implementation guidance as **Bolt AI prompts**. Prompts must be:
- **Self-contained**: include exact file paths and full file contents or patch blocks.
- **Deterministic**: specify expected outputs (diff summaries, file trees, or tests).
- **Safe**: never embed secrets; refer to environment variables or project secrets.

## How to Use
1. Copy a prompt from the issue or chat.
2. Paste it into Bolt and run.
3. Review the proposed diffs; accept or adjust as needed.

## Template
Use `docs/bolt/PROMPT_TEMPLATE.md` for new prompts.