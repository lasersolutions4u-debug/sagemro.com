import { ServiceRequestFlow } from '../ServiceRequest/ServiceRequestFlow';
import { Modal } from '../common/Modal';
import { uploadWorkOrderAttachment } from '../../services/api';
import { toastError, toastSuccess } from '../../utils/feedback';
import { isCnLocale } from '../../utils/locale';

function toLegacyWorkOrderForm(payload) {
  const intake = payload.intake || {};
  const contact = intake.contact || {};
  return {
    ...payload,
    service_mode: payload.service_mode,
    service_address: payload.service_address,
    service_latitude: payload.service_latitude,
    service_longitude: payload.service_longitude,
    service_accuracy_m: payload.service_accuracy_m,
    service_coordinate_system: payload.service_coordinate_system,
    service_location_source: payload.service_location_source,
    service_request_kind: intake.service_request_kind,
    device_type: intake.device_types || [],
    device_brand: intake.device_brands || [],
    device_model: intake.device_model || '',
    region: intake.region || [],
    alarm_code: intake.alarm_code || '',
    production_impact: intake.production_impact || '',
    contact_name: contact.name || '',
    contact_email: contact.email || '',
    contact_phone: contact.phone || '',
    contact_whatsapp: contact.whatsapp || '',
    contact_preference: contact.preference || 'platform',
    contact: contact.email || contact.phone || contact.whatsapp || '',
  };
}

export function WorkOrderModal({ isOpen, onClose, onSubmit }) {
  const isCn = isCnLocale();

  const handleCompatibleSubmit = async (payload, files) => {
    const result = await onSubmit(toLegacyWorkOrderForm(payload));
    let uploaded = 0;
    for (const file of files) {
      try {
        await uploadWorkOrderAttachment(result.id, file);
        uploaded += 1;
      } catch (error) {
        toastError(isCn
          ? `附件 ${file.name} 上传失败：${error.message}`
          : `Attachment ${file.name} upload failed: ${error.message}`);
      }
    }
    if (uploaded > 0) {
      toastSuccess(isCn ? `已上传 ${uploaded} 个附件` : `${uploaded} attachment(s) uploaded`);
    }
    return result;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCn ? '请求 SAGEMRO 服务支持' : 'Request SAGEMRO service support'}
      size="2xl"
    >
      <ServiceRequestFlow
        onSubmit={async (payload, files) => handleCompatibleSubmit(payload, files)}
        onCancel={onClose}
        compact
      />
    </Modal>
  );
}
