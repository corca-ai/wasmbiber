# Security

Report vulnerabilities privately through [GitHub security advisories](https://github.com/corca-ai/wasmbiber/security/advisories/new).
Do not put credentials, private documents or exploit details in public issues.

Only the latest published version is maintained. This is an early release;
there is no long-term support branch or promised response SLA.

The SDK accepts local BCF and bibliography data and runs each job in an isolated
Worker. Asset manifests are trusted release metadata, not signatures. Hosts
must authenticate the manifest, serve matching assets, enforce their own input
and resource limits, and keep browser/Node versions current. See
[architecture](docs/architecture.md), [API limits](docs/api.md) and
[distribution](docs/distribution.md).
