# IESO Ontario Grid for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com) that shows the
**Ontario power grid** live, from the public reports of the
[IESO](https://www.ieso.ca/power-data) (Independent Electricity System Operator): the real-time
price, the demand, the generation by fuel, the low-carbon share and an estimated CO₂ intensity.

No account, no key: the reports are public. Tested against the real IESO reports.

## Features

- An **Ontario power grid** device:
  - the Ontario Zonal Price, $/MWh CAD, every five minutes (the real-time price of the renewed
    market, which replaced the HOEP in May 2025);
  - the Ontario demand, every five minutes;
  - the share of nuclear, hydro, natural gas, wind, solar, biofuel and other sources, the
    low-carbon and renewable shares, and an estimated CO₂ intensity, every hour;
  - a one-sentence summary.
- Three scene triggers, once per crossing: price above a threshold, price below a threshold (0 for
  a negative price), low-carbon share above a threshold.
- A dashboard widget: price, low-carbon share, CO₂, demand, a 24-hour price chart and the mix as
  bars.
- A "Test the connection to the IESO" action.
- English, French, German and Spanish.

## Requirements

- Gladys Assistant 5.3.0 or later.
- Internet access to `reports-public.ieso.ca`.

## Installation

In Gladys, **Integrations → Install from GitHub**, then the address of this repository:
`https://github.com/guim31/gladys-ieso`. Then add the **Ontario power grid** device from the
Discover tab. See the documentation: [English](docs/en.md), [français](docs/fr.md),
[Deutsch](docs/de.md), [español](docs/es.md).

## How it works

Three public XML reports, the current file only (never the directory index, over a megabyte):

| Report                      | What                                      | Pace                      |
| --------------------------- | ----------------------------------------- | ------------------------- |
| `RealtimeOntarioZonalPrice` | Ontario Zonal Price of each interval      | every 5 minutes           |
| `RealtimeTotals`            | Ontario demand of each interval           | every 5 minutes           |
| `GenOutputCapability`       | hourly output of every generator, by fuel | once per new hour (~ :15) |

The market runs on Eastern Standard Time all year, hour ending: the integration converts it.
Just after midnight, while the generator file of the new day has no hour yet, the file of the day
before is read. Apart from a read at start-up and the test action, nothing is read while the device is not added, no trigger threshold is set and no
dashboard shows the widget.

## Limitations

- Wholesale prices, not a retail rate: Ontario homes pay regulated rates plus delivery and the
  Global Adjustment.
- The mix covers the transmission-connected generators only: imports and the generators embedded
  in local distribution networks (most rooftop solar) are not in the IESO report.
- The CO₂ intensity is an estimate from the mix (IPCC 2014 median life-cycle factors).
- No IESO quota is published for these reports; the integration reads each at the pace it is
  published, with an honest User-Agent.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against the SDK's fake Gladys and real IESO reports recorded on 2026-11-19 and
2026-11-01, the day of the clock change (`test/fixtures/`, trimmed to a few generators of each
fuel), never the network. See [`CLAUDE.md`](CLAUDE.md) for the project rules. Versions, images and
releases belong to the Release workflow (Actions → Release).

## Credits

- [IESO](https://www.ieso.ca/power-data): the public reports of
  [reports-public.ieso.ca](https://reports-public.ieso.ca/public/).
- Emission factors: IPCC AR5 (2014), as used by [Electricity Maps](https://www.electricitymaps.com).
- The architecture follows [gladys-us-grid](https://github.com/guim31/gladys-us-grid); the
  conformity and language tests follow [gladys-wled](https://github.com/guim31/gladys-wled).

## Disclaimer

This project is not affiliated with, endorsed or sponsored by the IESO (Independent Electricity
System Operator). The IESO logo on the cover belongs to the IESO.

## License

Apache-2.0
