# Thung Lũng Sao Rơi — Adventure Development Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tuân theo lựa chọn thực thi của người dùng; không tự mở nhiều agent.

**Goal:** Phát triển Thung Lũng Sao Rơi thành game phiêu lưu chiến đấu có boss và xây làng, bắt đầu bằng sửa sổ nhiệm vụ và kiểm chứng một chương chơi hoàn chỉnh.

**Architecture:** Giữ Canvas/JavaScript, core nhiệm vụ và renderer hiện tại. Tách combat và tuyến phiêu lưu khi bắt đầu những mốc đó; dùng chung nhận thưởng, save, build allowlist. Chỉ mở rộng nội dung sau khi chương đầu vượt cổng chơi thử.

**Tech Stack:** JavaScript, Canvas 2D, Node.js 24, `node:test`, CSS/HTML, HTTP/WebSocket hiện có; không thêm dependency cho P0.

**Spec:** [2026-10-13-adventure-combat-design.md](../specs/2026-10-13-adventure-combat-design.md).

Trạng thái 14/10/2026: đã triển khai và kiểm bản chơi thử P0–P2 cùng phần thưởng nối về làng. Checkbox đánh dấu phần kỹ thuật đã thực hiện; không thay thế cổng chơi thử. P0 hoàn tất checklist kỹ thuật; P1 còn âm thanh/khóa cân bằng; P2 còn chơi trọn phiên và phản hồi năm người. P3 mới có liên kết thưởng/xưởng/góc làng; chưa có hệ xây làng đầy đủ. P4/P5 chưa triển khai. Chứng cứ và giới hạn nằm trong `TEST_REPORT.md`.

## Global Constraints

- Giữ tên **Thung Lũng Sao Rơi**, chủ đề hiện tại và công nghệ dự án đang dùng.
- Chú thích tiếng Việt cho hàm mới và logic phức tạp.
- Không xóa hoặc thay đổi save người chơi để tạo dữ liệu kiểm thử; dùng localhost `?qa=1` và save QA riêng.
- Giữ `story01`–`story24` cùng các ID và tiền đề đã lưu; trường save mới có mặc định an toàn và được kiểm qua restore/export/import.
- Nhiệm vụ chỉ rời danh sách đang làm sau khi nhận thưởng thành công; không xóa trạng thái `claimed` của nhiệm vụ lâu dài.
- Mỗi lần cập nhật chạy `node --check` cho JS thay đổi, `node --test tests/*.test.js`, kiểm trình duyệt thật và ghi `TEST_REPORT.md`; có lỗi thì sửa, chạy lại nhóm liên quan và toàn bộ suite.
- Module mới phải đi qua thứ tự script, `config/deployment.cjs` và build; không sửa trực tiếp `dist/`.
- Workspace đang có 11 file chỉnh sửa từ trước phiên lập kế hoạch; bảo toàn thay đổi đó, không reset hoặc stage toàn bộ khi thực thi.

## Review Focus

1. Đủ mục tiêu nhưng thiếu đồ giao/đầy túi khi nhận thưởng: giữ nhiệm vụ và toàn bộ tài sản nếu claim thất bại — kiểm ở P0 Task 3.
2. Nhiệm vụ khác đang được theo dõi: nhận thưởng nhiệm vụ không theo dõi không được cướp lựa chọn — kiểm ở P0 Task 3.
3. Sang ngày mới: hợp đồng hết hạn rời danh sách; không xóa lịch sử nhiệm vụ lâu dài và không để HUD trỏ ID mất — kiểm ở P0 Task 3.
4. Save cũ chứa nhiều hợp đồng đã nhận hơn bảng đang chọn: mọi nhiệm vụ active hợp lệ vẫn tìm được — kiểm ở P0 Task 1 và Task 4.
5. Danh sách cuối cùng biến mất sau claim trên mobile: focus, thông báo rỗng và điều khiển vẫn sử dụng được — kiểm ở P0 Task 2 và Task 4.

## Roadmap và phụ thuộc

`P0 → P1 → P2 → chơi thử → P3 → P4 → P5`. P2 cần cả P0 lẫn P1. Chưa triển khai P4 nếu P2 chưa chứng minh được vòng chơi và P3 chưa nối phần thưởng với làng.

| Mốc | Sản phẩm chơi/kiểm tra được | Cổng hoàn tất |
|---|---|---|
| **P0 — Sổ nhiệm vụ** | Đang làm/Có thể nhận/Lịch sử, số đếm đúng, nhận thưởng cập nhật ngay, theo dõi hợp lệ | Các tình huống sổ/save/mobile trong checklist dưới đạt |
| **P1 — Nền chiến đấu** | Kiếm theo hướng, né, địch lấy đà/tầm xa/đòn nặng; arena QA riêng | Đọc đòn và né đáng tin; không hit xuyên tường, nhân hit, hoặc lỗi pause; so sánh FPS đạt |
| **P2 — Chương Rễ Sao** | Sáu nhiệm vụ phiêu lưu + ba việc phụ, đường tắt/checkpoint, boss hai pha và phần thưởng | Chơi được từ save mới/cũ tới thắng boss và về làng; đạt cổng chơi thử trong spec |
| **P3 — Căn cứ có ý nghĩa** | Xưởng, hồi phục, chuẩn bị trang bị, góc làng đổi khác và chuỗi cư dân đầu tiên | Mỗi đầu tư có tác dụng trong chuyến đi; không vòng khóa hoặc buộc cày tài nguyên để thử boss lại |
| **P4 — Hành trình đầy đủ** | Ba chương tiếp theo, tổng bốn boss; thêm thương/cung, di vật và câu chuyện NPC | Mỗi chương có cơ chế riêng, phần thưởng riêng và kết thúc; kiểm toàn tuyến và các save trung gian |
| **P5 — Hoàn thiện phát hành** | Art/audio, balance, tùy chọn trợ giúp, hiệu năng, endgame boss biến thể | Browser/build/save regression đạt; giới hạn thiết bị còn lại được ghi rõ trước phát hành |

Không ấn định ngày phát hành khi chưa có bản combat/chương đầu. Ước lượng theo nhiệm vụ đã hoàn thành và thời gian art/QA thực tế; cộng riêng thời gian sửa sau chơi thử. Tổng mục tiêu nội dung: 24 nhiệm vụ phiêu lưu mới, 12 nhiệm vụ trong ba chuỗi cư dân, bốn boss, 12–16 hành vi địch và ba họ vũ khí; giữ nhiệm vụ cũ.

## File Structure

| Gói | Tệp | Vai trò |
|---|---|---|
| P0 | Sửa `public/js/game-core.js` | Chia danh sách nhiệm vụ và chọn lại theo dõi hợp lệ |
| P0 | Sửa `public/js/game.js`, `public/css/styles.css` | Chế độ sổ, loại nhiệm vụ, số đếm, cập nhật/focus và màn hình nhỏ |
| P0 | Sửa `tests/core.test.js`, `tests/gameplay.test.js`, `tests/save-transfer.test.js` | Các quy tắc và đường đi của source trình duyệt/export/import |
| P0 | Sửa `README.md`, `TEST_REPORT.md` | Hướng dẫn, scene QA và chứng cứ đã chạy |
| P1 | Tạo `public/js/combat-core.js`, `public/js/combat-data.js`, `tests/combat-core.test.js` | Combat thuần và dữ liệu hành vi; `game.js` nối input/render |
| P2 | Tạo `public/js/adventure-data.js`, `public/js/adventure-core.js`, `tests/adventure.test.js` | Nội dung chương, bằng chứng hoàn tất, checkpoint và boss unlock |
| P1–P4 | Sửa `game-core.js`, `game-data.js`, `game.js`, `save-transfer.js`, HTML/CSS và tests liên quan | Nhận thưởng/save/điều khiển dùng chung; chỉ sửa save-transfer nếu validation hiện có cần mở rộng |
| P1–P5 | Sửa `config/deployment.cjs`, `tests/deployment.test.js`; sửa renderer/minimap/onboarding khi tính năng cần | Tích hợp module, asset và hành vi thực sự thay đổi |

Không refactor toàn bộ dự án cùng lúc với thêm gameplay. Những tệp đánh dấu tạo mới chưa tồn tại ở thời điểm lập kế hoạch.

## P0 Task 1: Mô hình danh sách nhiệm vụ

**Files:** Sửa `public/js/game-core.js`; test `tests/core.test.js`.

**Interfaces:**
- Consumes: `dailyQuests(s, data)`, `available(s, q, data)`, `complete(s, q)` hiện có.
- Produces: `journalEntries(s, data, kind = 'all') -> { active: Quest[], available: Quest[], history: Quest[] }`, xuất qua API core hiện có; trả định nghĩa nhiệm vụ, không thay đổi state.
- `kind` hợp lệ ở P0: `all`, `story`, `side`, `daily`; giá trị khác về `all`. Bổ sung `adventure` ở P2.

- [x] **Step 1 — Viết test phân vùng:** dùng state có `story01` claimed, `story02` active chưa đủ, một side active đủ mục tiêu, một side nhận được và một side khóa. Assert ID đã claimed chỉ ở history; đủ mục tiêu vẫn ở active; khóa không ở available; `snapshot(state)` không đổi sau gọi.
- [x] **Step 2 — Viết test hợp đồng/loại/thứ tự:** available daily chỉ thuộc `dailyQuests()`, active/history daily lấy từ toàn bộ trạng thái hợp lệ dù ngoài sáu thẻ board; lọc đúng kind, invalid kind về all. Active xếp ready trước, rồi tracked, rồi thứ tự dữ liệu; kiểm cả giao đồ phụ thuộc inventory.
- [x] **Step 3 — Chạy test trước sửa:** `node --test tests/core.test.js`; xác nhận test mới fail vì API chưa tồn tại hoặc chưa đúng hành vi, không chấp nhận lỗi fixture làm bằng chứng.
- [x] **Step 4 — Cài API:** phân vùng theo active/claimed/chưa nhận và `available`; tuyệt đối không delete quest. `complete()` xác định ready tại thời điểm xem, không lưu status ready mới.
- [x] **Step 5 — Kiểm nhóm core:** chạy lại lệnh trên, cần exit 0 và tất cả test không skip bắt buộc đều pass. Đọc mọi lỗi phát sinh ở tiến trình/festival/daily trước khi chuyển task.

## P0 Task 2: Hiển thị sổ sạch và điều hướng trực tiếp

**Files:** Sửa `public/js/game.js`, `public/css/styles.css`; test `tests/gameplay.test.js`. Chỉ sửa `public/index.html` nếu cần bổ sung vùng live announcement cố định.

**Interfaces:**
- Consumes: `journalEntries()` từ Task 1; `openDialog()`/`showGoals()` và handlers có sẵn.
- Produces: `showJournal(kind = journalKind, view = journalView)` trong game; `journalKind = 'all'`, `journalView = 'active'` khi bắt đầu phiên. `view` nhận `active|available|history`. `kind === 'goals'` tiếp tục gọi màn Sau lễ hội.
- UI state không lưu vào save. Các lời gọi `showJournal('story'|'side'|'daily')` vẫn mở đúng loại; mở Sổ chung giữ bộ lọc trong phiên.

- [x] **Step 1 — Test source thật qua harness `loadGame`:** mở sổ mặc định chỉ có active, chuyển available/history cho đúng ID/thẻ; đủ mục tiêu có nút nhận thưởng, claimed chỉ có ở history. Assert số đếm bằng số thẻ của bộ lọc đang dùng.
- [x] **Step 2 — Test claim và danh sách rỗng:** nhận thưởng thẻ cuối, xác nhận thẻ biến mất, thông báo rỗng/hành động tiếp theo xuất hiện; giữ kind/view, cập nhật nhiệm vụ mới nếu có. Nhiệm vụ giao đồ dẫn đúng cư dân/vùng. Dùng Save QA ở fixture, không sửa save thật.
- [x] **Step 3 — Chạy `node --test tests/gameplay.test.js`:** xác nhận test mới fail đúng hành vi cần bổ sung.
- [x] **Step 4 — Cài UI:** ba nút trạng thái, bộ lọc loại gọn trên mobile, nhãn rõ và số đếm từ Task 1. Dùng `data-*` handlers/escaping hiện có. Claim thành công cập nhật thẻ, giữ scroll hợp lý; thẻ mất thì focus sang thẻ kế tiếp hoặc thông báo rỗng. Đổi bộ lọc thì về đầu danh sách mới.
- [x] **Step 5 — Chạy lại nhóm gameplay và core:** `node --test tests/core.test.js tests/gameplay.test.js`; exit 0. Harness không chứng minh layout/focus thực trên trình duyệt, để Task 4 kiểm.

## P0 Task 3: Nhận thưởng, theo dõi và ngày mới

**Files:** Sửa `public/js/game-core.js`, `public/js/game.js`; test `tests/core.test.js`, `tests/gameplay.test.js`.

**Interfaces:**
- Consumes: `journalEntries().active`, `accept()`, `claim()`, `resumeStory()`, `nextDay()`.
- Produces: `ensureTrackedQuest(s, data) -> string | null`, xuất ở core; giữ tracked hiện tại nếu còn active, nếu không chọn phần tử đầu của danh sách active đã sắp rồi gán `s.tracked`, nếu rỗng gán null.
- `accept(s, id, data)` giữ chữ ký; chỉ tự gán tracked khi tracked hiện tại không trỏ nhiệm vụ active. `claim()` vẫn trả `{ ok, message }` như cũ.

- [x] **Step 1 — Test thưởng thất bại:** thiếu đồ giao, sai NPC, hoặc phần thưởng vượt sức chứa thì `claim().ok === false`, toàn bộ state không đổi, thẻ vẫn active. Test claim lặp không tăng xu/XP/vật phẩm.
- [x] **Step 2 — Test nối nhiệm vụ/theo dõi:** claim bước chuyện mở bước kế tiếp đúng một lần; nếu đang theo dõi side khác thì giữ side. Nếu claim chính tracked thì chọn mục tiêu hợp lệ. `ensureTrackedQuest()` gọi hai lần không đổi thêm state.
- [x] **Step 3 — Test qua ngày:** daily bị reset theo luật cũ; story/side claimed và active được giữ; tracked daily hết hạn được thay hoặc null; sổ/history/counter cập nhật ngay. Lịch sử daily chỉ là trong ngày hiện tại.
- [x] **Step 4 — Chạy nhóm core/gameplay, xác nhận test mới fail đúng chỗ; sửa chính sách tracked ở `accept()`, nối `ensureTrackedQuest()` sau claim/nextDay và sau khi restore/resume trong client. Không dùng selector hiển thị để âm thầm sửa save.**
- [x] **Step 5 — Chạy lại nhóm core/gameplay:** exit 0; kiểm các assertion cũ về auto-story, theo dõi, `resumeStory()` và lễ hội. Mọi thay đổi expectation phải giải thích bằng hành vi mới đã ghi trong spec.

## P0 Task 4: Kiểm toàn luồng, trình duyệt và tài liệu

**Files:** `tests/save-transfer.test.js`, scene QA trong `public/js/game.js`, `README.md`, `TEST_REPORT.md`; sửa thêm test liên quan nếu hành vi ảnh hưởng.

**Interfaces:** dùng restore/encode/decode đang có; P0 không thêm trường save hoặc đổi version.

- [x] **Step 1 — Thêm/check fixture save:** mới; giữa chuyện có nhiệm vụ ready chưa claim; sau lễ hội; đang nhận daily; nhiều daily đã nhận hợp lệ; inventory đầy. Restore → xem sổ → export → import phải giữ tiền, inventory, upgrades, claimed và progress; chỉ tracked không hợp lệ mới được chuẩn hóa.
- [x] **Step 2 — Thêm scene `?qa=1&scene=journal`:** dữ liệu QA có active/ready/claimed/available/locked và nhiệm vụ giao đồ. Giữ local-only guard, khóa save QA và các scene cũ. Kiểm fixture bằng test, không rải cờ thử nghiệm vào save người chơi.
- [x] **Step 3 — Chạy kiểm bắt buộc:** `node --check public/js/game-core.js`, `node --check public/js/game.js`, `node --test tests/*.test.js`, `npm run build`. Thêm `node --check` nếu có JS khác thay đổi. Lưu log dài trong `work/`; ghi mã thoát, pass/fail/skip và lý do skip.
- [x] **Step 4a — Mở localhost thật và bản build:** đã kiểm claim/giao NPC, đổi trạng thái/loại, nhiệm vụ kế tiếp, HUD/minimap, tải lại và nhập fixture. Nhận thưởng cuối chuyện, tải lại và xem lại lễ hội đều giữ 6.500 xu; màn sau lễ hội và lọc Phiêu lưu hoạt động. Nhập fixture kiểm trên source; các thao tác khác có kiểm source và/hoặc build, chi tiết trong báo cáo.
- [x] **Step 4b — Bổ sung ma trận thủ công:** nghỉ sang ngày mới/hồi sức, mở drawer/danh sách11cư dân; xuất fileJSON mới từ dist Chromium rồi nhập lại qua filepicker giữ777xu/6nhiệm vụ/kiếm3sát thương. Dùng QA `fullscreen=ios` để mở UI xuất; chưa kiểm Safari/thiết bị thật.
- [x] **Step 5 — Kiểm UI desktop/mobile:** 1280×900, 844×390, 568×320, 568×280; 390×844 xoay lại ngang; keyboard focus; nút fullscreen vào/ra; không tràn ngang, không chồng điều khiển, nhận thưởng không đòi cuộn tìm nhiệm vụ mới. Kiểm save QA không ghi đè khóa save thật.
- [x] **Step 6 — Nếu tìm lỗi:** sửa nguyên nhân, chạy lại nhóm liên quan rồi toàn bộ suite và build sau thay đổi. Nếu tất cả đạt, cập nhật README và TEST_REPORT với thao tác đã thực hiện và giới hạn thiết bị chưa kiểm.

P0 được chấp nhận khi bốn task trên hoàn tất và người chơi tìm được việc tiếp theo trực tiếp từ sổ/HUD; không còn phải lướt qua nhiệm vụ đã nhận thưởng trong danh sách mặc định.

## P1–P5: Các gói cần đặc tả riêng khi bắt đầu

### P1 — Cảm giác chiến đấu

- [x] Chốt hợp đồng mô phỏng entity/input/hit/event, timer pause và collision trên cơ sở thông số trong spec; viết test thuần trước code.
- [x] Tách dữ liệu/combat core, giữ reward/slime ID tương thích. Kiểm kiếm bốn hướng, đòn trong cung, tường và một hit/đòn; animation không làm thay đổi hitbox ngẫu nhiên.
- [x] Thêm né, reset input, cập nhật thể lực và ba vai trò địch; dựng `combat` QA arena. Kiểm 30/60/120 FPS, bước bù, chết/pause và chạm trên mobile.
- [ ] Thêm phản hồi trúng đòn/âm báo tối thiểu, tắt tiếng và reduced motion. Vẽ vùng nguy hiểm rõ ban đêm/mưa; cập nhật script/allowlist/CSP khi thêm asset.
- [ ] Chơi thử điều khiển, sửa tới khi né/đọc đòn đáng tin rồi mới khóa thông số cho P2.

### P2 — Chương Rễ Sao

- [x] Đặc tả `adv01`–`adv06`, ba side mới, registry chứng cứ và mở khóa sau `story05`; đăng ký data trước restore. Tách mục tiêu village/adventure rõ trong HUD/sổ.
- [x] Đặt điểm dấu vết, giải cứu, ba mạch rễ, lối tắt và checkpoint trong forest hiện có; chứng cứ bền vững, không phụ thuộc vị trí UI hoặc ID ngẫu nhiên.
- [x] Cài Hộ Vệ Rễ Sao hai pha, reset trận chưa thắng, thắng trước nhận quest, chết cùng frame thắng, nhận thưởng sau khi túi đầy, tải lại trước/sau claim và thưởng duy nhất.
- [x] Nối phần thưởng với xưởng/góc làng qua API build/claim; đã có công trình thì nhận nâng cấp tương ứng một lần, chưa có thì có đủ đường xây cơ bản. Chặn vòng khóa tài nguyên.
- [ ] Kiểm toàn vòng 30–45 phút từ save mới và save cũ sau lễ hội; chạy chơi thử theo cổng trong spec. Nếu không đạt, sửa P1/P2 trước mở rộng.

### P3 — Xây làng và kinh tế

- [ ] Vẽ sơ đồ phụ thuộc boss → vật liệu/công thức → công trình → khả năng chuẩn bị, bảo đảm không có chu trình khóa. Giữ tiền đề các công trình cũ để restore không rơi dữ liệu.
- [ ] Làm xưởng, hồi phục và chuẩn bị trang bị theo các công trình đang có; mỗi lựa chọn có tác dụng dễ thấy trong chuyến đi. Tính giá theo thời gian kiếm tài nguyên đã đo ở P2.
- [ ] Làm chuỗi cư dân đầu tiên, thể hiện cư dân trở về và thay đổi lời thoại/cảnh quan bằng chứng cứ đã lưu. Chưa sửa tiến trình ID cũ đã nhận.
- [ ] Sau khi phần trên đạt, thêm bài trí theo ô hoặc một công việc NPC trong gói nhỏ riêng nếu nó cải thiện chuẩn bị/chơi lại; không cài cả hệ thống tự động hóa cùng lúc.
- [ ] Chơi thử farm–craft–fight và thử lại boss: không cần việc phụ/daily lặp để đủ sức hoàn thành chuyện chính; không tạo thưởng một lần có thể farm lại qua save reload.

### P4 — Ba chương tiếp theo

- [ ] Làm lần lượt Vịnh Vỡ Sóng → Ký Ức Mây → Vết Nứt Sao, mỗi chương sáu nhiệm vụ; mỗi chương tự có vòng đi–thử thách–boss–về làng hoàn chỉnh trước chương sau.
- [ ] Thêm thương/cung và di vật cùng loại địch cần thiết cho lựa chọn đó; cơ chế thủy triều/ánh sáng luôn có tuyến an toàn hoặc hướng dẫn đọc tín hiệu. Không khóa tiến trình bằng rơi đồ ngẫu nhiên.
- [ ] Mở rộng tới ba chuỗi cư dân/tổng 12 việc mới; dùng 12 mẫu daily cũ làm hoạt động tự chọn phù hợp vùng đã mở. Tăng số lượng chỉ sau khi tình huống có chất lượng.
- [ ] Kiểm liên tục save trước/sau từng boss, bắt đầu tuyến phiêu lưu từ save đã hoàn tất lễ hội và các trạng thái có sẵn công trình. Giữ lời thoại/kết thúc hai tuyến nhất quán.
- [ ] Hoàn tất boss cuối và hậu truyện; phần kết ghi nhận cư dân/công trình, dẫn tới endgame tự chọn.

### P5 — Hoàn thiện và phát hành

- [ ] Đồng bộ sprite/animation địch, boss, vũ khí và môi trường; nếu đổi actor renderer thì render bảng và kiểm đủ 11 NPC/bốn hướng/đi/chạy.
- [ ] Hoàn thiện nhạc/âm thanh có giấy phép, mute, mức hiệu ứng và tùy chọn trợ giúp đọc/né đòn. Hiệu chỉnh theo chơi thử, không tăng HP để kéo dài trận.
- [ ] Đo cảnh đông trên thiết bị tham chiếu; mục tiêu 60 FPS desktop và tối thiểu 30 FPS mobile, báo p95 frame time/entity count/thiết bị. Tối ưu nơi đã đo là bottleneck.
- [ ] Thêm thử thách đấu lại boss với biến thể hành vi và phần thưởng tự chọn; kiểm không trùng thưởng độc nhất/khóa save/campaign.
- [ ] Chạy regression, build, smoke bản triển khai và kiểm thiết bị thực theo khả năng truy cập. Việc publish/deploy là bước riêng theo yêu cầu phát hành của người dùng; báo rõ iOS/thiết bị chưa được kiểm.

## Cách thực hiện đề xuất

Thực hiện trực tiếp từng mốc trong chat, bắt đầu P0; tránh chia nhiều tác vụ sửa chung `game.js`/core/save. Kiểm tra lại workspace trước khi sửa, giữ từng gói đủ nhỏ để có thể chơi thử và hoàn tác riêng. Quyết định mở rộng dựa trên bản chơi và báo cáo, không dựa vào số nhiệm vụ đã thêm.

Lượt thực thi 13–14/10/2026: 414 bài kiểm tra (412 đạt, 2 Redis-live skip), build Node24 và smoke source/dist đạt. Đã deploy production lên https://starfall-valley.vercel.app/ ngày14/10, kiểm hash22 tài nguyên/health/WebSocket/phòng online và browser desktop/mobile; giữ save người chơi và thay đổi có sẵn, chưa commit/push. Dừng mở rộng tại cổng chơi thử P2; không dùng kết quả kỹ thuật để suy ra độ vui, thời lượng hay hiệu năng thiết bị thật.
