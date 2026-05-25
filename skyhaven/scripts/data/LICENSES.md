# Data licenses

## airports.csv

Source: **OurAirports** by David Megginson
- URL: https://ourairports.com/data/
- Mirror: https://github.com/davidmegginson/ourairports-data
- License: **Public Domain (CC0)** — https://creativecommons.org/publicdomain/zero/1.0/

This file is not committed to source control (gitignored). It is the input
to `scripts/build-airports.mjs` which produces the derived
`app/src/data/airports.top.json` and `airports.full.json`. The derived
files inherit the CC0 license.

To refresh:

```
curl -sSL -o scripts/data/airports.csv https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv
node scripts/build-airports.mjs
```
