/**
 * 服务型业务的付款、取消与退款口径（单一来源）。
 *
 * 为什么单独一个文件：这套条款要出现在**两个地方**——服务条款（LegalModal）与
 * `/refund-policy/` 页面。两处各写一份，早晚会出现「条款说 30%、页面说 20%」这种
 * 自相矛盾，而这类矛盾在收款方审核里是致命的。所以数字与措辞在这里定义一次：
 * 服务条款按条引用（`${BILLING.en.deposit}`），退款政策页直接渲染。
 *
 * 口径必须与站内既有承诺一致：
 * - 服务的报价先于开工、逐项列明（service pages / about / contact 都在说这件事）；
 * - 我们不替代设备厂家的保修（各服务页的边界声明）；
 * - 没有线上收单，全部按发票走银行转账（Terms 4.4）。
 *
 * 🔴 以下比例与时限是**建议值**，由业务侧确认后才算生效条款：
 * 30% 预付 / 70% 验收后 14 天 / 排期前 7 天免费取消 / 48 小时改期 /
 * 5 个工作日评估 / 14 个工作日退款 / 30 天工艺保修 / 15 个工作日争议答复。
 * 改动只改本文件，服务条款与退款政策页会一起变。
 */

const EN = {
  currency: 'USD',
  billedBy: 'SAGEMRO LLC',
  // 政策版本与生效日：退款页上显示「Version 1.0 · effective …」，
  // 而不是拿构建日期（RELEASE_DATE）冒充生效日——后者每次部署都会变，对审核方毫无意义。
  version: '1.0',
  effective: '13 November 2026',

  // —— 服务条款 §4 引用 ——
  deposit: 'A deposit of 30% of the quoted service fee is payable before the visit is scheduled and mobilised. The deposit covers the engineer time and travel bookings itemised in the quotation.',
  balance: 'The remaining 70% is payable after the written acceptance report is issued, within 14 days of the invoice date. No other charge is added automatically.',
  cancellationSummary: 'Cancellation is tiered by how much has already been committed: before the visit is scheduled nothing is charged; after the deposit and more than 7 days before the confirmed date the deposit is refunded less documented non-recoverable costs; within 7 days, or after the engineer has departed, the deposit is retained; parts already confirmed with a supplier are not cancellable. The full table is published at /refund-policy/.',
  refundSummary: 'Refund requests are sent by email with the quotation or invoice number, assessed within 5 business days, and confirmed in writing with the calculation shown. Approved refunds are returned by the same method and in the same currency within 14 business days.',
  warrantyBoundaryTerms: 'SAGEMRO is an independent service provider. Nothing in these terms extends, replaces, transfers, or assumes the equipment maker\'s warranty. Where the maker\'s warranty still applies, the claim remains with the maker or its dealer; SAGEMRO can supply evidence but does not act as the maker\'s agent and cannot authorise a claim on its behalf.',

  // —— 退款政策页 ——
  page: {
    /**
     * 一页看全的四个数。审核方、客户、争议三方最常问的就这四个，
     * 但它们原先散落在六节正文里，手机上要滑三屏。这里单独成条，页面首屏直接渲染成卡片。
     * 值必须与下面各节一致——同文件，改一处即全改。
     */
    glance: [
      { label: 'Deposit', value: '30%', note: 'before scheduling and mobilisation' },
      { label: 'Balance', value: '70%', note: 'within 14 days of acceptance' },
      { label: 'Cancel before scheduling', value: 'No charge', note: 'nothing has been committed' },
      { label: 'Refund paid', value: '14 business days', note: 'same method and currency' },
    ],
    quote: {
      heading: 'Everything is quoted before it starts',
      body: 'Every engagement begins with an itemised written quotation: service scope, engineer-days, travel, parts, and the settlement basis. Nothing is invoiced before that quotation is accepted in writing. AI-generated estimates, the indicative ranges published on this site, and any figure given in conversation are references only — the quotation is the binding figure.',
    },
    deposit: {
      heading: 'Deposit and balance',
      body: 'Payment is split into two triggers only. There is no subscription, no card on file, and no automatic renewal.',
      items: [
        'Deposit — 30% of the quoted service fee, payable before the visit is scheduled and mobilised.',
        'Balance — the remaining 70%, payable after the written acceptance report is issued and within 14 days of the invoice date.',
        'Parts and exchange units are itemised on the quotation and invoiced with the balance unless the quotation states otherwise.',
        'Invoices for overseas work are issued in US dollars by SAGEMRO LLC. Work delivered inside China is invoiced in CNY by the Chinese operating company.',
        'Payment is made by bank transfer against the invoice. Card payment is processed by Stripe where the quotation or the payment link offers it; the card form is hosted by Stripe and SAGEMRO does not receive or store card details.',
      ],
    },
    customerCancellation: {
      heading: 'Cancellation by the customer',
      body: 'A cancellation is charged according to what has already been committed at the moment it is received in writing. Nothing is charged on a guess.',
      items: [
        'Before the visit is scheduled — no charge; nothing has been committed.',
        'After the deposit, more than 7 days before the confirmed date — the deposit is refunded, less documented non-recoverable costs already committed (visa fees, ticketed travel, ordered parts). Where no cost has been committed, it is refunded in full.',
        'Within 7 days of the confirmed date, or after the engineer has departed — the deposit is retained, because the engineer time and travel can no longer be released.',
        'Parts already confirmed with a supplier — not cancellable once the part number and lead time are confirmed in writing. The part is shipped, or held for the customer if shipping has not started.',
        'Site not ready or no access on arrival — treated as mobilised. One reschedule is offered at no charge where notice is given at least 48 hours before the confirmed date.',
      ],
    },
    ourCancellation: {
      heading: 'Cancellation by SAGEMRO',
      body: 'If SAGEMRO cannot deliver the work — visa refusal, no suitable engineer, or force majeure — any amount paid is refunded in full within 14 days, with no cancellation fee. Where the deposit was paid for parts that have already been ordered, those amounts are refunded on the same basis as soon as the supplier position is known.',
    },
    refunds: {
      heading: 'Refunds',
      body: 'A refund is a written process, not a discretionary reply.',
      items: [
        'Request it by email to support@sagemro.com with the quotation or invoice number and the reason.',
        'The request is assessed within 5 business days and the outcome is confirmed in writing, with the calculation shown.',
        'Approved refunds are returned by the same method and in the same currency as the original payment, within 14 business days of approval. Bank charges levied on the sender side are not refunded.',
        'Completed and accepted work is not refunded. A defect attributable to our work is corrected under the workmanship warranty instead.',
      ],
    },
    workmanship: {
      heading: 'Workmanship warranty',
      body: 'Where a defect in SAGEMRO\'s own work is reported in writing within 30 days of acceptance, the work is corrected at no charge, including the return visit where it is needed. The warranty covers our workmanship only; it does not cover parts supplied by a third party, damage caused by operation outside the machine maker\'s instructions, or a new fault unrelated to the original work.',
    },
    warrantyBoundary: {
      heading: 'The maker warranty is not replaced',
      body: 'SAGEMRO is an independent service provider.',
      items: [
        'Nothing in this policy extends, replaces, transfers, or assumes the equipment maker\'s warranty.',
        'Where the maker\'s warranty still applies, the claim remains with the maker or its dealer. SAGEMRO can supply evidence — photos, logs, the service report — but does not act as the maker\'s agent and cannot authorise a claim on its behalf.',
        'Parts supplied by SAGEMRO carry only the supplier warranty stated on the quotation. They do not create or extend a maker warranty.',
        'Work carried out on equipment that is still under a maker warranty may affect that warranty at the maker\'s discretion. Where SAGEMRO knows of that risk, it is stated in the quotation before work starts.',
      ],
    },
    dispute: {
      heading: 'If an invoice is disputed',
      body: 'Raise it in writing to support@sagemro.com before the due date, with the invoice number and the item in dispute. Both sides work to a written resolution within 15 business days. The governing law and venue are stated in the quotation or contract that covers the job.',
    },
  },
};

const ZH = {
  currency: 'CNY',
  billedBy: '济南钰峭机械有限公司',
  version: '1.0',
  effective: '2026 年 11 月 13 日',

  deposit: '签订书面报价后、排期与出发前，需支付报价服务费的 30% 作为预付款。预付款对应报价中列明的工程师工时与差旅预订。',
  balance: '验收报告出具后支付剩余 70%，账期为发票日期起 14 天内。不自动增加任何其他费用。',
  cancellationSummary: '取消按「已经实际投入了多少」分档：尚未排期不收费；已付预付款且距确认日期 7 天以上，扣除已实际发生且无法退回的费用后退还；距确认日期 7 天内或工程师已出发，预付款不予退还；已向供应商确认的备件不可取消。完整分档见 /refund-policy/。',
  refundSummary: '退款申请通过邮件提交并附报价单或发票编号，5 个工作日内完成评估并书面回复计算过程。批准的退款按原路径、原币种在 14 个工作日内退回。',
  warrantyBoundaryTerms: 'SAGEMRO 是独立服务方。本条款不延长、不替代、不承接设备厂家的保修义务。设备仍在厂家保修期内时，索赔仍由厂家或其经销商受理；SAGEMRO 可提供证据，但不作为厂家的代理人，也无权代为确认索赔。',

  page: {
    glance: [
      { label: '预付款', value: '30%', note: '排期与出发前支付' },
      { label: '尾款', value: '70%', note: '验收后 14 天内' },
      { label: '排期前取消', value: '不收费', note: '此时没有任何投入' },
      { label: '退款到账', value: '14 个工作日', note: '原路径、原币种' },
    ],
    quote: {
      heading: '先报价，后开工',
      body: '每一项服务都从书面、逐项的报价开始：服务范围、工程师工日、差旅、备件与结算方式都会列明。报价经书面确认前不产生费用。AI 估算、站内公布的参考区间，以及沟通过程中提到的任何数字都只是参考，以报价单为准。',
    },
    deposit: {
      heading: '预付款与尾款',
      body: '付款只有两个触发点，没有订阅、不预存卡号、不自动续费。',
      items: [
        '预付款 —— 报价服务费的 30%，在排期与出发前支付。',
        '尾款 —— 剩余 70%，在验收报告出具后、发票日期起 14 天内支付。',
        '备件与交换件在报价中逐项列明，除报价另有约定外与尾款一并开票。',
        '海外业务由境外主体以美元开票；中国境内业务由济南钰峭机械有限公司以人民币开票，具体主体在报价单中写明。',
        '款项按发票以银行转账支付；如报价或付款链接提供刷卡，刷卡由 Stripe 处理，卡信息由 Stripe 托管，SAGEMRO 不接收也不保存卡号。',
      ],
    },
    customerCancellation: {
      heading: '客户取消',
      body: '取消费用按收到书面取消时「已经实际投入」的部分计算，不按估计收费。',
      items: [
        '尚未排期 —— 不收费，此时没有任何投入。',
        '已付预付款、距确认日期 7 天以上 —— 扣除已实际发生且无法退回的费用（签证费、已出票差旅、已下单备件）后退还预付款；若尚未发生费用，全额退还。',
        '距确认日期 7 天以内，或工程师已出发 —— 预付款不予退还，因为工时与差旅已无法释放。',
        '已向供应商确认的备件 —— 零件号与货期书面确认后不可取消。备件照常发货；尚未发货的可为客户暂存。',
        '到场后现场未就绪或无法进入 —— 视为已出发。在确认日期前 48 小时以上书面通知的，可免费改期一次。',
      ],
    },
    ourCancellation: {
      heading: 'SAGEMRO 取消',
      body: '因我方原因无法交付 —— 签证被拒、没有匹配的工程师、不可抗力 —— 已收款项在 14 天内全额退还，不收任何取消费。若预付款已用于订货，则该部分在与供应商核实后按同一口径退还。',
    },
    refunds: {
      heading: '退款',
      body: '退款是一个书面流程，不是一句口头答复。',
      items: [
        '通过 support@sagemro.com 提交，附报价单或发票编号及退款原因。',
        '5 个工作日内完成评估，并书面回复结果与计算过程。',
        '批准的退款按原支付路径、原币种，在批准后 14 个工作日内退回。付款方银行收取的手续费不在退还范围内。',
        '已完成并验收的工作不退款；属于我方工艺缺陷的，按工艺保修返修处理。',
      ],
    },
    workmanship: {
      heading: '工艺保修',
      body: '验收后 30 天内以书面提出的、属于 SAGEMRO 自身工艺的缺陷，免费返修，需要时包含返场。工艺保修只覆盖我方工艺，不覆盖第三方提供的备件、违反设备厂家说明操作造成的损坏，以及与本次工作无关的新故障。',
    },
    warrantyBoundary: {
      heading: '不替代原厂保修',
      body: 'SAGEMRO 是独立服务方。',
      items: [
        '本政策不延长、不替代、不转移、不承接设备厂家的保修义务。',
        '设备仍在厂家保修期内时，索赔仍由厂家或其经销商受理。SAGEMRO 可提供照片、日志、服务报告等证据，但不作为厂家的代理人，也无权代为确认索赔。',
        'SAGEMRO 供应的备件仅带报价单上写明的供应商保修，不构成也不延长厂家保修。',
        '在仍处于厂家保修期内的设备上施工，可能影响该保修，最终由厂家认定。SAGEMRO 在知情时会在开工前于报价中写明这一风险。',
      ],
    },
    dispute: {
      heading: '发票争议',
      body: '请在到期日前以书面形式发送至 support@sagemro.com，注明发票编号与争议项。双方在 15 个工作日内书面答复并推动解决。适用法律与管辖以该项目报价单或合同中的约定为准。',
    },
  },
};

export const SERVICE_BILLING = { en: EN, 'zh-CN': ZH };

/** 按语言取整套付款/取消/退款口径。 */
export function getServiceBilling(locale) {
  return SERVICE_BILLING[locale === 'zh-CN' ? 'zh-CN' : 'en'];
}
