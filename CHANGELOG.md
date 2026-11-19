# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-11-19

### Added

- An **Ontario power grid** device, from the public reports of the IESO: the
  real-time Ontario Zonal Price ($/MWh) and the Ontario demand every five
  minutes; the share of nuclear, hydro, natural gas, wind, solar, biofuel and
  other sources, the low-carbon and renewable shares and an estimated CO₂
  intensity every hour; a one-sentence summary.
- Scene triggers: price above a threshold, price below a threshold (0 for a
  negative price), low-carbon share above a threshold, once per crossing.
- A dashboard widget: price, low-carbon share, CO₂, demand, a 24-hour price
  chart and the mix as bars, each optional block with a setting to hide it.
- A "Test the connection to the IESO" action.
- Documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-ieso/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-ieso/releases/tag/v1.0.0
