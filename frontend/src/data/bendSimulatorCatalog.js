export const bendSimulatorCatalog = {
  materials: {
    carbon_steel: { id: 'carbon_steel', labelKey: 'material.carbon_steel', label: 'Carbon steel', labels: { en: 'Carbon steel', zh: '碳钢' }, materialFactor: 1, kFactor: 0.38, recommendedVMultiplier: 8 },
    stainless_steel: { id: 'stainless_steel', labelKey: 'material.stainless_steel', label: 'Stainless steel', labels: { en: 'Stainless steel', zh: '不锈钢' }, materialFactor: 1.5, kFactor: 0.4, recommendedVMultiplier: 10 },
    aluminum: { id: 'aluminum', labelKey: 'material.aluminum', label: 'Aluminum', labels: { en: 'Aluminum', zh: '铝' }, materialFactor: 0.65, kFactor: 0.36, recommendedVMultiplier: 8 },
    brass: { id: 'brass', labelKey: 'material.brass', label: 'Brass', labels: { en: 'Brass', zh: '黄铜' }, materialFactor: 1.1, kFactor: 0.38, recommendedVMultiplier: 8 },
    copper: { id: 'copper', labelKey: 'material.copper', label: 'Copper', labels: { en: 'Copper', zh: '铜' }, materialFactor: 1.25, kFactor: 0.4, recommendedVMultiplier: 10 },
  },
  machines: [
    { id: 'shop-50', labelKey: 'machine.shop-50', label: '50 ton press brake', labels: { en: '50 ton press brake', zh: '50 吨通用折弯机' }, capacityTons: 50, bedLengthMm: 2000, minThicknessMm: 0.5, maxThicknessMm: 8, toolInterface: 'euro' },
    { id: 'shop-100', labelKey: 'machine.shop-100', label: '100 ton press brake', labels: { en: '100 ton press brake', zh: '100 吨通用折弯机' }, capacityTons: 100, bedLengthMm: 3000, minThicknessMm: 0.5, maxThicknessMm: 10, toolInterface: 'euro' },
    { id: 'shop-200', labelKey: 'machine.shop-200', label: '200 ton press brake', labels: { en: '200 ton press brake', zh: '200 吨通用折弯机' }, capacityTons: 200, bedLengthMm: 4000, minThicknessMm: 0.5, maxThicknessMm: 12, toolInterface: 'euro' },
  ],
  upperTools: [
    { id: 'acute-punch', labelKey: 'upper.acute-punch', label: 'Acute punch', labels: { en: 'Acute punch', zh: '锐角上模' }, tipRadiusMm: 0.5, minThicknessMm: 0.5, maxThicknessMm: 8, minIncludedAngleDeg: 30, maxIncludedAngleDeg: 180, interfaceTypes: ['euro'] },
    { id: 'standard-punch', labelKey: 'upper.standard-punch', label: 'Standard punch', labels: { en: 'Standard punch', zh: '标准上模' }, tipRadiusMm: 1, minThicknessMm: 0.5, maxThicknessMm: 12, minIncludedAngleDeg: 88, maxIncludedAngleDeg: 180, interfaceTypes: ['euro'] },
    { id: 'gooseneck-punch', labelKey: 'upper.gooseneck-punch', label: 'Gooseneck punch', labels: { en: 'Gooseneck punch', zh: '鹅颈上模' }, tipRadiusMm: 1, minThicknessMm: 0.5, maxThicknessMm: 8, minIncludedAngleDeg: 88, maxIncludedAngleDeg: 180, interfaceTypes: ['euro'] },
  ],
  lowerTools: [
    { id: 'v-die-6', labelKey: 'lower.v-die-6', label: 'V die 6 mm', labels: { en: 'V die 6 mm', zh: 'V 槽 6 毫米' }, vOpeningMm: 6, minThicknessMm: 0.5, maxThicknessMm: 1.2, minIncludedAngleDeg: 30, maxIncludedAngleDeg: 180, interfaceTypes: ['euro'] },
    { id: 'v-die-8', labelKey: 'lower.v-die-8', label: 'V die 8 mm', labels: { en: 'V die 8 mm', zh: 'V 槽 8 毫米' }, vOpeningMm: 8, minThicknessMm: 0.5, maxThicknessMm: 1.5, minIncludedAngleDeg: 30, maxIncludedAngleDeg: 180, interfaceTypes: ['euro'] },
    { id: 'v-die-12', labelKey: 'lower.v-die-12', label: 'V die 12 mm', labels: { en: 'V die 12 mm', zh: 'V 槽 12 毫米' }, vOpeningMm: 12, minThicknessMm: 1, maxThicknessMm: 2, minIncludedAngleDeg: 30, maxIncludedAngleDeg: 180, interfaceTypes: ['euro'] },
    { id: 'v-die-16', labelKey: 'lower.v-die-16', label: 'V die 16 mm', labels: { en: 'V die 16 mm', zh: 'V 槽 16 毫米' }, vOpeningMm: 16, minThicknessMm: 1.2, maxThicknessMm: 2.5, minIncludedAngleDeg: 30, maxIncludedAngleDeg: 180, interfaceTypes: ['euro'] },
    { id: 'v-die-24', labelKey: 'lower.v-die-24', label: 'V die 24 mm', labels: { en: 'V die 24 mm', zh: 'V 槽 24 毫米' }, vOpeningMm: 24, minThicknessMm: 2, maxThicknessMm: 4, minIncludedAngleDeg: 30, maxIncludedAngleDeg: 180, interfaceTypes: ['euro'] },
    { id: 'v-die-32', labelKey: 'lower.v-die-32', label: 'V die 32 mm', labels: { en: 'V die 32 mm', zh: 'V 槽 32 毫米' }, vOpeningMm: 32, minThicknessMm: 3, maxThicknessMm: 5, minIncludedAngleDeg: 30, maxIncludedAngleDeg: 180, interfaceTypes: ['euro'] },
    { id: 'v-die-40', labelKey: 'lower.v-die-40', label: 'V die 40 mm', labels: { en: 'V die 40 mm', zh: 'V 槽 40 毫米' }, vOpeningMm: 40, minThicknessMm: 4, maxThicknessMm: 6, minIncludedAngleDeg: 30, maxIncludedAngleDeg: 180, interfaceTypes: ['euro'] },
    { id: 'v-die-48', labelKey: 'lower.v-die-48', label: 'V die 48 mm', labels: { en: 'V die 48 mm', zh: 'V 槽 48 毫米' }, vOpeningMm: 48, minThicknessMm: 5, maxThicknessMm: 8, minIncludedAngleDeg: 30, maxIncludedAngleDeg: 180, interfaceTypes: ['euro'] },
    { id: 'v-die-64', labelKey: 'lower.v-die-64', label: 'V die 64 mm', labels: { en: 'V die 64 mm', zh: 'V 槽 64 毫米' }, vOpeningMm: 64, minThicknessMm: 6, maxThicknessMm: 10, minIncludedAngleDeg: 30, maxIncludedAngleDeg: 180, interfaceTypes: ['euro'] },
  ],
};

export const bendMaterials = bendSimulatorCatalog.materials;
export const bendMachines = bendSimulatorCatalog.machines;
export const bendUpperTools = bendSimulatorCatalog.upperTools;
export const bendLowerTools = bendSimulatorCatalog.lowerTools;
