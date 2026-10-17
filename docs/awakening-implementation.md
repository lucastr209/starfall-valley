# Thức Tỉnh — triển khai 2026-10-17

Kế hoạch được người dùng duyệt trong chat: RPG/co-op 1–4 người, thế giới của chủ phòng, tài khoản Google/Supabase, backend Node liên tục, ba chương/dungeon năm phòng, thưởng cá nhân, bảo toàn Legacy.

## Quyết định triển khai
- Làm trên nhánh `codex/adventure-upgrade` đang có thay đổi tái cấu trúc được stage; không reset, commit hoặc di chuyển thay đổi đó. Chế độ mới có entry riêng `/awakening.html`, dùng renderer nhân vật hiện có và cấu hình/build allowlist chung.
- Một replica backend; mỗi tài khoản chỉ tham gia một phòng. Mô phỏng 20 Hz, snapshot 10 Hz; client gửi input thay vì tọa độ/kết quả chiến đấu.
- Save online tách hoàn toàn khỏi localStorage Legacy. Auth PKCE Google; token được server xác minh qua Supabase. QA chỉ bind loopback với cờ rõ ràng, không có tài khoản test trên production.
- Postgres transaction lưu cả thế giới và nhân vật cùng ledger sự kiện; CAS revision và khóa hàng theo thứ tự. Phòng đóng nếu lưu lỗi; phục hồi checkpoint bền cuối cùng.
- Chưa có credential Render/Supabase được cung cấp: tạo migration, deployment blueprint, hướng dẫn cấu hình và kiểm thử local; không mua hoặc tuyên bố đã triển khai live.

## Các mốc và bằng chứng
1. Nền online: auth, store, protocol, room, quyền, reconnect, lưu nguyên tử.
2. Dungeon đầu tiên: năm phòng, boss hai pha, kiếm/cung/trượng, cứu đồng đội, làng.
3. Hai chương tiếp theo, năng lực/bí mật, cư dân, nhạc/hiệu ứng, QA mobile.

Tiến độ/kiểm thử cụ thể ghi trong `work/awakening/progress.md` và `TEST_REPORT.md`.
