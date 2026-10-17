# Nhà mở cửa, hang động và trải nghiệm ứng dụng mobile

## Mục tiêu đã được người dùng giao triển khai
Biến nhà trang trí thành địa điểm đi vào, gặp cư dân và nhận việc; bổ sung cửa hàng vật liệu/trang phục/vũ khí, hang khám phá có câu đố và boss, cùng luồng cài ứng dụng trước khi chơi trên mobile. Giữ tiến trình hiện tại và kiến trúc Canvas/JavaScript, không thêm dependency.

## Cấu trúc và phạm vi
- 7 nhà đang vẽ trong làng có cửa vào/ra; mỗi nhà có phòng, đồ đạc và NPC phù hợp. Thêm 3 chòi cư dân tại forest/coast/ruins. NPC ngoài trời vẫn phục vụ nhiệm vụ cũ.
- `exploration-data.js`: địa điểm/cửa, phòng, bảng giá, trang bị, manh mối, boss, phần thưởng, 6 việc phụ. `exploration-core.js`: giao dịch nguyên tử, sở hữu/trang bị, bước câu đố, chiến thắng/nhận rương một lần. Dùng game-core cho tiền, túi, quest và combat-core cho giao tranh.
- Cảnh trong nhà là ngữ cảnh riêng, giữ map ngoài trời chuẩn để không phá hợp đồng server 4 miền. Không gửi vị trí trong phòng như vị trí ngoài trời. Cửa ra luôn dùng được; đổi cảnh hủy input và trận tạm.
- 3 hang ở forest/coast/ruins theo điều kiện mở miền hiện có. Mỗi hang có bia manh mối, trình tự biểu tượng riêng, đấu trường boss và rương trang bị. Chưa thắng không được nhận rương; đầy túi không mất thưởng; quay lại không nhân thưởng. Thua/rút lui cho thử lại.
- Cửa hàng Chợ Lá luôn cho vào; nâng cấp market giữ tác dụng giá bán cũ. Mua vật liệu không tính thành thu thập. Trang bị độc bản không bán nhầm; vũ khí ảnh hưởng sát thương, áo ảnh hưởng hình vẽ/giảm sát thương với giới hạn rõ ràng.
- Save v1 giữ khóa/tên miền hiện tại; thêm dữ liệu exploration có whitelist ID, mặc định an toàn cho save cũ. Không lưu runtime trận; save trong phòng phải tải lại an toàn, không kẹt cửa.

## Mobile
- Điện thoại/tablet cảm ứng trong browser thấy màn hình cài trước màn hình bắt đầu; desktop không bị chặn. Nhận diện app bằng display-mode standalone hoặc navigator.standalone; fullscreen browser không được xem là đã cài.
- iOS: Chia sẻ → Thêm vào Màn hình chính → Mở dưới dạng ứng dụng web (nếu hiện) → Thêm → mở biểu tượng. Android: native prompt nếu có, nếu không có thì hướng dẫn menu. Không giả báo đã cài; appinstalled không tự mở khóa browser.
- Người đang chơi browser vẫn xuất/nhập save từ màn hình hướng dẫn; cảnh báo backup trước khi chuyển môi trường/cài lại. Không sửa/xóa save khi chỉ xem hướng dẫn.
- Canvas phủ viewport mobile cả vùng dưới HUD; nền không có khung giấy bao quanh. Nút HUD, minimap, joystick và thao tác nổi, tránh tai thỏ/home indicator bằng safe-area. Giữ vùng chạm tối thiểu 44px; desktop giữ bố cục quen thuộc.
- QA bypass chỉ ở localhost + qa=1; có scene kiểm gate riêng. Query trên production không mở khóa cài.

## Kiểm chứng và hoàn thành
Kiểm cốt lõi giao dịch/trang bị/câu đố/rương/save lỗi; gameplay đi-vào-ra/trò chuyện/nhận việc/boss; browser desktop, mobile 844×390, 568×280, portrait, gate iOS/Android, safe-area, UI không che nút. Chạy syntax, toàn suite, build và ghi TEST_REPORT. Chỉ ghi xác minh thiết bị thật khi có bằng chứng riêng. Không tự deploy bản đang dở.

## Hạn mức và tiếp tục
Kiểm usage sau từng gói việc. Khi primary còn 15–20%, hoàn thành điểm dừng an toàn, ghi trạng thái vào `work/homes-caves-mobile/RESUME.md`, đặt heartbeat một lần sau resetsAt để tiếp tục cùng chat. Hạn mức tuần độc lập; không hứa tất cả quota về 100%. Máy và Codex phải bật. Không commit/push do working tree chứa công việc cũ chưa commit.
