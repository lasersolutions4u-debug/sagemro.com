export function createWorkOrderRequestIdentity(sequence, workOrderId) {
  return {
    sequence,
    workOrderId: workOrderId == null ? null : String(workOrderId),
  };
}

export function isCurrentWorkOrderRequest(identity, currentIdentity) {
  return identity.sequence === currentIdentity.sequence
    && identity.workOrderId === currentIdentity.workOrderId;
}

export async function runCurrentWorkOrderRequest({
  identity,
  getCurrentIdentity,
  load,
  onSuccess,
  onError,
  throwOnError = false,
}) {
  try {
    const value = await load();
    if (!isCurrentWorkOrderRequest(identity, getCurrentIdentity())) return false;
    await onSuccess(value);
    return isCurrentWorkOrderRequest(identity, getCurrentIdentity());
  } catch (error) {
    if (!isCurrentWorkOrderRequest(identity, getCurrentIdentity())) return false;
    onError?.(error);
    if (throwOnError) throw error;
    return false;
  }
}
