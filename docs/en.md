# IESO Ontario Grid

Live figures of the Ontario power grid in Gladys, from the public reports of
the IESO (Independent Electricity System Operator): the real-time price, the
demand, the generation by fuel, the low-carbon share and an estimated CO₂
intensity.

The data is public and needs no account: tested against the real IESO
reports. Not affiliated with the IESO.

## What you get

- An **Ontario power grid** device: the Ontario Zonal Price ($/MWh), the
  Ontario demand, the estimated CO₂ intensity, the low-carbon and renewable
  shares, the share of nuclear, hydro, natural gas, wind, solar, biofuel and
  other sources, and a one-sentence summary.
- Three scene triggers: price above a threshold, price below a threshold
  (0 for a negative price), low-carbon share above a threshold.
- A dashboard widget with the price, the low-carbon share, the CO₂, the
  demand, a 24-hour price chart and the mix as bars.

**Prices are wholesale prices** of the IESO real-time market, not your
electricity rate: Ontario homes pay regulated rates (time-of-use, tiered or
ultra-low overnight) plus delivery and the Global Adjustment. The wholesale
price still shows when power is plentiful or tight.

## Requirements

- Gladys 5.3.0 or later.
- Internet access from Gladys (the reports are read on
  `reports-public.ieso.ca`). No account, no key.

## Installation

In Gladys, **Integrations → Install from GitHub**, then the address of the
repository: `https://github.com/guim31/gladys-ieso`.

## Configuration

- **High price threshold** and **Low price threshold** ($/MWh): for the
  price triggers. Empty: trigger off. A low threshold of 0 fires when the
  price turns negative.
- **Low-carbon share threshold** (%): for the low-carbon trigger. Empty: off.
- **Language of the names**: names of the features (frozen when the device
  is added), the summary and the action messages. French by default.

Then, in the **Discover** tab, add the **Ontario power grid** device.

## Devices

### Ontario power grid

| Feature                  | Unit  | Refresh         |
| ------------------------ | ----- | --------------- |
| Ontario price            | $/MWh | every 5 minutes |
| Ontario demand           | kW    | every 5 minutes |
| CO₂ intensity, estimated | g/kWh | hourly          |
| Low-carbon share         | %     | hourly          |
| Renewable share          | %     | hourly          |
| Share of each fuel (7)   | %     | hourly          |
| Summary                  | text  | every 5 minutes |

Gladys has no megawatt unit: the demand is in kW (17 GW shows as
17,000,000 kW). The price is in Canadian dollars, shown with the dollar unit
of Gladys.

## Scenes

The triggers fire **once per crossing**: back past the threshold by a margin
(5 $/MWh, 2 points) before they can fire again. A restart does not fire them
again.

### IESO price above the threshold

The price rises above the high threshold. Variables: `price`, `threshold`.

### IESO price below the threshold

The price falls below the low threshold (0: a negative price). Variables:
`price`, `threshold`.

### Ontario grid: low-carbon share high

The low-carbon share rises above its threshold: a good time to charge a car or
run the water heater. Variables: `low_carbon_share`, `renewable_share`,
`carbon_intensity`, `threshold`.

## Dashboard

### Ontario power grid widget

The price (red above the high threshold, green below the low one or when
negative), the low-carbon share, the CO₂ and the demand, a 24-hour price chart
once the device is added, and the mix as bars. The chart and the mix each have
a setting to hide them.

## Actions

### Test the connection to the IESO

Reads the price, the demand and the mix now, and answers with the figures,
or with what failed (in red).

## Data and limits

- Sources: `RealtimeOntarioZonalPrice` (Ontario Zonal Price, every five
  minutes; it replaced the HOEP with the Market Renewal of May 2025),
  `RealtimeTotals` (Ontario demand, every five minutes) and
  `GenOutputCapability` (hourly output of each generator, published about a
  quarter of an hour after the hour). Only the current files are read, never
  the directory index.
- Pace: the price and the demand every five minutes, the generators once per
  new hour (retried every ten minutes until it is there). Nothing is read
  while the device is not added, no threshold is set and no dashboard shows
  the widget.
- The mix covers the **transmission-connected** generators: imports and the
  small generators connected to local networks (most rooftop solar) are not
  in it.
- The CO₂ intensity is an **estimate** from the mix, with median life-cycle
  factors (IPCC 2014): nuclear 12, hydro 24, wind 11, solar 45, biofuel 230,
  gas 490, other 700 g/kWh.
- The IESO market runs on Eastern Standard Time all year: the integration
  converts it, including during summer time.
- A figure older than 30 minutes (price, demand) or 3 hours (mix) is not
  published: better no value than a stale one. A value that does not change
  is sent again every 6 hours.
- The public reports need no key and the IESO states no request quota for
  them: they are still read only at the pace they are published, with an
  honest User-Agent.

## Troubleshooting

- **Status "cannot be read"** in the configuration: the IESO reports are
  unreachable or in maintenance. The integration retries on its own.
- **No value on the device**: add the device in the Discover tab, then wait
  a minute, or run the test action.
- **Logs**: one line when a failure starts and one when it ends. For
  details, set `LOG_LEVEL=debug`.

## Credits

Data: [IESO](https://www.ieso.ca/power-data), public reports. Emission
factors: IPCC AR5 (2014), as used by Electricity Maps. Integration by guim31,
not affiliated with the IESO.
