/**
 * 所有权守卫（ownership guards）
 *
 * 统一读路径越权校验，防止 IDOR。
 * 所有 assert* 函数在未通过时抛 GuardError；在 handler 中用 try/catch 返回 403。
 *
 * 设计约束：
 *   - 纯函数，不访问 DB / env；由调用方先查出资源对象再传入
 *   - admin 永远放行（运营后台需要）
 *   - 身份对比使用 auth._auth 形态（router 在 index.js L4787 注入）
 */

export class GuardError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.name = 'GuardError';
    this.status = status;
  }
}

/**
 * 工单访问权：admin / 工单客户 / 工单工程师
 *
 * @param {{userId: string, userType: string}} auth - request._auth
 * @param {{customer_id?: string, engineer_id?: string}} workOrder - 从 DB 查出的工单行
 */
export function assertWorkOrderAccess(auth, workOrder) {
  if (!auth) throw new GuardError('请先登录', 401);
  if (!workOrder) throw new GuardError('工单不存在', 404);
  if (auth.userType === 'admin') return;
  if (auth.userType === 'customer' && workOrder.customer_id === auth.userId) return;
  if (auth.userType === 'engineer' && workOrder.engineer_id === auth.userId) return;
  throw new GuardError('您无权访问该工单', 403);
}

/**
 * 对话访问权：admin / 会话客户
 *
 * 迁移 010 之后，conversations 表新增 customer_id 字段。
 * 历史遗留（customer_id IS NULL）的会话仅允许 admin 读，避免 IDOR。
 *
 * @param {{userId: string, userType: string}} auth
 * @param {{customer_id?: string}} conversation
 */
export function assertConversationAccess(auth, conversation) {
  if (!auth) throw new GuardError('请先登录', 401);
  if (!conversation) throw new GuardError('对话不存在', 404);
  if (auth.userType === 'admin') return;
  if (!conversation.customer_id) {
    throw new GuardError('历史会话不支持访问，请新建对话', 403);
  }
  if (auth.userType === 'customer' && conversation.customer_id === auth.userId) return;
  throw new GuardError('您无权访问该对话', 403);
}

/**
 * 仅工程师或管理员可访问（用于工程师私评客户等内部数据）
 */
export function assertEngineerOrAdmin(auth) {
  if (!auth) throw new GuardError('请先登录', 401);
  if (auth.userType === 'admin' || auth.userType === 'engineer') return;
  throw new GuardError('需要工程师权限', 403);
}

/**
 * 把 GuardError 转成统一的错误响应；非 GuardError 交由上层处理。
 *
 * @param {Error} err
 * @param {(msg: string, status: number) => Response} errorResponse
 * @returns {Response | null}
 */
export function guardErrorToResponse(err, errorResponse) {
  if (err instanceof GuardError) {
    return errorResponse(err.message, err.status);
  }
  return null;
}
