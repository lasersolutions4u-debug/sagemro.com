# 站点临时关闭 / 全站维护开关

一个开关控制 COM 三个站点的页面级停机；CN 的四个站点由 ECS 上的 nginx 提供，用 `Pause or restore China sites` workflow（或同目录的脚本）暂停与恢复（见第三节）。

## 一眼看懂

| 站点 | 平台 | 关：怎么关 | 开：怎么开 |
| --- | --- | --- | --- |
| sagemro.com / www | Cloudflare Pages `sagemro-com` | push `main`（公开站无审批，测试通过即发） | 同左，改回开关 |
| ai.sagemro.com | Cloudflare Pages `sagemro-ai` | push `main` + 在 Actions 批准 `deploy-ai-frontend` | 同左 |
| admin.sagemro.com | Cloudflare Pages `sagemro-admin` | push `main` + 在 Actions 批准 `deploy-admin` | 同左 |
| sagemro.cn / www | 阿里云 ECS nginx | dispatch `Pause or restore China sites`（第三节） | 同一个 workflow 选 `restore` |
| ai / admin / engineer.sagemro.cn | 阿里云 ECS nginx | 同上 | 同上 |
| api.sagemro.com / api.sagemro.cn | 共享 Worker | Actions 手动 dispatch `deploy-maintenance` | 重新部署正常 Worker 入口 |

## 一、开关在哪

`ops/maintenance/mode.json`：

```json
{ "enabled": true }
```

- 构建时（`frontend/scripts/runBuild.mjs` 与 `admin` 的 `npm run build`）读取它。
- `enabled: true` → 往构建产物根目录写 `_worker.js`；Cloudflare Pages 直传时，产物根目录的 `_worker.js` 会接管该 Pages 项目的**全部**请求（Pages「高级模式」），于是任何路径、任何方法都返回 `503` + 维护页。
- `enabled: false` → 不写该文件，并清掉可能残留的旧副本（防止「上一次暂停」被后续发布带上去）。
- 产物目录（`frontend/dist`、`frontend/dist-portal`、`admin/dist`）都已在 `.gitignore` 中，`_worker.js` 是生成物，不进 Git。
- 开关 JSON 写坏（非法 JSON / 缺 `enabled`）会让构建**直接失败**：宁可发不出去，也不能在计划停机上把站点重新放开。

> 因此 `deploy.yml` 一行都不用改：发布链路本来就会执行这些构建命令。

## 二、COM：关闭与恢复

关闭：

1. 把 `ops/maintenance/mode.json` 的 `enabled` 设为 `true`（本次就是）。
2. 提交并 push `main`。
3. 等 `Test & Build Verify` 通过：
   - `deploy-frontend` 自动发布 → **sagemro.com 立刻进入维护态，无需任何人点按钮**。
   - `deploy-ai-frontend`、`deploy-admin` 声明了 `environment: production`，需要在 Actions 里**批准**才会发。不批准，这两个站就仍然对外正常——想让它们也停，就必须点批准。

恢复：把 `enabled` 改成 `false`，push，等上面三个 Pages 部署都完成。恢复同样需要批准 ai/admin 两个 job。

验证：

```bash
curl -sI https://sagemro.com/ | head -1            # 期望 HTTP/2 503
curl -s  https://sagemro.com/ | grep -o 'The site is temporarily paused'
curl -sI https://ai.sagemro.com/ | head -1         # 期望 503
curl -sI https://admin.sagemro.com/ | head -1      # 期望 503
```

维护页响应头：`Cache-Control: no-store`（恢复后立刻可见，不会卡在浏览器或 CDN）、`Retry-After: 3600`、`X-Robots-Tag: noindex, nofollow, noarchive`。`.cn` 域名自动出中文页，`.com` 出英文页。

## 三、CN：用 workflow 或脚本暂停 nginx

CN 的页面由阿里云 ECS 上的 nginx 提供，**配置只存在于服务器上，不在本仓库、也不由日常发布 workflow 管理**，所以第二节的 Pages 开关对 CN 完全无效（`_worker.js` 在 nginx 下只是个没人执行的静态文件）。CN 走另一条链路，两个入口执行同一份代码：

| 入口 | 何时用 | 怎么做 |
| --- | --- | --- |
| Actions → **Pause or restore China sites** | 常规 | mode 选 `pause`、确认词填 `PAUSE_CN`；恢复选 `restore` + `RESTORE_CN` |
| ECS 上直接跑脚本 | CI 不可用 / 排查时 | `sudo bash pause-cn.sh on` / `off` / `status` |

代码：`ops/maintenance/cn/nginx_maintenance.py`（决定改什么、必须跳过什么）+ `ops/maintenance/cn/pause-cn.sh`（备份、执行、`nginx -t`、reload、校验、失败回滚）。解析与回滚行为由 `frontend/tests/cn-nginx-maintenance.test.mjs` 覆盖。

执行顺序不可调换：

1. 先把整个 `/etc/nginx` 打成 `/var/backups/sagemro-nginx/nginx-<UTC 时间>.tgz`，作为最后兜底。
2. 只改**声明了** `sagemro.cn` / `www` / `ai` / `admin` / `engineer` 的 server 块；`api.sagemro.cn` 一律不动。
3. 已经有 server 级 `return` 的块自动跳过——nginx 不允许同一上下文出现两次 `return`，硬插会让 `nginx -t` 失败（典型就是 80→443 跳转块）。`default_type` 同理，只在缺失时补。
4. 插入带标记的三行：`default_type text/html;` + `return 503 '<维护页>';` + 结束标记。`off` 靠标记整块摘除，字节级还原原文，重复执行幂等。
5. `nginx -t`；不通过就回滚全部改动并退出，**不 reload**。
6. reload 后逐域名 curl 校验（暂停期望 503，恢复期望 200）；不符合同样回滚再 reload。
7. 成功后清掉逐文件备份，tarball 保留。

手动排查先看状态：

```bash
sudo bash pause-cn.sh status    # 每个中文 server 块是 PAUSED 还是 live
```

注意：

- **暂停期间不要 dispatch `Deploy China Edition to Aliyun ECS`**：它的健康检查要求四个站点返回 200，会失败并触发符号链接回滚（nginx 仍保持 503，等于白跑一次发布）。
- 这个 workflow **不声明 `environment: production`**：它只能由人手动 dispatch 并输入确认词，两个方向都幂等、失败自动回滚，再叠一层审批只会让急停更慢。想加回审批就给 job 加 `environment: production`。
- `api.sagemro.cn` 要停请走第四节，不要和页面一起停。

## 四、API（两个市场一起停）

沿用既有机制，不要另造一套：Actions → `Deploy to Cloudflare` → Run workflow，输入确认词 `PAUSE_COM_CN` 与当前 `main` 的完整 SHA。该 job 会把共享 Worker 入口换成 `worker/src/maintenance.js`，`api.sagemro.com` 与 `api.sagemro.cn` 同时返回 `503 {"code":"MAINTENANCE"}`。操作细节与四重守卫见 `DEPLOY.md` 3.6 节。

## 五、注意事项

- **维护页上的邮箱必须保持实体编码**：Cloudflare 的邮箱混淆会把字面量 `mailto:` 与 `address@domain` 改写成 `/cdn-cgi/l/email-protection#…`、可见文字换成 `[email protected]`；而 Worker 对该路径同样返回 503，等于把维护页唯一的邮箱联系方式变成死链。这个 zone 连 `<!--email_off-->` 标记都会吃掉（实测），所以 `render.mjs` 用 `&#109;ailto:…&#64;…` 实体编码：浏览器照常解析成可点的 mailto，混淆器在原始标记里既看不到 scheme 也看不到地址。`frontend/tests/maintenance-mode.test.mjs` 会守住这条，改页面文案时别把邮箱写回字面量。
- **关掉 admin 等于把你自己锁在知识中枢外面**：恢复要靠一次 push + 一次审批，不能从页面里点。
- 搜索引擎看到的是 `503`（临时不可用），不是 `404` 或域名消失；恢复后正常重新抓取，不需要重新提交 sitemap。
- 本开关只影响页面与响应码，不动 D1 数据、不动 Worker 业务代码、不动 DNS。
- 恢复时务必确认三个 Pages 项目都发布了新版本：只改 JSON 不推代码等于没关，只推代码不批准等于 ai/admin 还开着。
