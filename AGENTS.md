# Thung Lũng Sao Rơi

## Cấu trúc

- `public/index.html` / `public/css/styles.css`: màn hình mở đầu và bố cục HUD/dialog.
- `public/js/game-data.js`: nội dung tiếng Việt, nhiệm vụ, NPC, vật phẩm, nâng cấp, công thức.
- `public/js/game-core.js`: trạng thái và quy tắc tiến trình, có thể kiểm tra bằng Node.
- `public/js/npc-ai.js`: vị trí cư dân trong phiên chơi, hướng nhìn/pha bước chân, lộ trình và tìm đường tránh vật cản.
- `public/js/world-paths.js`: mạng đường liên thông của từng vùng, hợp nhất giao lộ và vẽ viền ngoài.
- `public/js/world-effects.js`: cảnh vật pixel chuyển động theo vùng/thời tiết, giới hạn số lượng và giảm chuyển động.
- `public/js/world-actors.js`: sprite chibi nhìn từ trên xuống, bốn hướng, tám tư thế chính nối bằng pha trung gian đi/chạy theo quãng đường, trang phục riêng của 11 NPC và giảm chuyển động. `artMetrics` khai báo kích thước để game đặt tên/dấu nhiệm vụ đúng.
- `public/js/game.js`: gameplay Canvas, điều khiển, ánh sáng, giao diện và client WebSocket.
- `server/index.js`: server HTTP/WebSocket cộng đồng; `server/policy.cjs` kiểm origin/IP và giới hạn; `server/redis-room.cjs` đồng bộ Redis online.
- `config/deployment.cjs`: allowlist tài nguyên client và security headers dùng chung cho server/build.
- `public/assets/icons/` / `public/manifest.webmanifest`: icon và cấu hình ứng dụng trên Màn hình chính.
- `scripts/`: build client và công cụ tạo icon; `api/play.mjs`: adapter triển khai Vercel.
- `archive/`: bản giao diện trước lần đổi chủ đề; không phục vụ qua server.

## Nhân vật và điều khiển

- Người chơi đi 180 pixel/giây, có Giày Lướt Cỏ đi 225; giữ Shift hoặc bật nút Chạy trên mobile tăng tốc gấp 1,65 lần (297/371,25 pixel/giây), không mất thêm thể lực.
- Hướng nhìn có bốn giá trị `down`, `up`, `left`, `right`. Pha liên tục của tám tư thế đi/chạy lấy từ quãng đường thực tế; bị vật cản chặn thì không cộng bước chân. Giữ pha khi đổi đi/chạy. Biên độ hình vẽ bắt đầu trong 0,08 giây, về đứng trong 0,12 giây, chuyển tư thế chạy trong 0,1 giây; không thêm quán tính vào vị trí. Nhịp đứng yên và tư thế chạy tuân theo thiết lập giảm chuyển động.
- Chạy/phím di chuyển là trạng thái trong phiên, phải xóa khi mở modal, chat, câu cá, qua cổng hoặc trở về màn hình đầu. Không ghi hướng nhìn, quãng đường bước chân hay nút chạy vào save tiến trình.
- NPC đi 76–96 pixel/giây, nghỉ 0,8–1,8 giây giữa các chặng và 0,4–1,2 giây lúc bắt đầu. Họ vẫn dừng trong tầm trò chuyện và giữ lộ trình khi đổi vùng.
- Online đồng bộ hướng nhìn và trạng thái chạy. `tests/world-actors.test.js` kiểm hình vẽ; `tests/npc-ai.test.js` và `tests/gameplay.test.js` kiểm chuyển động/tích hợp.
- QA hình vẽ dùng `?qa=1&scene=actors&look=down|up|left|right`; thêm `motion=reduced` để kiểm giảm chuyển động, vẫn dùng save QA riêng.
- `node tests/render-actors.cjs` xuất bảng PNG/SVG từ renderer thật để rà soát bốn hướng, màu/phụ kiện và các tư thế bước chân. Khi sửa sprite, kiểm đủ hình dáng/pha đi/chạy của cả 11 NPC; không chỉ kiểm người chơi.

## Yêu cầu kiểm tra của người dùng

Người dùng đã yêu cầu: sau mỗi lần cập nhật hoặc sửa lỗi, kiểm tra kỹ những thay đổi trước khi gửi bản final.

1. Chạy `node --check` cho JavaScript thay đổi và `node --test tests/*.test.js`.
2. Kiểm tra thao tác liên quan trên trình duyệt thật. Với giao diện, kiểm cả desktop và mobile; với nhân vật, kiểm bốn hướng, đi/chạy, nhả Shift, nút Chạy mobile, va chạm và tên/dấu nhiệm vụ khi đông người; với ánh sáng, kiểm đêm, mưa và mưa ban đêm; với fullscreen, kiểm phóng và thu bằng nút.
3. Dùng chế độ localhost `?qa=1`/các scene được ghi trong README để kiểm tra bằng save riêng. Không xóa hoặc thay đổi save của người chơi để tạo dữ liệu kiểm thử.
4. Ghi kết quả và giới hạn xác minh vào `TEST_REPORT.md`, không nói đã kiểm tra những trường hợp chưa thực hiện.
5. Khi tìm thấy lỗi, sửa rồi chạy lại nhóm liên quan và toàn bộ bộ kiểm tra trước khi hoàn tất.

Không đưa lại nội dung/chủ đề của phiên bản cũ vào client đang phục vụ. Tên sản phẩm hiện tại là **Thung Lũng Sao Rơi**.
