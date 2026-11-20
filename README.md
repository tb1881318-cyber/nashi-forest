# 纳什森林：进化之战

使用 HTML、JavaScript 与 Cloudflare Worker / D1 的课堂游戏。

## 开局

主持人打开 host.html，选择实际参赛人数，点击创建新局，得到四位对局号。首页三个并列入口为主持人台、玩家台和公共台；玩家和公共台可以直接输入对局号进入。旧六位对局号继续有效。
玩家在 player.html 注册 ID，自动获得随机身份。身份为象、狐狸、鼠，鼠克象采用斗兽棋式规则。
公共台 board.html 显示座位、HP、时间、摇号顺序和捕食结果。拍卖结束及每次捕食后自动同步全员生命值。玩家个人页默认显示身份，并记录每轮开局、拍卖后、当前及轮末 HP。旧局缺失的历史值显示为空。个人页按轮次保留主动捕食与被捕食记录，包括对象、双方策略、HP 收益与胜负，隐藏他人的动物身份。公共接口不返回玩家动物身份。
主持人台用于开新局和私下点击显示全员身份（默认隐藏）；创建对局的浏览器在公共台执行拍卖、摇号、计时、捕食与轮末结算。其他设备的公共台为只读。公共台仅指定捕食双方，策略由两位玩家各自在个人台秘密提交。公共台只显示锁定进度；双方锁定后统一揭晓并自动结算 HP。技能费用、保证金及放弃捕食通过调整面板记录。
计算器保留身份选择、划线、概率推导和自定义矩阵。

## 运行与验证

npm install
npm run db:generate
npm run build
npx wrangler d1 migrations apply nash-forest --local
npm run dev

npm run build 将 public 与 worker 打包至 dist/server/index.js。
线上需要 D1 DB 绑定及 drizzle 迁移。
主持人凭证和玩家会话保存在各自浏览器。原本的本机记分簿不迁移到线上房间。

## Render 部署

Render 版本使用 Node.js 24 + PostgreSQL，保持原页面与 API、主持人权限、玩家隐私和双盲选择。`server/` 负责 HTTP 与数据库适配，原 Cloudflare 部署仍可使用。

1. 将源码上传至 GitHub 仓库。
2. 在 Render 创建 Blueprint，读取根目录 `render.yaml`。
3. 配置提供一个新加坡 Free Web Service 和同区 Free PostgreSQL；数据库只允许内网访问，连接字符串自动注入，首次启动自动建表。
4. 启动命令 `npm start`，健康检查 `/healthz`。本地运行时设置 `DATABASE_URL`（不得写入仓库）。

注意：Render Free PostgreSQL 自创建起 30 天后过期，免费 Web Service 连续闲置 15 分钟会休眠，再次打开通常需约一分钟唤醒。适合短期课堂试用；长期使用需另行选择存储或确认付费方案。本项目不自动升级付费计划。

迁移后的网址使用全新的数据库，不包含原 chatgpt.site 上已有房间。请在新网址重新开局；浏览器中旧域名的主持人及玩家凭证不会自动迁移。

验证：`npm test` 共 24 项，包括 PostgreSQL（PGlite 引擎）HTTP 集成测试、7 人并发加入、双盲及重复提交、HTTP 服务重启后的记录读取、页面与本地资源链接。尚未完成 Render 线上运行和国内微信网络实测。

## Netlify 免绑卡路线

仓库也提供 Netlify 版本：`netlify.toml` 指定发布 `public/`，`netlify/functions/game.mjs` 处理所有 `/api/*` 请求，使用 Netlify Database 的 PostgreSQL 存储，`netlify/database/migrations/0001_create_rooms.sql` 自动建表。原有 Render 与 Cloudflare 代码保留。

使用 Netlify Free（Credit-based）账户，从 GitHub 导入本仓库；平台按官方流程自动提供数据库并应用迁移。无需填写数据库密钥。Netlify Free 有硬性额度，额度用完会暂停服务；账号是否触发额外验证以实际页面为准。请勿升级付费套餐或开启自动充值。

本地共 25 项测试通过，新增 Netlify 请求适配下的七人并发入场和双盲结算测试。尚未完成 Netlify 线上部署和微信访问验证。

## 拍卖与玩家技能

公共台先展示本轮技能（折叠规则）和固定 HP 补给，主持人记录成交或流拍。两件物品处理后才能开始计时和摇号。获拍技能自动进入个人台，可点击使用或放弃；最多持有两张未使用且未失效的卡。

鹰眼情报仅持有者可见；契约邀请需对方同意，自动托管、返还或罚没保证金；狼王分配两次额外行动，接在常规行动后；断尾付3 HP改为新目标并重置双方隐藏选择；第五轮权杖由持有者在个人台指定先手。已记录的本轮技能成交可恢复为技能卡。
