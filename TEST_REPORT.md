# Báo cáo kiểm tra — Thung Lũng Sao Rơi

## Nhấn giữ và bố cục mobile — 07–08/10/2026

Runtime: Node.js 24.19.0. Luồng kiểm tra: giữ/thả nút → trạng thái di chuyển trong phiên → Canvas/camera; mở bảng mobile → nhập chat → trở lại điều khiển. Save QA riêng, không sửa/xóa save người chơi.

- Chặn `contextmenu`, `selectstart`, `dragstart` trong các nút/Home/Canvas của game; CSS `user-select`, `-webkit-user-select`, `-webkit-touch-callout` bảo vệ cả chữ con và nút dialog tạo động. Ô nhập/chọn chữ và nội dung riêng tư vẫn giữ thao tác thông thường. Nút chức năng tiếp tục dùng native click, không hủy toàn bộ touchstart.
- Pointer được theo dõi theo từng `pointerId`; nhả một ngón không xóa ngón khác trên cùng hướng. Kiểm nhiều hướng/cùng hướng/hướng đối diện, pointerup/cancel/lostcapture, mouse phụ, lỗi capture và nhả ở document. Modal/chat/câu cá/home/blur xóa input trong phiên; menu bị chặn cũng dừng input để tránh kẹt phím.
- Mobile dùng khung nhìn logic 540px thay cho 960px, phóng cùng sprite khoảng 1,78 lần ở cùng chiều rộng màn hình. Canvas và lớp tối resize cùng tỷ lệ; camera bám tâm và giới hạn bản đồ, kể cả fullscreen rất cao. Tốc độ 180/297px/s, va chạm, giảm chuyển động và dữ liệu save giữ quy tắc cũ.
- Quest/chat ẩn mặc định trên mobile, có nút mở riêng; desktop giữ sidebar. Chuyển chat sang quest cũng blur ô chat bị giấu, giữ bản nháp và cho phép đi tiếp. Browser xoay ngang phát hiện phím bị xếp sai khi pointer fine; đã bổ sung display/grid-position vào breakpoint chung và kiểm lại.
- Cú pháp `game.js`, `tests/gameplay.test.js`: PASS. Gameplay **80/80 PASS**. Full suite cuối sau sửa CSS: **309 bài, 307 PASS, 0 fail, 2 skip**, 58,61 giây. Hai bài Redis live là tùy chọn; lượt bật live từ máy này đạt 307 nhưng hai bài đó lỗi TCP `ETIMEDOUT`/`ECONNREFUSED`. Không nhận là live Redis local đã đạt trong lượt này.
- Build allowlist PASS; quét 41 file source so với secret trong env PASS; `git diff --check` trên các file sửa PASS. Không thêm dependency, thay renderer sprite/server hoặc đưa dữ liệu riêng vào client.
- Browser thật localhost: 320×700, 390×844, 430×932 không tràn ngang; phím chức năng ≥44px. 390×844 có canvas-stage 494px; điều khiển và hai nút panel nằm trong viewport. Landscape 844×390 có bản đồ 564×278px và điều khiển bên phải, không tràn. Desktop 1280×900 giữ sidebar và nút phóng/thu hoạt động.
- Giữ/thả bốn hướng 1,2 giây; Chạy + giữ hướng 1,6 giây; nhả Shift; chuột phải trên nút bị chặn và reset chạy. Giữ các nút sổ/xây/túi 1,3 giây vẫn mở đúng dialog. Không có text selection trên control. Ô chat chọn được toàn bộ chữ, font16px; mở/đóng/chuyển panel giữ bản nháp và trả focus. Đã quan sát đêm, mưa ban ngày và mưa ban đêm ở viewport mobile; lớp sáng/tối/rain không hở cạnh. Log warn/error đọc được không có lỗi.
- Preview `dpl_3vQEMr7Avr2XDL7pepr2EtV1GWLu` READY, vẫn có Vercel Authentication; CLI authenticated health **200**, WebSocket **101**. Curl timeout8s chủ động kết thúc socket, không phải lỗi handshake. `--target preview` bị API từ chối nhưng project/identity đúng; lệnh preview mặc định thành công, README đã sửa lệnh.
- Bản production trước cập nhật: health **200**; browser QA nhận welcome thật, snapshot **2 người**, chứng minh join Redis từ Vercel đang hoạt động dù TCP Redis từ máy phát triển timeout.
- Production mới `dpl_BfzFpLkmmkpAmm1gvUyUoMzuQHAn` READY, alias https://starfall-valley.vercel.app. Browser QA 390×844 thấy đúng nút panel mới, Canvas540×705, stage494px, không tràn; nhận welcome và snapshot2 người. Giữ hướng khi bật Chạy/thả/tắt Chạy, menu chuột phải và nút phóng/thu (true→false) đạt; selection rỗng, run=false, log warn/error rỗng. Phiên QA đã về màn hình đầu và đóng; health cuối200/0 người, `/server.js`404. Ảnh production: `test-artifacts/vercel-mobile-controls-final.png`. Repo Private đã lưu bản sửa ở commit `296e3f1`.
- Ảnh QA trong `test-artifacts/mobile-controls-final.png`, `mobile-landscape-controls.png`, `mobile-rain-night.png` (không commit).

Giới hạn: browser desktop đổi viewport và giữ chuột kiểm được bố cục/events; chưa có thiết bị iOS/Android thật để xác nhận menu nhấn giữ của hệ điều hành hay bàn phím ảo. Kiểm đa ngón là hồi quy pointer bằng source game thật trong VM. Không tuyên bố kiểm tải nhiều người hoặc toàn bộ nút dialog có thay đổi tiến trình bằng nhấn giữ thực tế.

## Bảo mật và triển khai Vercel + Redis — 07/10/2026

Runtime kiểm thử triển khai: Node.js 24.19.0 trên Windows; Vercel dùng Node 24.x, Fluid Compute, region Singapore. Các lượt trước bên dưới là lịch sử, không thay thế kiểm chứng deployment.

- Kiểm cú pháp: `node --check` đạt cho cả 26 file JS/CJS/MJS đang phục vụ, server, build và tests (loại archive và skills).
- Full suite cuối với `RUN_REDIS_TESTS=1` và biến môi trường riêng tư: **301/301 PASS, 0 fail, 0 skip**, 34,32 giây. Mặc định không cấp biến live thì hai bài tích hợp Redis được skip để không cần khóa mạng.
- Redis live riêng: **3/3 pass**. Ba server localhost độc lập dùng namespace QA ngẫu nhiên; kiểm đồng bộ hai người, hướng/chạy, chat được sanitize, giới hạn toàn cục, rời phiên, TTL và không lưu IP thô/chat/save. Kiểm thêm join đồng thời chỉ nhận đúng một suất, lease hết hạn và cập nhật đến trễ không làm sống lại người đã rời phiên. Namespace QA được dọn; không đụng save hoặc namespace production.
- Các bài HTTP/WebSocket + deployment: **30/30 pass** sau chuyển message queue sang bất đồng bộ. Kiểm allowlist, traversal, Origin, forwarding header giả, giới hạn kết nối/IP/upgrade/frame/byte, CSP và HTTP 429; tất cả nhóm gameplay/renderer/NPC chạy trong full suite.
- Redis thực tế kết nối TLS thành công, Free ở Singapore, `autoUpgrade=false`. Khóa truy cập và salt riêng nằm trong biến môi trường phía server; không nhúng vào client.
- Hai bài mới dùng source game thật kiểm packet malformed/oversized/peer sai kiểu, chat chứa HTML được chèn dưới dạng text, backoff có jitter/tăng dần/reset/cancel khi về màn hình đầu; **2/2 pass**, sau đó chạy lại full suite.
- `npm audit --omit=dev`: **0 lỗ hổng** được báo ở thời điểm kiểm. Source được quét so với giá trị secret trong env; **41 file, PASS**. Git ignore env/.vercel/công cụ deploy; dist chỉ có tài nguyên client cho phép.
- Vercel đầu tiên build thành công; browser phát hiện API/WebSocket trả 431 trước handler. Đã tăng giới hạn header hữu hạn cho bridge; preview sửa đạt `/health` **200** và WebSocket **101**. Timeout curl 3 giây chỉ để kết thúc socket thử. Production cuối: `dpl_A54AnQp8ychNkCyGVB9MCCFQdoaP`, Node 24, sin1, trạng thái READY; domain https://starfall-valley.vercel.app công khai không yêu cầu đăng nhập.
- Browser thật localhost: desktop 1280×900 kiểm vào game/kết nối/phóng và thu bằng nút/dialog Trại Sao; mobile 390×844 kiểm bật/tắt Chạy, di chuyển, dialog Mira và câu cá có phao; trang quyền riêng tư 320×700 không tràn ngang. Các log error/warn đã đọc không có lỗi CSP/runtime. Dùng `?qa=1`, không đọc/xóa/sửa save người chơi.
- Browser production: hai tab QA riêng (desktop 1280×900 và mobile 390×844) hiện **2 người / Đã kết nối**, nhìn thấy hai nhân vật, nhận chat từ mobile sang desktop và di chuyển/chạy/nhả Shift. Khi mobile về màn hình đầu, desktop giảm về 1 và nhận thông báo rời phiên. Log warn/error được đọc không có lỗi. Ảnh lưu tại `test-artifacts/vercel-online-desktop.png` và `vercel-online-mobile.png` (không commit).
- Reconnect browser thật: dừng server localhost do agent chạy, UI chuyển sang “Chơi một mình”; khởi động lại, cùng tab tự nối lại và nhận welcome mà không reload. Không tuyên bố đã quan sát timeout 300 giây của Function trên production.
- HTTP production: `/`, `/health`, `/privacy.html` **200**; health đã xác nhận 2 người. `/server.js`, `/redis-room.cjs`, `/.env`, `/.env.local`, `/.git/config`, `/archive/index-before-retheme.html`, `/tests/server.test.js`, `/package.json`, `/api/play.mjs` **404**. `/_src` chuyển tới trang đăng nhập Vercel, không hiển thị source cho khách chưa xác thực. Origin `https://evil.example` bị từ chối **403**.
- Source đã commit/push lên `lucastr209/starfall-valley`, xác minh GitHub visibility **private**. Không kết nối auto-deploy Git; lần cập nhật tiếp theo theo workflow preview → kiểm thử → production trong README.

Chưa kiểm tải 60 người, Safari/iOS thật; chưa có tài khoản hoặc save cloud. Client JavaScript vẫn tải được như mọi game web; repo/server/khóa phải giữ riêng tư.

Lần kiểm tra mới nhất: 07/10/2026. Runtime: Node.js 26.10.0 trên Windows. Bản game chạy tại http://127.0.0.1:4173. Lượt làm mềm dáng đi đã đạt toàn bộ kiểm tra tự động; kiểm trình duyệt mới bị chặn bởi lỗi khởi tạo sandbox Windows. Các kết quả browser ở những mục trước được giữ rõ theo từng lượt, không tính là đã kiểm bản animation mới.

## Kiểm tra tự động

Lệnh: `node --test tests/*.test.js`.

**287/287 PASS — 0 fail, 0 skip.** Toàn bộ bộ test đã chạy lại sau sửa dáng đi, đế chân, màu mũi giày, nhịp chuyển trọng tâm và bổ sung bản xem thử. Thời gian lượt cuối: 25,63 giây. Lượt toàn bộ trước khi thêm ba bài preview đạt 284/284. Các lượt sprite/nhân vật trước đó đạt 270/270 và 264/264, được giữ trong các mục lịch sử bên dưới.

| Nhóm | Số bài | Phạm vi |
|---|---:|---|
| Core/catalog | 97 | 60 nhiệm vụ, ID/tham chiếu/phụ thuộc, toàn bộ chuỗi cốt truyện và nhánh phụ, hợp đồng luân phiên, giao đúng NPC, chống thưởng lặp, 12 nâng cấp, 4 công thức, túi/giá bán, save hợp lệ và hỏng, ngày/đêm/mưa |
| Source gameplay | 70 | Chạy game.js thật trong VM với DOM/Canvas giả lập: gameplay/NPC/đường/cảnh vật trước đó; bốn hướng, tốc độ đi/chạy/giày, chuẩn hóa đường chéo, Shift/cảm ứng, input khi pause, chạy không xuyên cây/hồ/rìa map, distance thực tế, renderer thật, online mới/cũ, QA riêng, kiếm bốn hướng, nhãn đông người trên desktop/mobile, kích thước sprite lớn ở cả bốn vùng và đèn/nhấp nháy của người chơi khác; biên độ bắt đầu/dừng, giữ pha khi đổi đi/chạy, độc lập FPS/vẽ lại, mỗi cư dân có pha riêng, pause/giảm chuyển động/teleport và truyền renderer mà không lưu save |
| NPC AI | 31 | Lộ trình riêng, A*, nhà/tường/cây, điểm không tới được, khôi phục vị trí bị chặn, tốc độ mới, nghỉ ngắn, bốn hướng đi/trò chuyện, quãng đường thực tế, pause/đổi vùng/frame trễ, dữ liệu bất thường và tính xác định |
| Server | 21 | HTTP/static assets/HEAD/types gồm world-actors.js, health, hai khách, snapshot/hướng/chạy, legacy fallback, boolean bất thường, idle/teleport, tốc độ chạy với giày, tần suất/tọa độ, chat/sanitize, handshake/frame lỗi, heartbeat/reconnect/close/shutdown |
| Nhân vật | 25 | Raster cuối của bốn hướng, mặt sau không mắt/mặt, trái phản chiếu phải ở pha chính/trung gian; tám tư thế chính và pha liên tục, chu kỳ 84/96 px; tỷ lệ đầu 48–66% chiều cao và đầu rộng hơn thân; 11 phụ kiện riêng, 1.536 tổ hợp trong khung 48×60, đế chân/bóng neo, pixel nguyên, đèn, reduced motion, dữ liệu lỗi, trạng thái Canvas; nối vòng, giới hạn độ dịch từng chân/giày, biên độ bắt đầu/dừng và nhịp chuyển trọng tâm |
| Bản xem thử | 3 | Xuất HTML tự chứa/kiểm script nhúng, 12 nhân vật × bốn hướng, các nút đi/chạy/dừng/pause/giảm chuyển động qua VM, giữ pha/thời gian chuyển tiếp và không truy cập save |
| Đường | 23 | Mạng đường liên thông cả bốn vùng, cổng/cửa nhà/bia/rương/bờ câu, tránh hồ/móng/luống, rìa bản đồ, NPC trong tầm đường, viền chỉ xuất hiện bên ngoài giao lộ |
| Cảnh vật | 17 | Cỏ/hoa tránh điểm tương tác và vật cản; chuyển động xác định; điều kiện vùng/ngày/đêm/mưa/công trình; nước/sóng/khói/lửa/bia; reduced motion, thời gian bất thường, culling và save/restore Canvas |

`node --check` đạt lượt cuối cho cả bảy tệp: game.js, world-actors.js, tests/gameplay.test.js, tests/world-actors.test.js, tests/render-actors.cjs, tests/render-gait.cjs và tests/gait-preview.test.js. Không sửa core/catalog/NPC AI/server/đường/cảnh vật trong lượt này; các nhóm test tương ứng vẫn chạy lại đầy đủ.

## Làm mềm dáng đi — 07/10/2026

Chu kỳ hình vẽ chuyển sang tám tư thế chính và các pha trung gian liên tục, vẫn lấy pha từ quãng đường thực tế. Đi/chạy giữ chu kỳ 84/96 px và tốc độ cũ. Chân gập tại gối, nâng chân vung và giữ một chân chịu lực; tay gập khuỷu/đánh ngược chân. Thân chuyển trọng tâm nhẹ, cao ở pha chân đi qua dưới hông và thấp khi sải rộng; nhún tối đa 1 px. Khăn người chơi có độ trễ nhỏ theo nhịp bước.

Game giữ pha chân khi đổi đi/chạy và thêm biên độ bắt đầu 0,08 giây, về đứng 0,12 giây, chuyển tư thế chạy 0,1 giây cho người chơi/cả 11 cư dân. Chỉ hình vẽ chuyển tiếp; vị trí phản hồi và dừng ngay, gặp vật cản không cộng pha bước. Modal/chat/câu cá/qua cổng/blur/giảm chuyển động xóa biên độ trang trí. Pha/biên độ vẫn chỉ lưu trong phiên, không ghi vào save tiến trình.

Lượt full đầu: 281/283 đạt, hai lỗi ở renderer. Đã sửa đế chân chịu lực bị nâng 1 px và mũi giày đổi màu đột ngột bằng cách chỉ dịch chiều sâu chân đang nhấc, giữ dải màu mũi giày ổn định. Khi hai chân che nhau, pixel đường viền có thể trở thành pixel trong thân; màu giày xa có thể bị giày gần che. Test đã tách mặt nạ pixel đục cuối khỏi lớp giày trước che khuất, giữ ngưỡng dịch 2 px và kiểm từng màu giày, đồng thời kiểm độ dịch/nhấc/gập của từng chân. Không đổi thứ tự chân trước/sau để giữ pixel đã bị che.

Nhóm renderer sau sửa: **25/25 đạt**. Kiểm 512 cặp pha liền nhau của người chơi (bốn hướng × đi/chạy × 64 đoạn), gồm nối vòng; toàn bộ 11 NPC có tám tư thế khác nhau ở mọi hướng/đi/chạy. Kiểm 1.536 tổ hợp hình người chơi/NPC giữ khung 48×60 và một đế chân tại chân neo +2 px. Các test tích hợp kiểm bắt đầu/dừng, giữ pha khi nhả Shift, dừng trước vật cản, đổi vùng, NPC dừng cạnh người chơi và save riêng. Đây là kiểm Node/VM/raster, chưa phải quan sát dáng đi trong game thật.

Đã kiểm cú pháp và chạy `node tests/render-actors.cjs`, xuất lại `handheld-sprite-sheet.png` / `.svg` 960×720: 12 nhân vật ở bốn hướng và 16 tư thế đi/chạy của người chơi. Đã xem PNG trực tiếp, kiểm dáng gập tay/chân và phụ kiện của cả 11 NPC. Đây là bảng hình tĩnh, không xác minh cảm giác chuyển động/FPS trong trình duyệt.

Đã kiểm cú pháp và chạy `node tests/render-gait.cjs`, xuất `handheld-gait-preview.html` tự chứa renderer và dữ liệu mẫu, có đi/chạy/dừng/tạm dừng/giảm chuyển động. Script nhúng đạt kiểm cú pháp. Nhóm `tests/gait-preview.test.js` đạt **3/3**: thực thi bằng VM, 48 lượt vẽ với renderer thật, giữ pha khi đổi đi/chạy, đứng yên dừng pha và biên độ về 0 đúng thời gian game, pause/giảm chuyển động và không truy cập save. Đây là kiểm chương trình, chưa click/quan sát bảng HTML bằng browser. Chạy của NPC trong bảng là mẫu kiểm sprite, NPC gameplay vẫn đi bộ.

**Kiểm trình duyệt lượt này chưa hoàn tất.** Công cụ CUA và Node REPL không khởi tạo được: `windows sandbox failed: helper_unknown_error: setup refresh had errors`. Đã thử lại và khởi tạo lại phiên CUA nhưng chưa có ảnh/UI mới. Shell đọc/chạy test ngoài sandbox được chấp thuận nên phần mã và kiểm tự động vẫn tiếp tục. Cần kiểm lại desktop/mobile bằng `?qa=1`: bốn hướng, đi/chạy/nhả Shift, nút Chạy cảm ứng, va chạm và nhãn đông người; thêm ánh sáng/giảm chuyển động/fullscreen nếu có sửa phát sinh. Không sửa hoặc xóa save người chơi để tạo dữ liệu QA.

## Sprite theo ảnh tham khảo Pokémon — 07/10/2026

Đã xem ảnh đính kèm và đối chiếu trang Nintendo Game Boy gốc cùng gallery FireRed/LeafGreen chính thức. Chọn đặc điểm từ ảnh người dùng: đầu/tóc lớn, thân và chân ngắn, viền tóc/má bậc pixel, bốn hướng rõ, tay chân luân phiên. Ảnh có màu và chi tiết gần sprite đời GBA hơn hình Game Boy 1998; không xác định chắc nguồn/bản của ảnh đính kèm. Link tham khảo được ghi trong README.

Renderer được viết lại với hình vẽ riêng của người chơi và cả 11 NPC, giữ phụ kiện nghề nghiệp. Đầu khoảng 32 px trong thân hình cơ bản 54 px; mặt ngang có một mắt/mũi, mặt sau chỉ tóc/mũ/túi. Đi/chạy có sáu tư thế phân biệt bằng pixel cuối, chu kỳ lần lượt 84/96 px để chân không đổi quá nhanh ở tốc độ đi/chạy hiện tại. Tốc độ di chuyển và thể lực không đổi so với lượt trước. Nhún đầu tối đa 1 px; reduced motion giữ tư thế tĩnh nhưng vẫn quay hướng.

`artMetrics` khai báo khung 48×60 và vị trí tên 66 px phía trên chân. Game dùng các số này để tránh nhãn che đầu/mũ lớn. Kiểm bổ sung phát hiện mũ đầu bếp/búi tóc trong bản nháp cần thu lại và đối xứng tay ở pha âm cần chỉnh; đã sửa và chạy lại raster cuối. Fixture test bốn vùng ban đầu chưa mở cổng, đã bổ sung nâng cấp QA đúng điều kiện; nhóm nhãn 4/4 rồi toàn bộ 270/270 đạt.

| Tình huống trên trình duyệt thật | Kết quả quan sát |
|---|---|
| Desktop 1280×900, làng | So ảnh trước/sau: đầu và tóc lớn, thân gọn; phụ kiện Mira/Huy/Linh/Thảo/Bảo/Nam/Yến/Sơn hiển thị cùng môi trường. NPC tiếp tục đổi vị trí/quay hướng. Đã tải góc trước/sau/trái và dùng phím Right chuyển sang phải; có thử Shift+Right và kiểm trạng thái trở về Đi bộ khi nhả. Lượt chốt ảnh có clientWidth=scrollWidth=1265 (thanh cuộn dọc 15 px), không tràn ngang |
| Mobile 390×844 | Bật Chạy, giữ nút Đi phải bằng thao tác kéo với pointer capture: nhân vật đi thực tế, quay phải và dừng sau nhả; HUD về Sẵn sàng chạy. Mở sổ nhiệm vụ làm nút Chạy về false. clientWidth=scrollWidth=375 do thanh cuộn dọc, không tràn ngang |
| Mobile 320×844 | Sau đóng cửa sổ, nút điều hướng/chạy/kiếm/tương tác và các bảng vẫn vừa; clientWidth=scrollWidth=320. Lưu ảnh riêng |
| Đêm ở làng | Sprite mới có thể nhận ra dưới ánh đèn; tóc/mũ không phá mặt nạ ánh sáng hoặc lớp tối |
| Mưa ban ngày ở bờ vịnh | Người chơi và Kiệt có mặt, tóc, mũ và trang phục mới; lớp mưa vẫn vẽ phía trước cảnh, các nút/HUD không bị phủ |
| Mưa ban đêm ở tàn tích | Ly và người chơi được vẽ đúng; vùng tối và vùng sáng quanh người chơi vẫn hoạt động. Vùng xa nguồn sáng giữ độ tối vốn có |
| Rừng / giảm chuyển động | Sen có kiểu kiểm lâm mới. Phím Right vẫn quay nhân vật từ trước sang phải. Unit/VM xác nhận gait/thở/chớp mắt/nhún/độ nghiêng đóng băng theo thiết lập giảm chuyển động |
| Fullscreen | Click nút phóng rồi thu tại rừng: nhãn/aria đổi false→true→false; game trở về bố cục thường |
| Save / console | Chỉ dùng ?qa=1 và khóa save QA riêng. Không ghi nhận error/warn trong các lượt browser. Bộ kiểm tra save/online/gameplay đầy đủ được chạy lại |

Trong lượt sprite trước đã chạy `node tests/render-actors.cjs`, xem trực tiếp PNG 960×720 xuất từ renderer thật: 12 nhân vật × bốn hướng và 12 tư thế đi/chạy. Bản SVG kèm tên/hướng được xuất cùng lúc; không dùng ảnh hoặc thư viện ngoài. Hai bảng này đã được xuất lại thành 16 tư thế ở lượt làm mềm dáng đi bên trên. Kiểm raster 576 tổ hợp là unit test của lượt trước, không phải 576 lượt browser.

Ảnh mới trong `test-artifacts/`: `handheld-before.png`, `handheld-desktop.png`, `handheld-back.png`, `handheld-left.png`, `handheld-right.png`, `handheld-mobile-run.png`, `handheld-mobile-320.png`, `handheld-night.png`, `handheld-coast-rain.png`, `handheld-ruins-rain-night.png`, `handheld-forest-reduced.png`; bảng đối chiếu `handheld-sprite-sheet.png` / `.svg`.

Giới hạn: viewport mobile trên Windows, chưa kiểm điện thoại thật/Safari/iPhone hoặc đo FPS/video. Không chơi thủ công lại cả 60 nhiệm vụ hay kiểm hai client browser trong lượt sprite này; gameplay, tương thích hướng/chạy online và hai khách WebSocket vẫn đạt test tự động. Các mục dưới là kết quả những lượt trước, không phải các thao tác được lặp lại toàn bộ trong lượt này.

## Nhân vật, hướng đi và chạy — 07/10/2026

Nhân vật được vẽ lại bằng pixel Canvas gốc: mặt trước/sau/trái/phải, viền và bóng áo/tóc/giày, khăn và ba lô của người chơi; phụ kiện theo nghề cho cả 11 cư dân. Đi và chạy có sáu khung khác nhau, dùng quãng đường đã đi để đổi bước; dừng trước vật cản không bước tại chỗ. Đứng yên có thở/chớp mắt nhẹ. Kiếm và vệt chém theo hướng nhìn. Giảm chuyển động giữ tư thế tĩnh và vẫn cho phép điều khiển.

Đi 180 pixel/giây, có Giày Lướt Cỏ là 225; chạy bằng Shift hoặc nút Chạy mobile nhanh gấp 1,65 (297 / 371,25 pixel/giây), không mất thêm thể lực. Cư dân đi 76–96 pixel/giây, nghỉ ban đầu 0,4–1,2 giây và nghỉ tại điểm đến 0,8–1,8 giây. Họ quay theo đường đi và quay về phía người chơi khi trò chuyện. Gói online bổ sung hướng và trạng thái chạy, giữ tương thích gói cũ.

Trong lượt kiểm browser đầu, nhiều NPC gặp nhau làm tên/dấu nhiệm vụ chồng nhau và đè lên mặt. Đã tách nhãn sang lớp vẽ cuối, tìm vị trí tránh các nhãn khác và thân nhân vật, thêm đường nối khi cần; không thay vị trí NPC hoặc điểm tương tác. Sau sửa, đã chạy lại nhóm gameplay và toàn bộ 264 bài.

| Tình huống trên trình duyệt thật | Kết quả quan sát |
|---|---|
| Desktop 1280×900 | Hình người chơi và tám cư dân làng mới hiển thị cùng cảnh vật. Quan sát NPC thay vị trí và quay người, tên/dấu nhiệm vụ đi theo. Đã thao tác mũi tên và Shift+mũi tên; ảnh riêng mặt sau, trái và phải. Tốc độ chính xác và sáu pha gait được đo trong VM/unit, không suy ra từ một ảnh tĩnh |
| Ba vùng còn lại | Tải fixture rừng, bờ vịnh và tàn tích, xác nhận Sen, Kiệt, Ly có tạo hình kiểm lâm/thủy thủ/thám hiểm riêng; không ghi nhận lỗi hiển thị hoặc error/warn |
| Đêm, mưa ban ngày, mưa ban đêm | Tải từng scene thật, quan sát nhân vật, đèn đường và bóng tối. Các vùng sáng vẫn làm rõ người/đường; sprite mới không phá lớp ánh sáng. Lưu ảnh riêng ba trạng thái |
| Mobile 390×844 và 320×844 | Nút Chạy vừa bố cục, bật sang Đang chạy với aria-pressed=true; thao tác nút Đi phải và nhân vật quay phải. Sau thả hướng, HUD hiện Sẵn sàng chạy. Mở/đóng sổ nhiệm vụ tự tắt Chạy. Ở 390px, clientWidth và scrollWidth cùng 375px do thanh cuộn dọc; ở 320px cả hai cùng 320px, không tràn ngang |
| Chat | Bật Chạy rồi tập trung nhập nội dung kiểm tra: nút chạy tự về false, HUD Đi bộ; phím mũi tên trong ô chat không điều khiển nhân vật. Đã xóa nội dung trong ô, không gửi tin nhắn |
| Tablet 768×1024 / giảm chuyển động | Tải actors với look=left và motion=reduced, hình và giao diện hiển thị đúng, clientWidth=scrollWidth=768. Thao tác bàn phím vẫn điều khiển hướng. Unit/VM xác nhận chân/thở/chớp mắt/độ nghiêng bị đóng băng trong khi tiến trình và di chuyển vẫn hoạt động |
| Fullscreen | Click thật nút phóng và nút thu: aria-pressed false→true→false, nhãn Phóng→Thu nhỏ→Phóng và canvas bố trí lại đúng |
| Console và save | Không ghi nhận error/warn trong các scene trên. Chỉ dùng ?qa=1 và khóa QA riêng. Unit/VM xác nhận trạng thái chạy/gait không ghi vào tiến trình, không thay save thường, travel/tử trận không bị tính thành bước chân |

Ảnh trong `test-artifacts/`: `actors-desktop.png`, `actors-back.png`, `actors-left.png`, `actors-right.png`, `actors-mobile-run.png`, `actors-mobile-320.png`, `actors-night.png`, `actors-rain-day.png`, `actors-rain-night.png`, `actors-forest.png`, `actors-coast.png`, `actors-ruins.png`, `actors-reduced-tablet.png`.

Giới hạn: mobile/tablet là viewport trên Windows, chưa kiểm điện thoại thật/Safari/iPhone hoặc FPS máy yếu. Lượt này không chơi thủ công lại toàn bộ 60 nhiệm vụ hay kiểm chat/hướng giữa hai cửa sổ browser; phần hai khách và tương thích online đã được kiểm tự động bằng WebSocket thật. Các thông số tốc độ/va chạm/gait được kiểm source/VM và renderer unit, không phải đo tốc độ bằng video.

## Kiểm lại đường và hiệu ứng — 07/10/2026

Nguyên nhân đường bị chồng: các hình chữ nhật đường được tô/đổ bóng độc lập, để lại viền bên trong đoạn giao nhau. Bản sửa dùng mask hợp nhất theo từng vùng và chỉ vẽ viền tiếp xúc với đất. Cây, hoa và chi tiết sân tàn tích tránh mask đường mới. Chợ Lá/Đài Sao được đặt lại, lối tới Đài Sao đi dưới hồ.

Hiệu ứng thêm gồm cỏ/hoa/tán cây lay, bướm, đom đóm, lá rơi, sóng/hải âu, khói, tàn lửa và linh khí/vòng bia; phản hồi bước chân, gieo/thu hoạch, câu cá và kiếm. Cảnh vật tối đa 84 phần tử mặt đất và 21 phần tử trên không mỗi vùng; hiệu ứng thao tác tối đa 80, hạt tối đa 100. Chi tiết ngoài viewport được bỏ qua khi vẽ. Reduced motion dừng chuyển động trang trí nhưng giữ gameplay và thông báo thưởng.

| Tình huống trên trình duyệt thật | Kết quả quan sát |
|---|---|
| Desktop 1280×900, cả bốn vùng ban ngày | Đường đất/cát/đá có bố cục riêng và giao lộ liền mạch. Không còn viền xuyên giữa đường. Quan sát cảnh cây/cỏ, lá rừng, mặt nước/sóng bờ và chi tiết bia. Không ghi nhận error/warn |
| Phía nam làng và Đài Sao | Kiểm lối quanh trại, luống, Chợ Lá và lối vòng phía dưới hồ tới Đài Sao. Công trình nằm trên đất liền, lối không chạy xuyên móng/hồ |
| Đêm, mưa ban ngày, mưa ban đêm ở làng | Các vùng sáng vẫn làm rõ đất, người và đường quanh đèn. Cảnh vật/hạt không phủ lên HUD; mưa không che mất tuyến đường. Đã lưu ảnh riêng từng trạng thái |
| Mobile 390×844 | Canvas, tên vùng, nút, tracker và chat có vùng riêng. body.scrollWidth=390. Gieo bằng nút cảm ứng rồi thu hoạch thành công: +4 mâm xôi, +8 XP. Thông báo thưởng và phản hồi mới được hiển thị |
| Câu cá mobile | Mở minigame bằng nút E, thấy phao và gợn mặt nước. Lần kết thúc trong kiểm tra này bấm ngoài vùng vàng: cá thoát, giảm 6 thể lực và minigame đóng. Thành công/thưởng và ripple định kỳ được xác minh thêm trong VM |
| Tablet 768×1024 | body.scrollWidth=768, sidebar nằm dưới canvas. Nhấn Space thấy vệt kiếm và vòng trúng đòn. Đánh bại slime nhận +18 xu, +18 XP và +1 quặng, số xu/XP trên HUD cập nhật đúng |
| Slime và va chạm | Ảnh đầu tiên ở bờ vịnh phát hiện slime ở trong hồ; đã chuyển điểm xuất hiện lên bờ và tải lại xác nhận. Test bổ sung phát hiện wander có thể nhảy qua thân cây; đã sửa di chuyển theo đoạn với bước tối đa 4 px, kiểm lại đường/tốc độ/frame trễ và toàn bộ test |
| Giảm chuyển động | Tải rừng ban đêm với motion=reduced vẫn chơi và hiển thị đường/ánh sáng bình thường. VM so sánh nhiều thời điểm xác nhận title/tán cây/lửa/sao/mưa/chân đứng yên và không tạo hiệu ứng thao tác, đồng thời tiến trình vẫn hoạt động |
| Fullscreen | Click thật nút phóng rồi nút thu trong trình duyệt tích hợp: nhãn đổi Phóng→Thu nhỏ→Phóng, aria-pressed false→true→false, canvas được bố trí lại. Không kiểm lại Safari/iPhone |
| Save và hồi quy NPC | Chỉ dùng ?qa=1, khóa QA riêng. Test xác nhận tham số QA không reset phiên thường; vị trí cũ bị cảnh vật chắn được tìm điểm trống gần nhất, giữ vật phẩm/nhiệm vụ. Cả 11 NPC vẫn vượt qua bộ mô phỏng trên địa hình mới |

Ảnh trong `test-artifacts/`: `roads-village.png`, `roads-forest.png`, `roads-coast.png`, `roads-ruins.png`, `roads-observatory.png`, `roads-village-night.png`, `roads-rain-day.png`, `roads-rain-night.png`, `roads-forest-reduced.png`, `animation-mobile-farm.png`, `animation-mobile-harvest.png`, `animation-mobile-fishing.png`, `animation-tablet-battle.png`.

Giới hạn lần kiểm này: không đo FPS trên thiết bị yếu và không kiểm trực tiếp trên điện thoại thật. 16 tổ hợp lớp vẽ và 64 fixture QA là kiểm source/VM, không phải 64 lượt browser. Không kiểm lại toàn bộ chuỗi 60 nhiệm vụ thủ công hoặc phiên online/chat hai người trong lần này; các test tự động vẫn chạy lại đầy đủ.

## Kiểm lại bản sửa NPC đứng yên — 06/10/2026

Nguyên nhân: client dùng trực tiếp tọa độ tĩnh trong catalog cho cả vẽ hình và tương tác, chưa có cập nhật NPC mỗi khung hình. Bản sửa tách vị trí trong phiên chơi, dùng tìm đường tránh vật cản và cập nhật tất cả điểm tra cứu vị trí.

| Tình huống | Kết quả |
|---|---|
| NPC đi lại | Cả 11 cư dân có lộ trình riêng. Test gameplay chạy 90 giây mỗi vùng, kiểm va chạm từng bước, chuyển động đáng kể và NPC ở vùng ẩn giữ nguyên vị trí |
| Kiểm mô phỏng bổ sung | Rà soát độc lập 180 giây/vùng: khoảng cách xa nhất so với điểm xuất phát 237–784 px tùy NPC; không vào nhà/hồ/thân cây và không mắc kẹt. Nghỉ chân tối đa 5 giây |
| Trình duyệt desktop | Ảnh trước/sau cho thấy NPC đổi vị trí. Mira dừng khi ở cạnh người chơi rồi tiếp tục sau khi người chơi đi khỏi. Tên và dấu nhiệm vụ đi theo nhân vật |
| Tìm và nhận việc | Hoàn tất nhiệm vụ đầu với Mira. Chọn tìm Huy, đi theo chỉ dẫn cập nhật; nhấn E mở Huy tại vị trí mới và nhận hợp đồng “Một bó gỗ mỗi sáng”, nút chuyển sang “Chưa đủ mục tiêu”, số nhiệm vụ đang nhận tăng 1→2 |
| Dừng và tương tác | NPC gần người chơi dừng để trò chuyện; dialog, nhập chat, câu cá và màn hình đầu tạm dừng lộ trình. Giao đồ dùng vị trí NPC hiện tại, không dùng điểm cũ trong catalog; thưởng không bị lặp |
| Đối tượng cạnh NPC | Phím E ưu tiên cư dân trong tầm trò chuyện, tránh chọn nhầm tài nguyên khi NPC đi ngang qua |
| Mobile / tablet | Kiểm 390×844 và 768×1024. Nút tìm cư dân nằm đầu bảng hành trình, danh sách cuộn được và nút đóng sử dụng được. Chọn Sen hiển thị đúng Rừng Rì Rào. scrollWidth bằng chiều rộng viewport, sidebar nằm dưới canvas |
| Console và save | Không ghi nhận error/warn. Kiểm thử dùng khóa QA riêng; tiến trình thật được bảo toàn. Tải lại QA vẫn giữ nhiệm vụ/vật phẩm, bắt đầu lộ trình NPC mới |

Ảnh bổ sung: `npc-walk-before.png`, `npc-walk-after.png`, `npc-found-huy.png`, `npc-mobile-guide.png`, `npc-mobile-residents.png`, `npc-residents-desktop.png` trong `test-artifacts/`.

NPC hiện được mô phỏng trên từng client, chưa đồng bộ vị trí giữa nhiều người qua server. Tải lại trang khởi động lại lộ trình; đổi vùng trong cùng phiên giữ vị trí. Các kết quả trình duyệt ở mục dưới được ghi trong lần cải tạo giao diện trước đó.

## Kiểm tra trình duyệt thật của lần cải tạo trước — 06/10/2026

Dùng `?qa=1` với khóa lưu riêng; không ghi vào tiến trình thật của người chơi.

| Tình huống | Kết quả quan sát |
|---|---|
| Màn hình đầu | Tiêu đề mới, tên nhân vật, cảnh làng bình minh, mây/vệt sao chuyển động; không tải font/ảnh bên ngoài |
| Vào game và NPC | Mira không còn trùng vị trí xuất hiện. Nhấn E mở trò chuyện, nhiệm vụ đầu đạt1/1, nhận50 xu/35 XP và mở nhiệm vụ kế tiếp |
| Sổ nhiệm vụ | Hiện24 cốt truyện/24 việc cư dân; hợp đồng chỉ hiện khi đủ điều kiện; nhiệm vụ tương lai hiển thị điều kiện khóa |
| Xây dựng/chế tạo | Xây xưởng và dãy đèn thành công, trừ đúng vật liệu, nút đổi thành đã xây; công thức đèn được mở và tạo1 đèn |
| Trồng/thu hoạch | Gieo bằng nút mobile, cây lớn theo timer; thu hoạch+4 quả/+8 XP, túi tăng40→44 |
| Câu cá | Mở minigame bằngE, bấm khi phao vào vùng vàng: +1 cá/+12 XP, thể lực100→94 |
| Chiến đấu | Slime và thanh máu được vẽ; kiếm có hình vung/tiêu hao sức. Để nhân vật bị đánh xác nhận về trại, máu phục hồi và trừ30 xu |
| Mưa ban đêm | Vùng sáng làm rõ đất, người và cảnh vật quanh tất cả đèn. Xây thêm đèn/chế tạo đèn mang theo mở rộng vùng sáng quanh người |
| Fullscreen | Kiểm tra vòng phóng/thu bằng nút với click thật trên Edge và chế độ phủ màn hình dự phòng; nhãn/aria đổi theo trạng thái. Các nhánh Esc và về title còn được kiểm trong VM |
| Hai phiên online | QA Sao Một/QA Sao Hai cùng hiện2 người; chat của phiên2 xuất hiện ở phiên1; nhậpwasd/e/q không mở menu game. Phiên2 rời thì phiên1 còn1 người và có thông báo rời, không còn ghost |
| Console | Không ghi nhận error/warn trong các lượt kiểm tra game |

Bố cục được kiểm tại viewport mặc định desktop (~1528×651),1280×720,768×1024 và390×844. Trên390×844, body.scrollWidth=390; tên vùng nằm trên canvas, quest/chat nằm dưới canvas ở hai cột, các nút hành động và touch có vùng riêng. Khung đối thoại mobile cuộn được và nút đóng luôn ở đầu khung.

## Ảnh kiểm chứng

- `test-artifacts/title-screen.png`: cảnh mở đầu.
- `test-artifacts/mobile-game.png`: bố cục390×844.
- `test-artifacts/rain-streetlights.png`: đèn đường cơ bản trong mưa ban đêm.
- `test-artifacts/rain-lantern.png`: sau xây thêm đèn và mang đèn sao, cùng cảnh/lúc20:00.

Đo trên cặp PNG mưa ban đêm1513×644: trung bìnhRGB tại mảng đường cố định x574..589,y373..388 tăng từ95,8 lên164,5 sau nâng cấp đèn/đèn mang theo. Đây là đo pixel từ ảnh thật, bổ sung cho kiểm tra thứ tự vẽ lớp mưa→mặt nạ tối→glow trong VM.

## Phạm vi chưa xác minh

Chưa kiểm trực tiếp trên Safari/iPhone, mạng Internet hoặc server công khai nhiều người. Đây vẫn là multiplayer khách cho vị trí/chat; tiến trình, chiến đấu và kinh tế do client lưu cục bộ. Các bài VM xác minh hành vi/thứ tự vẽ, không thay thế kiểm tra cảm nhận hình ảnh hoặc cân bằng game dài hạn với người chơi thật.
