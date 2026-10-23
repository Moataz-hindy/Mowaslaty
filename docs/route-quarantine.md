# Exact route exclusions

The app hides 16 exact application direction IDs through the reversible policy in `src/utils/routePolicy.js`. The original JSON datasets are unchanged. Four IDs remain hidden pending verification or due to a dispute; 12 additional direction IDs were removed at the user's explicit preference after reviewing the Gemini report audit. That choice is not a finding that those services are fake, absent, private, or disproven. The audit documents evidence limits and historical service evidence.

## Original four holds

| Application direction ID | Status and basis |
| --- | --- |
| `P_O_14_GZ007_O` | Disputed, pending verification: Dandy Mall–Lebanon Square, based on an uncited community report. |
| `oacehl0X7OcJby1R4Oba0` | Disputed, pending verification: reverse Dandy Mall–Lebanon Square direction, based on the same uncited community report. |
| `P_O_14_IC038_O` | Pending exact-route verification: the [2023 public collective transport announcement](https://www.vetogate.com/4956553) conflicts with [Flydubai airport guidance](https://www.flydubai.com/ar-us/destinations/airports/sphinx-international-airport/). Neither source verifies this exact 14-seat direction or current operation. |
| `P_O_14_IC038_R` | Pending exact-route verification: same conflicting evidence; neither source verifies this exact reverse direction or current operation. |

## Twelve additional exclusions by user preference

| Reported service family | Excluded application direction IDs |
| --- | --- |
| Dar Salam–Ahmed Maher | `P_O_14_CA164_R`, `P_O_14_CA164_O` |
| Matbaa–Ahmed Maher | `ePNQk9H2GgQ-Cbow7POH4`, `TnxdfTNGoloPBPxsVd3z7` |
| Hadayek Metro–Qism El Hadayek | `duOxQcPZP8dTe9lKJ7r8r`, `Bdl1wVURvHT6n_Nao9mGM` |
| Smart Village–Mahwar/Desert Road | `P_O_14_IC005_R`, `P_O_14_IC005_O` |
| 10th District Nasr City–Madkhal El Shabab | `P_O_14_IC050_R`, `P_O_14_IC050_O` |
| New Marg–Agricultural Road (Qalyub Junction direction) | `rqv6KxE8qYSbJ-a4xcXsK` |
| New Marg–Agricultural Road (opposite direction) | `JCPiG-iikHSYZMr2lcfF2` |

These exclusions use application direction IDs only. Do not filter by route-family IDs or shared `route_id` values. In particular, `h2J_fjZiNjbt_8gzFSmzs` is also used by `T2r8Obs1qiEqRPcGqhAAW` (Smart Village–Lebanon), which remains available. The New Marg–Agricultural Road directions are opposite directions, not duplicate trips.

The four original holds remain temporary. The 2023 Sphinx announcement challenges a categorical “no public transport” claim, but an announcement is not proof that this exact microbus runs today. Flydubai's airport guidance likewise does not establish the absence of public service. TfC's [road transport data contributor page](https://portal.transport-data.org/%40tfc/tfc-cairo-gtfs-for-public-road-transport) describes fieldwork, on-board route traces, and validated passenger boarding/alighting locations for 2019–2023; that work does not verify every current service individually. Its [2018 factsheet](https://transportforcairo.com/wp-content/uploads/2019/07/Q42018_TfC_GCR_Data-Factsheet.pdf) distinguishes bus stops (boarding/alighting areas) from bus stations (physical infrastructure). Landmarks, stairs, and stop naming alone do not establish that a service is absent.

To restore any direction, remove only its exact key from `ROUTE_EXCLUSIONS` in `src/utils/routePolicy.js`. See the [row-by-row Gemini route audit](gemini-route-audit-2026-10-23.md) for evidence and limits. The report's “511 to 481” refers to route_id families, not microbus direction records; the local summary has 861 microbus direction records across 511 families. These counts do not establish that 481 routes are currently verified. This audit does not support a “verified 2026” count.
