# Thức Tỉnh — chạy, kiểm thử và đưa lên môi trường thật

## Chạy QA an toàn

Node 24, `npm ci`, rồi trong PowerShell:

```powershell
$env:COOP_QA='1'
$env:HOST='127.0.0.1'
$env:PORT='4180'
npm run start:coop
```

Mở `http://127.0.0.1:4180/awakening.html?qa=1`. Chọn nhân vật 1–4, tạo phòng ở tab đầu, nhập mã ở tab còn lại. QA giữ dữ liệu trong RAM và mất khi khởi động lại; tuyệt đối không dùng để lưu tiến trình thật. `COOP_QA` bị chặn nếu bind ra mạng. Tham số URL không thể bật QA trên production.

WASD/mũi tên đi, Shift hoặc nút Chạy tăng tốc; Space đánh theo hướng nhìn, V né, E tương tác, R cứu đồng đội ở gần (đứng yên hai giây). Mobile dùng cụm di chuyển và bốn nút hành động. Nhấn cổng chỉ khi chủ phòng đứng sát mép đông. Câu đố hai bia yêu cầu hai người ở hai bia; nếu chỉ còn một người có thể hoàn thành solo. Phòng nghỉ có hội thoại và hồi phục. Ba năng lực mở ba lối bí mật trong làng khi đến gần và Tương tác.

## Supabase

1. Tạo project gần backend; áp dụng `supabase/migrations/202610170001_awakening.sql` bằng SQL Editor hoặc Supabase CLI. Không áp dụng lên database chưa được xác nhận là dành cho dự án này.
2. Bật Google provider và cấu hình OAuth trong Google Cloud. Đặt Site URL là origin frontend; thêm URL callback chính xác `https://<frontend>/awakening.html` vào redirect allowlist. Cấu hình callback Supabase trên Google theo hướng dẫn provider.
3. Đặt `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` trên backend. Service key chỉ ở Render, không ở frontend/Vercel build hoặc Git. Game không tự tạo Google credential.
4. Authenticated chỉ đọc nhân vật/thế giới của chính họ qua RLS. Toàn bộ ghi và RPC gameplay chỉ dành cho `service_role`. Backend xác minh access token với Auth trước khi tải dữ liệu; socket hết hạn sẽ yêu cầu kết nối lại.

## Render và Vercel

`render.yaml` là blueprint chờ duyệt, chưa được áp dụng. Gói chạy liên tục có thể phát sinh phí; phải xem báo giá tại bước tạo dịch vụ và được chủ dự án duyệt trước. Chỉ chạy **một instance**, tắt autoscaling: quyền sở hữu phòng đang nằm trong process.

- Render: Node 24, `npm ci --omit=dev`, `npm run start:coop`, health `/health`, region Singapore. `ALLOWED_ORIGINS` là danh sách origin frontend chính xác phân cách bằng dấu phẩy; không wildcard. `COOP_QA=0`; không đặt `HOST=127.0.0.1` trên production.
- Vercel: đặt public build env `COOP_SERVER_URL=https://<backend>.onrender.com`, giữ nguyên `ONLINE_WS_URL` hiện có cho Legacy. Build client vẫn chỉ xuất allowlist `dist`.
- Chạy `npm run configure:coop` tại root để sinh `work/awakening/vercel-release.json` với CSP chứa đúng HTTPS/WSS backend. Tạo preview bằng `vercel deploy --local-config work/awakening/vercel-release.json`; build phải có cùng `COOP_SERVER_URL`. Kiểm preview trước khi dùng cùng local-config để deploy production. **Config gốc giữ CSP Legacy; deploy Git tự động bằng config gốc chưa bật kết nối backend co-op.** Không bỏ CSP để khắc phục.
- Mỗi preview frontend cần thêm đúng origin vào backend và redirect allowlist Supabase. Không trộn credentials/database test và production.

## Lưu và phục hồi

World và mọi nhân vật trong phòng được lưu cùng transaction tại đổi vũ khí, góp đồ, xây, bí mật và thắng boss. Revision khóa ghi cũ; event UUID chống cấp thưởng lặp. Kết quả chưa lưu không phát tới client; DB lỗi đóng phòng để tải lại checkpoint bền. Combat dở không lưu, restart luôn trở về trại. Đánh lại boss đã thắng không farm thưởng lần đầu.

Chủ phòng mất mạng làm cả phòng tạm dừng tối đa 60 giây. Khách có thể reconnect bằng cùng tài khoản và mã; đăng nhập thiết bị mới thay socket cũ. Chủ phòng rời nhóm chủ động sẽ đóng phòng ngay. Khách rời nhóm giữ thưởng đã lưu nhưng không mang công trình/nhiệm vụ của chủ về thế giới riêng.

`awakening_sessions`/`awakening_session_members` là dấu vết vận hành, không phục hồi phòng đang chạy sau crash. `closed=false` có thể là bản ghi của process đã chết, không dùng nó để cấp quyền hoặc hiển thị phòng. Các phòng hoạt động chỉ lấy từ backend hiện tại. Giới hạn 60 kết nối/15 phòng, 8 kết nối/IP và 40 gói/giây/socket.

Trước release: kiểm Google login thật, refresh/logout, hai thiết bị, thắng dungeon bốn người rồi reload, quyền đọc chéo tài khoản, lỗi DB, reconnect, theo dõi log lưu lỗi và tuổi tick khi DB chậm. Chưa có benchmark production hoặc kiểm chứng Safari/iPhone vật lý. Không tuyên bố đã vận hành online chỉ từ kết quả localhost.
