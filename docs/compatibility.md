# Compatibility and trust boundary

The runtime uses pinned Biber 2.22 and its BCF 3.11 contract. The host must align
biblatex with that version; a TeX Live year alone does not identify a compatible
biblatex release. Incompatible BCF headers are refused before execution.

The supported interface is a local BCF plus explicitly supplied database files,
returning a BBL. Local UTF-8 BibTeX databases are the main path; byte inputs allow
Biber-controlled encoding. Name disambiguation, locale collation, sourcemaps,
refsections, inheritance and date logic remain Biber's code. This is not a
biblatex approximation. See [testing](testing.md) for oracle coverage.

There are no arbitrary command-line arguments, executable hooks, host config
files, kpsewhich, host filesystem mounts or remote bibliography acquisition.
BCF files containing XML entity declarations are rejected before execution. Jobs are resource-bounded and terminate on
timeout, so pathological regexes cannot block the UI. Unknown schema details
are diagnosed by Biber. A successful exit with warnings is returned with those
warnings; missing input or processing errors are failures, never silent fallback.

The runtime keeps all Unicode collations, recoding tables and date locale data.
The build fixes the XML UTF-8 flag and replaces clock-dependent internal IDs
with job-local monotonically increasing IDs. Internal identifiers never escape
the job; output hashes remain native Biber hashes. The Perl integer width is
part of the [build contract](build.md), including extended-year tests.

The qualified browser is the browser recorded by the automated qualification
report. Other engines, low-memory mobile devices and embedded WebViews require
host qualification; the [performance guide](performance.md) does not promise
identical latency across devices. See [distribution](distribution.md) before
shipping the native dependencies.
