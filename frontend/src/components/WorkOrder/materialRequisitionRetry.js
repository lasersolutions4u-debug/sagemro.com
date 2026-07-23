export function getMaterialRequisitionRetryOperation(current, payload, createKey) {
  const fingerprint = JSON.stringify(payload);
  return current?.fingerprint === fingerprint
    ? current
    : { fingerprint, key: createKey() };
}

export function shouldPreserveReceiptRetryKey(error) {
  const status = Number(error?.status);
  if (!Number.isInteger(status)) return true;
  if (status === 408 || status === 429 || status >= 500) return true;
  return status < 400 || status >= 500;
}
