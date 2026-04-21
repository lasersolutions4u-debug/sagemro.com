# Worker 测试

## 单元测试（纯函数，离线运行）

覆盖 `src/lib/auth.js` 中的密码哈希、JWT 签发/验证、Base64URL 编解码等安全敏感函数。

```bash
cd worker
node --test tests/auth.test.mjs
# 或：
npm test
```

**断言覆盖：**
- `generateSalt` 随机性与格式
- `hashPasswordNew` PBKDF2 确定性、盐敏感性
- `hashPasswordLegacy` 对历史用户哈希的稳定性（锁死算法，防止改动打穿历史账号）
- `verifyPassword` 新旧算法分支兼容
- `signJwt` / `verifyJwt` 成功往返、错误 secret 拒绝、过期 token 拒绝、篡改 payload 拒绝
- JWT 安全守卫：secret 为空或 < 16 字符时 `signJwt` 抛异常、`verifyJwt` 直接返回 null

## 冒烟测试（端到端，需要网络）

面向已部署的 Worker API，覆盖 `test-roles.sh` 之外的安全硬化项：CORS、认证强制、输入校验、限流、IDOR 防护。

```bash
API_BASE=https://sagemro-api.lasersolutions4u.workers.dev node tests/smoke.mjs
# 或带 IDOR 检查（需要准备好真实 token）：
API_BASE=... SMOKE_CUST_TOKEN=... SMOKE_OTHER_ORDER_ID=... node tests/smoke.mjs
```

**上线前检查清单（smoke.mjs 自动跑）：**
1. OPTIONS 预检返回 CORS 头
2. 未知路径 404
3. 受保护接口无 token → 401
4. 伪造 token 被拒
5. 非法手机号、空 body 被输入校验拦截
6. 验证码发送 60 秒内重复请求触发 429
7. (可选) 客户不能越权访问/评价他人工单

## 与 test-roles.sh 的分工

| 脚本 | 目标 | 场景 |
|------|------|------|
| `tests/auth.test.mjs` | 单元，离线 | 纯函数正确性、回归防护 |
| `tests/smoke.mjs` | 集成，在线 | 安全硬化验证（CORS/认证/限流/IDOR） |
| `test-roles.sh` | 集成，在线 | AI 对话分层 role prompt、业务流（需要管理员 token） |
