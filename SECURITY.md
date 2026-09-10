# Security and operation

Private Sites access is the perimeter; every browser page requires ChatGPT sign-in and every API checks the dispatch-owned identity. Identity headers must only be supplied by the trusted Sites dispatcher, never an untrusted reverse proxy. Do not expose the raw Worker directly.

Credential settings are AES-256-GCM encrypted in D1 with random 96-bit IVs and the owner ID as authenticated additional data. VAULT_KEY is a separately provisioned hosted secret, not in source or D1. Rotate with a planned decrypt/re-encrypt migration; losing the key means saved provider keys must be re-entered. GET endpoints return booleans only, not ciphertext or secret suffixes. A compromise of both the running server and its vault secret can decrypt saved keys; this is not an external hardware vault.

Writes require authenticated same-origin application/json requests, a strict 16 KB body limit and field allowlisting. Jira is pinned to the requested tenant. Pinecone hostnames are suffix-validated and redirects are refused. Keys are never stored in localStorage, cookies, URLs, reports, logs or tracing. Use HTTPS in production and least-privilege provider tokens. Dashboard responses are no-store. Reports are rendered as escaped text; Jira descriptions and memory are never treated as instructions.

Manual refreshes use a database lock and a short cooldown. On retrieval failure the last complete report is retained. Pagination is bounded and exceeding a limit fails rather than silently publishing partial counts. Memory integration failures are recorded separately from successful Jira retrieval.

The weekly Codex heartbeat uses the existing Jira connector and republishes dated baseline data. The device hosting the task must be available. It does not access encrypted keys or silently forward weekly connector data to third-party memory providers. The in-app Refresh Jira action uses saved credentials and runs the LangChain/Mem0/Pinecone pipeline with explicit sharing consent.

Mem0/Pinecone receive aggregate counts, dated assessments and limited issue risk fields, scoped by a hashed user namespace. Mem0 writes can be asynchronous; acceptance is not reported as completion. Pinecone requires an existing integrated-embedding index mapped to chunk_text. Removing a saved key does not revoke it or erase provider records.

No provider keys are preconfigured. End-to-end provider calls cannot be verified before the user supplies working credentials. Auth, CSRF, vault encryption, input validation and failure handling should be re-tested after changing the hosting/authentication model.
