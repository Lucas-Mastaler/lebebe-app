# Le Bébé App — Notes for Agents

## Procurar-datas: freight and initial minimum value

### Backend distance and fare calculation
When working on the `/procurar-datas` freight flow, keep in mind that the backend:

- Resolves destination coordinates from the modal `lat`/`lng` or geocodes by CEP.
- Computes `distKm` via `getDrivingKm` (OSRM first, Haversine fallback).
- Calculates fare with `calcularFrete` and applies the `ajustar` +20% adjustment.

### Current frontend "VALOR INICIAL" behavior
The "Procurar datas de entrega" modal currently shows `VALOR INICIAL` using:

- Base week fare
- Rural surcharge
- Condominium surcharge
- +20% adjustment
- Rounding

It does **not** use distance. The real backend fare uses `calcularFrete(distKm, isSat, isRural, isCondominio)` with OSRM distance and type-specific adjustments.

### Pending requirement
The modal should compute the initial minimum value using the actual destination distance (the destination address/coordinates are already available) instead of the static estimate. The flow must be kept intact and changes require careful planning before implementation.
