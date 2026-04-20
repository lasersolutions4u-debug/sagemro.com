#!/bin/bash
# 小智 Role Prompt 分层测试脚本
# 用法: bash test-roles.sh
# 测试三种用户身份：游客 / 客户 / 合伙人

API_BASE="https://sagemro-api.lasersolutions4u.workers.dev"
ADMIN_PHONE="13800000000"
ADMIN_PASSWORD="sagemro2026"

echo "========================================="
echo "小智 Role Prompt 分层测试 $(date)"
echo "========================================="

# 颜色输出
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

# 1. Admin 登录获取 token（用于访问测试接口）
echo ""
echo ">>> Step 0: 管理员登录..."
ADMIN_RESP=$(curl -s --max-time 20 -X POST "$API_BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$ADMIN_PHONE\",\"password\":\"$ADMIN_PASSWORD\"}")

ADMIN_TOKEN=$(echo "$ADMIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)
if [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}管理员登录失败: $ADMIN_RESP${NC}"
else
  echo -e "${GREEN}管理员登录成功${NC}"
fi

# 2. 初始化测试数据（需要 admin token）
echo ""
echo ">>> Step 1: 初始化测试数据..."
INIT_RESP=$(curl -s --max-time 30 "$API_BASE/api/init-test-data" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "初始化: $INIT_RESP"

# 3. 客户登录
echo ""
echo ">>> Step 2: 客户登录..."
CUST_RESP=$(curl -s --max-time 20 -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phone":"13900001001","password":"test1234"}')

CUST_TOKEN=$(echo "$CUST_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)
CUST_ID=$(echo "$CUST_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); u=d.get('user',{}); print(u.get('id',''))" 2>/dev/null)
echo "客户 Token: ${CUST_TOKEN:0:30}..."
echo "客户 ID: $CUST_ID"

# 4. 合伙人登录
echo ""
echo ">>> Step 3: 合伙人登录..."
ENG_RESP=$(curl -s --max-time 20 -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phone":"13900011001","password":"test1234"}')

ENG_TOKEN=$(echo "$ENG_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)
ENG_ID=$(echo "$ENG_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); u=d.get('user',{}); print(u.get('id',''))" 2>/dev/null)
echo "合伙人 Token: ${ENG_TOKEN:0:30}..."
echo "合伙人 ID: $ENG_ID"

echo ""
echo "========================================="
echo "测试 Chat API — 三种用户身份"
echo "========================================="

# 发送测试消息（等待 AI 回复）
send_chat() {
  local label=$1
  local payload=$2
  echo ""
  echo -e "${YELLOW}--- $label ---${NC}"
  echo "Payload: $payload"

  RESP=$(curl -s --max-time 60 -X POST "$API_BASE/api/chat" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>&1)

  LEN=${#RESP}
  echo "响应长度: $LEN bytes"

  if [ $LEN -eq 0 ]; then
    echo -e "${RED}无响应（可能超时或连接问题）${NC}"
  elif [ $LEN -lt 100 ]; then
    echo "响应内容: $RESP"
  else
    # 打印 SSE 前 800 字符（截取 AI 回答开头）
    echo "$RESP" | head -c 800
    echo "..."
  fi
  echo ""
}

# Test 1: 游客（无 auth，无 user_type）— 应使用 guest Role，无上下文
echo -e "${GREEN}>>> Test 1: 游客身份${NC}"
send_chat "游客（无 user_type）" '{"message":"激光切割机毛刺多怎么办？"}'

# Test 2: 客户（user_type=customer，无 customer_id）— 应降级为 guest
echo -e "${GREEN}>>> Test 2: customer 身份但无 ID${NC}"
send_chat "customer 但无 ID" '{"message":"我设备坏了","user_type":"customer"}'

# Test 3: 客户（完整）— 应使用 customer Role + 上下文
echo -e "${GREEN}>>> Test 3: 客户完整身份${NC}"
send_chat "客户（user_type=customer）" \
  "{\"message\":\"我有一台大族激光切割机，最近切割质量不好\",\"customer_id\":\"$CUST_ID\",\"user_type\":\"customer\"}"

# Test 4: 客户问设备相关（应结合上下文）
echo -e "${GREEN}>>> Test 4: 客户带上下文问设备${NC}"
send_chat "客户带上下文（登录状态）" \
  "{\"message\":\"我那台设备最近怎么样？\",\"customer_id\":\"$CUST_ID\",\"user_type\":\"customer\"}"

# Test 5: 客户问价格（不应看到合伙人信息）
echo -e "${GREEN}>>> Test 5: 客户问价格${NC}"
send_chat "客户问价格" \
  "{\"message\":\"这个维修大概要花多少钱？\",\"customer_id\":\"CUST_ID\",\"user_type\":\"customer\"}"

# Test 6: 合伙人（user_type=engineer，无 engineer_id）— 应降级为 guest
echo -e "${GREEN}>>> Test 6: engineer 身份但无 ID${NC}"
send_chat "engineer 但无 ID" '{"message":"我今天想接单","user_type":"engineer"}'

# Test 7: 合伙人完整身份 — 应使用 engineer Role + 上下文
echo -e "${GREEN}>>> Test 7: 合伙人完整身份${NC}"
send_chat "合伙人（user_type=engineer）" \
  "{\"message\":\"我今天有什么新工单吗？\",\"engineer_id\":\"$ENG_ID\",\"user_type\":\"engineer\"}"

# Test 8: 合伙人问如何报价 — 应触发报价辅助
echo -e "${GREEN}>>> Test 8: 合伙人问报价${NC}"
send_chat "合伙人问报价" \
  "{\"message\":\"一台大族激光切割机激光器坏了，我应该怎么报价？\",\"engineer_id\":\"$ENG_ID\",\"user_type\":\"engineer\"}"

# Test 9: 游客问技术问题 — 应引导注册
echo -e "${GREEN}>>> Test 9: 游客问技术问题${NC}"
send_chat "游客问技术（应引导注册）" \
  '{"message":"折弯机角度不准怎么调整？","user_type":"guest"}'

# Test 10: 合伙人问自己的状态
echo -e "${GREEN}>>> Test 10: 合伙人问自己状态${NC}"
send_chat "合伙人问自己的工单和钱包" \
  "{\"message\":\"我现在有几个工单？钱包有多少钱？\",\"engineer_id\":\"$ENG_ID\",\"user_type\":\"engineer\"}"

echo ""
echo "========================================="
echo "测试 API 接口（非 Chat）"
echo "========================================="

# Test 11: 客户获取自己的工单
echo -e "${GREEN}>>> Test 11: 客户工单列表${NC}"
TICKETS=$(curl -s --max-time 20 "$API_BASE/api/workorders?customer_id=$CUST_ID" \
  -H "Authorization: Bearer $CUST_TOKEN")
echo "工单数: $(echo $TICKETS | grep -o '"id"' | wc -l)"

# Test 12: 合伙人获取自己的工单
echo -e "${GREEN}>>> Test 12: 合伙人工单列表${NC}"
ENG_TICKETS=$(curl -s --max-time 20 "$API_BASE/api/engineers/tickets" \
  -H "Authorization: Bearer $ENG_TOKEN")
echo "工单数: $(echo $ENG_TICKETS | grep -o '"id"' | wc -l)"

# Test 13: 合伙人钱包
echo -e "${GREEN}>>> Test 13: 合伙人钱包${NC}"
WALLET=$(curl -s --max-time 20 "$API_BASE/api/engineers/wallet" \
  -H "Authorization: Bearer $ENG_TOKEN")
echo "钱包: $WALLET"

# Test 14: 合伙人档案
echo -e "${GREEN}>>> Test 14: 合伙人档案${NC}"
PROFILE=$(curl -s --max-time 20 "$API_BASE/api/engineers/profile?engineer_id=$ENG_ID" \
  -H "Authorization: Bearer $ENG_TOKEN")
echo "档案: $PROFILE"

echo ""
echo "========================================="
echo "测试完成"
echo "========================================="
