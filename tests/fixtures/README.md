# Fixture provenance

`upstream/` is copied from Biber 2.22, revision
`1e86e5e80f76b063a9e277c8e331424e2a318c57`, `t/tdata/`, under Artistic-2.0.
See the included Biber license. `corpus.json` enumerates cases with locally
available data sources. These are CLI executions, not the upstream Perl test
runner (some upstream tests configure their inputs programmatically).

Native expected outputs and statuses in `native/` are produced by
`scripts/native-oracle.sh` with Biber 2.22 on x86_64 Linux. Comparisons are exact;
no whitespace, hash, ordering or date normalization is used. The original
license applies to derived golden files. `document.json` and `document.bbl` are
our authored integration example, including nested paths and refsections.

`large/` is a generated 1,000-entry bibliography stress workload. Its `.bbl` was
produced independently by pristine native Biber 2.22, using the same `--noconf
--nolog` CLI flags. It is a benchmark/timeout workload, not an upstream test.
