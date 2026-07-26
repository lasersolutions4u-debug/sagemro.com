export function createLatestWorkOrderTitleSaveRunner() {
  const latestSaveByWorkOrder = new Map();

  return async function runLatestSave(workOrderId, save, apply, applyError) {
    const saveToken = Symbol('title-save');
    latestSaveByWorkOrder.set(workOrderId, saveToken);
    try {
      const value = await save();
      if (latestSaveByWorkOrder.get(workOrderId) !== saveToken) return;
      apply(value);
    } catch (error) {
      if (latestSaveByWorkOrder.get(workOrderId) !== saveToken) return;
      applyError(error);
    } finally {
      if (latestSaveByWorkOrder.get(workOrderId) === saveToken) {
        latestSaveByWorkOrder.delete(workOrderId);
      }
    }
  };
}

export async function issueWorkOrderInvoice({ workOrderId, invoiceNumber, processInvoice }) {
  await processInvoice(workOrderId, {
    action: 'issue',
    invoice_number: invoiceNumber,
  });
  return { status: 'issued', invoice_number: invoiceNumber };
}
