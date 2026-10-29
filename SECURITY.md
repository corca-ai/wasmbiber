# Security

Do not put credentials, private documents or an exploit against a deployed host
in a public issue. Until a repository security-advisory channel is configured,
report non-sensitive symptoms publicly and request a private reporting channel
before sharing exploit details. No security email address has been provisioned.

Only the latest published version is maintained. This is an early release;
there is no long-term support branch or promised response SLA.

The SDK accepts local BCF and bibliography data and runs each job in an isolated
Worker. Asset manifests are trusted release metadata, not signatures. Hosts
must authenticate the manifest, serve matching assets, enforce their own input
and resource limits, and keep browser/Node versions current. See
[architecture](docs/architecture.md), [API limits](docs/api.md) and
[distribution](docs/distribution.md).
