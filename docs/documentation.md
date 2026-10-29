# Documentation rules

[The index](index.md) links current topic owners. README is the short introduction;
AGENTS links contributor rules. Keep contracts, procedures and architecture in
their owning guide and link related topics. Do not copy transient measurements
or test counts into the API contract.

Commands, public types and example imports must match code. Documentation checks
run `awiki lint -root docs`; also verify local file links and runnable examples.
[Development](development.md) lists the gates.

Raw measurements, benchmark baselines, logs and dated experiment reports belong
in ignored `local-evaluation/`. Record runtime hashes, commands, environment and
workloads there. Current guides describe supported behavior, not a chronological
experiment diary. License notices and fixture provenance remain committed; see
[distribution](distribution.md) and [testing](testing.md).
