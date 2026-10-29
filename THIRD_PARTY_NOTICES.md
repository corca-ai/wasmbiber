# Third-party notices

The SDK's MIT license does not relicense the Biber runtime or build dependencies.

| Component | Source / license |
| --- | --- |
| Biber 2.22 and upstream fixtures | https://github.com/plk/biber — Artistic-2.0; `tests/fixtures/BIBER-LICENSE` |
| Build recipes and bootstrap derived from TeXlyre | https://github.com/TeXlyre/texlyre-busytex-build — AGPL-3.0; `engine/vendor/LICENSE` |
| Perl 5.38.2, emperl modifications and standard modules | Perl Artistic-1.0 / GPL-1.0-or-later; retained source licenses |
| CPAN native extensions and pure Perl dependencies | Individual META/license and Debian copyright files in the source archive |
| libxml2 2.9.14 | MIT; retained source COPYING |
| sombok (Unicode::LineBreak bundled source) | Its bundled license retained in source archive |
| Emscripten 5.0.4 runtime | MIT / University of Illinois-NCSA; SDK source at pinned build image/version |
| Unicode data | Unicode data license retained in corresponding Perl/Unicode source |

Runtime distributions include a source archive, component inventory and license
texts. The AGPL-licensed bootstrap is kept identified; the runtime bundle is not
represented as MIT-only. Host applications must assess their own distribution
obligations. See [distribution](docs/distribution.md) for the exact artifact
boundary and release checks.
