import type { EntityMaster, PhaseTypeMaster, Sector } from '../types/estimation'
import { buildPhaseTypeCatalog } from '../phases/phaseTypes'

export const SECTOR_CATALOG: Sector[] = [
  { id: 'residential-buildings', name: 'Residential buildings' },
  { id: 'commercial-buildings', name: 'Commercial buildings' },
  { id: 'industrial-buildings', name: 'Industrial buildings' },
  { id: 'agricultural-buildings', name: 'Agricultural buildings' },
  { id: 'other-buildings', name: 'Other buildings' },
]

export async function getSectors(): Promise<Sector[]> {
  return SECTOR_CATALOG
}

export async function getEntities(sectorId: string): Promise<EntityMaster[]> {
  if (SECTOR_CATALOG.some((sector) => sector.id === sectorId)) {
    return [
      { id: 'ecl', code: 'ECL', sectorId },
      { id: 'mdo', code: 'MDO', sectorId },
    ]
  }
  return []
}

export async function getPhaseTypes(): Promise<PhaseTypeMaster[]> {
  return buildPhaseTypeCatalog()
}
