# Offline runtime assets

The manifest identifies one immutable set of runtime JS, WASM, Perl data and
filesystem metadata by byte length and SHA-256. All assets are verified before
any runtime code executes. Persistent cache keys include the runtime identity
and asset URL. Corrupt cached entries are discarded and fetched again; if the
network is unavailable the operation fails explicitly. Builds with different
identities never reuse each other's files. See [build](build.md).

Browser persistence uses Cache Storage when available. Denied storage or quota
failure still permits the current in-memory run. `offlineStatus()` rereads and
verifies persisted assets: `warmUp()` success alone is not a durable readiness
claim. Browser eviction can change readiness at any time. A host may request
persistent storage and must communicate missing assets accurately.

The host must also cache the application shell, SDK/Worker modules, documents
and TeX packages. This SDK only caches its runtime. The [browser test](testing.md)
proves a fresh Worker runs after the test server stops; it does not qualify an
entire application for offline use.

No bibliography or control-file content is stored in the persistent runtime
cache. Execution uses private Worker memory and no remote Biber service.
Version mismatch, missing files and Biber errors are explicit. The host owns
any server or approximate fallback, as described in [integration](integration.md).
