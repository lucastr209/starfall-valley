# Nhà, hang động và mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Nhà có thể ra vào, NPC giao việc, cửa hàng/trang bị và hang có boss; mobile cài trước khi chơi và Canvas phủ màn hình.

**Architecture:** Giữ JS/Canvas. Dữ liệu khám phá và luật thuần tách khỏi game.js; host quản lý cảnh và vẽ. Gate cài là module độc lập, không ghi save.

**Tech Stack:** JavaScript, Canvas2D, CSS, Node24 node:test, Web App Manifest.

**Spec:** `docs/superpowers/specs/2026-10-14-homes-caves-mobile-design.md`

## Global Constraints
- Không thêm dependency; save v1/khóa và 4 map server giữ nguyên.
- Chú thích tiếng Việt cho logic phức tạp; QA dùng slot riêng.
- Điểm chạm >=44px; canvas mobile sát mép, nút tránh safe-area.
- Không deploy bản chưa kiểm; không commit/push working tree cũ.

## Review Focus
- Browser fullscreen không được vượt gate; mở bằng app mới được chơi (Task1).
- Chỉ đọc gate không ghi đè save cũ; backup vẫn có khi chặn chơi (Task1).
- Giao dịch sai/thiếu tiền/đầy túi không trừ tiền; áo/kiếm độc bản không bán (Task2).
- Save hỏng/cảnh đã khóa không gây kẹt trong phòng; online không nhận tọa độ phòng (Task3).
- Boss/rương chỉ cấp thưởng một lần; thua/đầy túi/reload không mất cơ hội (Task4).

### Task1 — Cài trước khi chơi, khung mobile
**Files:** thêm `public/js/install-gate.js`, `tests/install-gate.test.js`; sửa index/styles/game.js/allowlist/gameplay tests.
**Interfaces:** `StardropInstallGate.policy({userAgent,maxTouchPoints,standalone,legacyStandalone,qa,hostname}) -> {required,ios}`; `mount({window,document,onChange}) -> {canPlay,refresh}`.
- [x] RED: iPhone/iPad/Android browser bị chặn, desktop/app được chơi, fullscreen không bỏ gate, production qa không bypass.
- [x] GREEN: module nhận diện và màn hình cài pixel; backup vẫn truy cập. Guard start-form bằng canPlay.
- [x] Browser: gate mobile portrait/landscape; app detection qua unit; canvas viewport desktop/mobile và controls 44px.
- [x] Chạy nhóm + suite/build, ghi chứng cứ.

### Task2 — Luật khám phá, cửa hàng và save
**Files:** thêm exploration-data/core và tests; sửa game-data/core/adventure-core cho items/quest/weapon.
**Interfaces:** `buy(state,id,quantity,data)`, `equip(state,id,data)`, `puzzleInput(state,room,symbol,data)`, `markVictory(state,room,data)`, `claimLoot(state,room,data)` trả `{ok,message}`; restore mặc định/whitelist qua exploration module.
- [x] RED: mua atomic, unique, invalid ID/amount, puzzle sai/lặp, thưởng boss/đầy túi/nhận lại, restore save cũ/hỏng.
- [x] GREEN: catalog 10 phòng +3 hang, shop, vũ khí/áo, 6 quest, trạng thái bền.
- [x] Chạy core/adventure/combat/exploration và suite.

### Task3 — Nhà và cửa hàng trong Canvas
**Files:** game.js, styles, tests/gameplay.test.js, minimap nếu cần.
- [x] RED: tương tác cửa vào, di chuyển/va chạm phòng, NPC cùng ID/giao việc, cửa ra, reload và các đường đổi cảnh.
- [x] GREEN: scene session rõ ràng; renderer sàn/tường/đồ đạc; shop UI và equip; online không hiện người trong phòng ra ngoài trời.
- [x] Browser desktop/mobile vào/ra mỗi loại, shop mua/quần áo/backup; kiếm trang bị qua UI ở Task2 và harness tích hợp.

### Task4 — Hang, câu đố và boss
**Files:** game.js, combat-data/core nếu cần, gameplay/exploration tests, QA scenes.
- [x] RED: đọc manh mối → xếp → mở đấu trường; boss chưa chết không rương; restart trận/retreat/death, thắng và thưởng duy nhất.
- [x] GREEN: 3 hang có hình vẽ, chỉ dẫn và boss trên hệ combat hiện có; trang bị giá trị.
- [x] Browser mobile vào/giải cả3hang, trận/rút lui ở rừng và thưởng qua fixture riêng; harness hoàn tất3hang. Không thay kết quả này bằng tuyên bố thắng boss tự nhiên hoặc đo thời lượng.

### Task5 — Kiểm đầy đủ và bàn giao
- [x] Syntax toàn JS đổi, `node --test tests/*.test.js`, build, `git diff --check`.
- [x] Browser source/dist desktop/mobile portrait/landscape/short; console, cửa ra, puzzle/chạm/shop/HUD.
- [x] Review diff và sửa lỗi có regression; cập nhật README/TEST_REPORT. Ghi giới hạn iPhone thật, thời lượng, deploy.

## Execution
Thực hiện trực tiếp theo yêu cầu người dùng; không tạo thêm agent. Tái sử dụng reviewer `integration_review` đã có để rà độc lập. Mỗi task cập nhật checkbox và resume log; khi quota thấp tạm dừng theo chỉ dẫn, không đánh dấu toàn dự án hoàn tất.

### Task6 — Kiểm bổ sung và release theo yêu cầu tiếp tục
- [x] Fullsuite Node24:470PASS/0FAIL/2SKIP; syntax/build/artifact đạt.
- [x] Bot điều khiển hợp lệ thắng3hang với HP thật, hai loadout; export/reload/rương một lần. Không dùng số mô phỏng làm humanplaytime.
- [x] Stageproduction, kiểm27asset/hash/header/health/WS/privatepath; promote cùng build.
- [x] Publicproduction kiểm lại asset/Rediswelcome/console/save-update/shop/fullscreen/puzzle/mobile viewport; logs error/fatal0dòng trong cửa sổ15phút.
- [ ] iPhone15Pro thật: đã gửi câu hỏi kiểm bảnc43b2e3f449b, chờ người dùng. Không đánh dấu đã kiểm bằng Chromium.

Production đã live; không có hạng mục runtime/deploy tự động còn dang dở. Kiểm thiết bị thật và thời lượng người thật chưa có bằng chứng; xem TEST_REPORT đầu tệp.

## Hoàn tất triển khai local 14/10/2026
Task1–5 đã tích hợp và xác minh theo giới hạn ghi rõ trong TEST_REPORT. Buildc43b2e3f449b;472tests/470PASS/0FAIL/2RedisSKIP;27syntaxPASS; source/dist27assetsHTTP200 và25byte-match. Chưa deploy, chưa kiểm iPhone thật hoặc đo thời lượng/thắng boss tự nhiên. Lịch tiếp tục cũ đã xóa khi user tiếp tục sau reset.

## Lịch sử điểm dừng 14/10/2026
Task1–2 đã qua full suite 453 PASS /0 FAIL /2 SKIP. Task3 có renderer thuần và tests; chưa tích hợp cảnh/cửa/shop. Task4–5 còn lại. Dừng tại primary19% theo yêu cầu; heartbeat một lần22:15 cùng chat. Chi tiết: work/homes-caves-mobile/RESUME.md.
