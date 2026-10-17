# Bảo mật — Thung Lũng Sao Rơi

## Thức Tỉnh — tài khoản và server quyết định gameplay

- Áp dụng thêm cho `/awakening.html`: Supabase Auth Google/PKCE, access token được backend xác minh qua Auth; không tin user ID hoặc dữ liệu gameplay từ client. Token giữ trong `sessionStorage` riêng, không dùng localStorage Legacy. Refresh trả về sau logout không được khôi phục phiên cũ.
- Client chỉ gửi input/lệnh đã whitelist. Server quản lý va chạm, thời gian, mob, damage, hồi chiêu, khả năng cứu đồng đội, quyền chủ phòng và thưởng. Cung/đường nhìn dùng geometry chung với combat-core; snapshot mang thông số báo đòn thật.
- Database dùng RLS: authenticated chỉ đọc dữ liệu của chính mình; không có quyền ghi hoặc gọi RPC gameplay. Service key chỉ ở backend. Transaction cùng revision và event UUID bảo vệ thưởng/checkpoint trước retry hoặc ghi cũ.
- Backend chạy một replica, tối đa 60 kết nối/15 phòng; mã phòng không thay thế xác thực. Không dùng thư viện Redis hiện diện Legacy làm nguồn quyết định trận đấu.
- QA chỉ bind loopback, cần cờ server rõ ràng và URL QA phía client; production thiếu credential phải dừng. Không chạy QA RAM trên mạng công khai.
- CSP release phải lấy từ `npm run configure:coop` với origin backend chính xác. Không thêm wildcard Render để xử lý lỗi kết nối. Tài nguyên server/migration/test vẫn ngoài allowlist client.
- Chưa kiểm xác thực Google hoặc Supabase/Render live; chưa kiểm tải production, Safari/iPhone vật lý hoặc tuyên bố chống gian lận hoàn toàn. Xem `docs/awakening-operations.md` trước khi phát hành. Chủ dự án phải chốt chính sách lưu trữ/xóa tài khoản và backup database trước khi thu nhận người chơi thật.

## Phạm vi bản thử Legacy

- Không yêu cầu email/mật khẩu; tên nhân vật là biệt danh, không chứng minh danh tính.
- Tên, vị trí và chat được chia sẻ với các khách đang online. Không ghi nội dung chat vào log.
- Tiến trình nằm trên trình duyệt và có thể bị người chơi chỉnh sửa. Chưa phù hợp với kinh tế chung, giao dịch hoặc bảng xếp hạng có thưởng.
- JavaScript/đồ họa client là tài nguyên công khai. Repository và mã server phải giữ riêng tư; minify không bảo vệ bí mật.

## Cấu hình và giới hạn

- Build dùng danh sách tài nguyên cho phép; không sao chép server, .env, archive hoặc tests vào dist.
- Endpoint công khai chỉ dùng WSS, không nhúng token, username/password hoặc query chứa bí mật.
- Production yêu cầu ALLOWED_ORIGINS là danh sách origin HTTPS chính xác; không cho wildcard hoặc Origin thiếu.
- Server giới hạn kết nối/IP, lần upgrade/IP, yêu cầu HTTP/IP, số frame và byte mỗi giây, kích thước frame, buffer, thời gian join và heartbeat.
- X-Real-IP chỉ được tin khi kết nối đến từ IP/CIDR proxy khai báo trong TRUSTED_PROXY_IPS. Proxy phải ghi đè header này. Mặc định không tin forwarding header.
- CSP chỉ cho script/style cùng origin, chặn iframe/object và nguồn tải không cần thiết. Camera, microphone, geolocation và payment bị tắt.
- Tên/chat được chèn dưới dạng text, không chạy như HTML. Gói server nhận được cũng được kiểm tra trước khi đưa vào UI.
- Client kết nối lại với khoảng chờ tăng dần và jitter để tránh cả nhóm reconnect cùng lúc.
- Vercel dùng origin chính xác của deployment/project từ biến hệ thống và ALLOWED_ORIGINS nếu có. Chỉ adapter Vercel tin X-Vercel-Forwarded-For do edge ghi đè; localhost không tin header này.
- Redis TLS chia sẻ hiện diện và Pub/Sub giữa các instance. Join/giới hạn phòng/IP được thực hiện nguyên tử bằng Lua; giới hạn upgrade/IP dùng bộ đếm có TTL. Không chỉ dựa vào RAM của một Function.
- IP được HMAC-SHA256 bằng ONLINE_IP_SALT server-only. Lease hiện diện 45 giây; khóa hiện diện 120 giây; bộ đếm upgrade 60 giây. Chat không có lịch sử trong Redis, save không gửi lên server.
- Production và preview dùng namespace riêng. Bài live dùng namespace QA UUID và dọn sau kiểm thử. Vercel Function tối đa 300 giây; client tự nối lại khi phiên hết hạn.
- Redis Free, autoUpgrade=false: đồng bộ online có thể ngừng khi hết quota; không coi đây là cấu hình đã kiểm tải đông người. Xem Usage trong Vercel/Upstash trước khi mở rộng.

## Khóa và vận hành

- .env*, .vercel và công cụ deploy bị loại khỏi Git. Không gửi token/mật khẩu vào chat, commit, log hoặc tài nguyên client.
- Tài khoản hosting/GitHub cần MFA và quyền truy cập tối thiểu. Nếu khóa lộ, thu hồi/thay khóa; chỉ xóa file trong commit mới không giải quyết khóa đã lộ.
- Giới hạn nêu trên giảm lạm dụng, không thay thế WAF của hosting hoặc kiểm tra tải thực tế.
- Mọi bản phát hành cần node --check, toàn bộ tests, kiểm trình duyệt thật và ghi giới hạn vào TEST_REPORT.md.
- Khi bổ sung tài khoản hoặc save cloud: xác thực ở server, kiểm quyền sở hữu từng save, không lưu session token vào localStorage, có chính sách lưu/xóa dữ liệu và sao lưu.

## Kiểm trước khi công khai

- Kiểm trực tiếp /server/index.js, /server/policy.cjs, /server/redis-room.cjs, /config/deployment.cjs, /.env, /.git/config, /archive/ và /tests/ không thể tải từ deployment.
- Kiểm CSP không chặn game, chat, câu cá, dialog hoặc fullscreen.
- Kiểm hai phiên browser, reconnect và dữ liệu QA; không dùng hoặc xóa save của người chơi.
- Không công bố đã chống gian lận hoàn toàn hoặc đã kiểm tải 60 người nếu chưa thực hiện.
