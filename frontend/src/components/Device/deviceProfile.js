function normalizeDeviceField(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s\-_./]+/g, '');
}

export function findMatchingDevice(devices, candidate) {
  const candidateType = normalizeDeviceField(candidate?.type);
  if (!candidateType) return null;

  const identityFields = ['brand', 'model', 'name', 'power']
    .filter((field) => normalizeDeviceField(candidate?.[field]));
  if (identityFields.length === 0) return null;

  return (devices || []).find((device) => {
    if (normalizeDeviceField(device?.type) !== candidateType) return false;
    return identityFields.every((field) => (
      normalizeDeviceField(device?.[field]) === normalizeDeviceField(candidate?.[field])
    ));
  }) || null;
}
