# CN 静态化：只留两个站点 + 联系页

目标：中国版退化为**静态可浏览 + 联系方式**，不再依赖构建产物、不再写数据库，
从而彻底消除「CN 与 EN 共用构建链路」带来的一切传导风险。

## 现状（2026-09-17 核实）

| 项 | 现状 |
| --- | --- |
| nginx 配置 | **只在阿里云 ECS 上**，不在本仓库、也不由 workflow 管理（workflow 只构建产物 + 切符号链接 + `nginx -t && reload`） |
| `sagemro.cn` 指向 CN 子站的按钮 | 仅 2 个：`ai.sagemro.cn/service-request?mode=assist` 与 `?mode=manual` |
| CN 站是否有 `/contact` | **没有**（站内只有 `/services/`、`/brands/`、`/tools/`、`/insights/`） |
| CN D1 | 存在，2.1 MB，含少量数据（3 工单 / 1 客户 / 1 线索 / 2 工程师 / 78 对话 / 23 次 AI 调用），`admin_staff_accounts` 为 0 |

## 本目录文件

- `contact.html` — 自包含的中文联系页（无依赖、移动端优先）。
  - 电话：`186 1558 4520`（`tel:+8618615584520`），已填写。
  - 邮箱：`support@sagemro.com`，已填写。
  - 微信：`wechat-qr.png`，从对方提供的**企业微信名片**中**只裁出二维码本身**
    （不把含个人照片的整张名片提交进仓库）。裁切后 306×306、四角定位完整、白边充足。
  - 页内引用路径是 `/static/wechat-qr.png`（绝对路径），因此需要下面第 2 步里的 `/static/` 映射。

## 落地步骤

### 1. 放静态文件（ECS 上执行，与发布目录解耦）

```bash
sudo mkdir -p /var/www/sagemro-cn/static
# 上传两个文件：contact.html 与 wechat-qr.png
sudo cp contact.html wechat-qr.png /var/www/sagemro-cn/static/
```

> 放在 `static/` 而不是 `current/frontend/`，是为了不被下一次 CN 发布覆盖。

### 2. nginx：给 `sagemro.cn` 增加联系页与静态资源映射

在 `sagemro.cn`（含 `www.sagemro.cn`）的 **443 server 块**内加：

```nginx
location = /contact {
    alias /var/www/sagemro-cn/static/contact.html;
    add_header Cache-Control "public, max-age=300";
}

# 联系页里的二维码等静态资源（页内引用 /static/wechat-qr.png）
location /static/ {
    alias /var/www/sagemro-cn/static/;
    add_header Cache-Control "public, max-age=300";
}
```

> 以后要换二维码，只需在服务器上替换 `/var/www/sagemro-cn/static/wechat-qr.png`，不必改 HTML。

### 3. nginx：退役三个子站（各自 443 server 块内）

```nginx
# ai.sagemro.cn / engineer.sagemro.cn / admin.sagemro.cn
return 301 https://sagemro.cn/contact;
```

把原来的 `root` / `try_files` / `location` 指令替换为上面的 `return`（HTTP 80 的跳转块保持不变）。

### 4. 校验与生效

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -sI https://ai.sagemro.cn/ | head -1          # 期望 301
curl -sI https://engineer.sagemro.cn/ | head -1    # 期望 301
curl -sI https://admin.sagemro.cn/ | head -1       # 期望 301
curl -s  https://sagemro.cn/contact | head -5      # 期望联系页内容
```

## 副作用与注意事项

- **CN 发布工作流的健康检查不会因此失败**：`aliyun-cn-deploy.yml` 用 `curl -fsS`，`-f` 只对 4xx/5xx 失败，301 视为成功。若将来要彻底移除这三个域名，需同步改该 workflow 的健康检查清单。
- **CN D1 不会立刻变为零写入**：`sagemro.cn` 仍由现有构建产物提供服务，若站点内仍有表单直连 `api.sagemro.cn`，会继续写入。要彻底停用需改 CN 前端——属于「以后有时间再优化」的范围。
- **D1 建议保留、不要删除**：成本为零，保留可随时恢复；删除不可逆。若确定要删，先跑一次备份工作流（`Production D1 Backup - COM and CN`）。
- **对英文站零影响**：以上全部是服务器侧 nginx 与一个静态文件，不触及 `frontend/`、`deploy.yml`、Worker 或任何 COM 资源。
