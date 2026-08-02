export const bendSimulatorCatalog = {
  materials: {
    carbon_steel: { label: 'Carbon steel', materialFactor: 1, kFactor: 0.38, recommendedVMultiplier: 8 },
    stainless_steel: { label: 'Stainless steel', materialFactor: 1.5, kFactor: 0.4, recommendedVMultiplier: 10 },
    aluminum: { label: 'Aluminum', materialFactor: 0.65, kFactor: 0.36, recommendedVMultiplier: 8 },
    brass: { label: 'Brass', materialFactor: 1.1, kFactor: 0.38, recommendedVMultiplier: 8 },
    copper: { label: 'Copper', materialFactor: 1.25, kFactor: 0.4, recommendedVMultiplier: 10 },
  },
  machines: [
    { id: 'shop-50', label: '50 ton press brake', capacityTons: 50, bedLengthMm: 2000 },
    { id: 'shop-100', label: '100 ton press brake', capacityTons: 100, bedLengthMm: 3000 },
    { id: 'shop-200', label: '200 ton press brake', capacityTons: 200, bedLengthMm: 4000 },
  ],
  upperTools: [
    { id: 'acute-punch', label: 'Acute punch', minimumRadiusMultiplier: 0 },
    { id: 'standard-punch', label: 'Standard punch', minimumRadiusMultiplier: 1 },
    { id: 'gooseneck-punch', label: 'Gooseneck punch', minimumRadiusMultiplier: 1 },
  ],
  lowerTools: [
    { id: 'v-die-6', label: 'V die 6 mm', vOpeningMm: 6 },
    { id: 'v-die-8', label: 'V die 8 mm', vOpeningMm: 8 },
    { id: 'v-die-12', label: 'V die 12 mm', vOpeningMm: 12 },
    { id: 'v-die-16', label: 'V die 16 mm', vOpeningMm: 16 },
    { id: 'v-die-24', label: 'V die 24 mm', vOpeningMm: 24 },
    { id: 'v-die-32', label: 'V die 32 mm', vOpeningMm: 32 },
    { id: 'v-die-40', label: 'V die 40 mm', vOpeningMm: 40 },
    { id: 'v-die-48', label: 'V die 48 mm', vOpeningMm: 48 },
    { id: 'v-die-64', label: 'V die 64 mm', vOpeningMm: 64 },
  ],
};

export const bendMaterials = bendSimulatorCatalog.materials;
export const bendMachines = bendSimulatorCatalog.machines;
export const bendUpperTools = bendSimulatorCatalog.upperTools;
export const bendLowerTools = bendSimulatorCatalog.lowerTools;
