# Thung Lũng Sao Rơi

## Thức Tỉnh — phiêu lưu co-op 1–4 người

Chế độ mới tại `/awakening.html`: ba chương, mỗi dungeon năm phòng, boss hai pha, kiếm/cung/trượng, cứu đồng đội, tín hiệu nhóm, năng lực mở bí mật và làng hồi sinh. Nhân vật online mới dùng tài khoản Google/Supabase; thế giới thuộc chủ phòng, chiến lợi phẩm thuộc từng người. Save Legacy giữ riêng.

Backend riêng: `npm run start:coop`. Xem [hướng dẫn QA, Supabase và triển khai](docs/awakening-operations.md) trước khi chạy; production thiếu credential sẽ dừng thay vì tự lưu RAM. Bản local có QA loopback riêng. Chưa cấu hình/deploy dịch vụ thật thì chế độ này chưa dùng được trên site public.

RPG hành động pixel 2D trong trình duyệt. Tuyến phiêu lưu **Rễ Sao** mở sau nhiệm vụ cốt truyện thứ năm: lần theo dấu vết, học né đòn, cứu cư dân, giải cơ chế và đánh bại **Hộ Vệ Rễ Sao**. Tuyến hồi sinh Làng Ánh Sao và đưa **Đêm Hội Sao trở lại** vẫn giữ nguyên tiến trình cũ.

Bản đang phục vụ tại https://starfall-valley.vercel.app/. Nếu ứng dụng Màn hình chính đang mở bản cũ, chọn **Cập nhật game**; không xóa/cài lại để cập nhật. Kiểm iPhone thật đang chờ phản hồi người dùng, xem TEST_REPORT.

Checkpoint kiểm thử hang: [Tải tiến trình](https://starfall-valley.vercel.app/recovery/cave-checkpoint.json). Sao lưu tiến trình cũ trước, tải JSON vào Tệp rồi mở game → **Nhập tiến trình**. Nhân vật cấp7 đứng trước Hang Rêu Sao, mở cả3hang và nhận4việc hang; có Kiếm Đồng Lá/Áo Hải Hành/10cơm/10trà. Câu đố/boss/rương chưa hoàn thành. Đây là save test dựng mới, không phải khôi phục dữ liệu cá nhân hoặc quyền admin server.

## Nhà, cửa hàng và hang động

- Nhấn **E / Tương tác** trước cửa để vào bảy ngôi nhà trong làng và ba chòi cư dân ở rừng, biển, tàn tích. Bên trong có nội thất, NPC và việc mới. Khi nhiều điểm ở gần, chọn đúng cửa hoặc cư dân trong danh sách. Đi tới cửa phía nam hoặc chọn **Ra ngoài** để rời phòng.
- **Cửa hàng Chợ Lá** có quầy bán 14 loại vật liệu, tiếp tế, kiếm và áo. Mua vật liệu theo lượng 1/5/10; trang bị mua một lần rồi chọn trong **Túi**. Vật liệu mua không tính là tự thu thập. Áo đổi màu nhân vật và giảm sát thương; kiếm tăng sát thương thực.
- **Hang Rêu Sao**, **Hang Thủy Triều**, **Hang Tinh Vân** nằm ở phía đông bắc các vùng tương ứng. Đọc bia, xếp ba biểu tượng, mở ấn rồi vượt các đợt canh gác và Hộ Vệ. Mỗi boss có chuỗi đòn riêng; né đòn lao và phản công khi lõi lộ. Mở rương sau chiến thắng để nhận trang bị hiếm và vật phẩm giao nhiệm vụ.
- Thêm sáu việc cư dân gắn với các căn nhà và hang. Báu vật giao việc không bán được. Mỗi hang chỉ nhận rương một lần; túi đầy có thể dọn rồi quay lại. Bản xếp dở và chiến thắng đã lưu được giữ khi tải lại; trận chưa thắng bắt đầu lại.
- Save/xuất file khi ở trong phòng ghi vị trí an toàn ngoài cửa; tải lại hoặc nhập file sẽ đứng ngoài. Khi vào phòng, nhân vật tạm rời phiên online; khi ra ngoài kết nối lại. Phòng hiện là trải nghiệm một người.
- Trên mobile, link mở **hướng dẫn cài về Màn hình chính** trước khi chơi. Chỉ mở từ biểu tượng ứng dụng mới vào được; nút xác nhận cài và fullscreen browser không bỏ chặn. Màn hình này vẫn có sao lưu/nhập file để mang tiến trình sang ứng dụng. Canvas phủ toàn màn hình; nút ☰ mở các chức năng phụ, joystick và cụm nút 2×2 ở hai góc dưới. Minimap mặc định thu gọn; bấm ⌖ để mở/đóng.

QA chỉ localhost: `?qa=1&scene=homes&room=shop-leaf` hoặc ID phòng khác; `?qa=1&scene=caves&room=cave-forest|cave-coast|cave-ruins`. Thêm `checkpoint=loot` vào scene hang để **chỉ kiểm giao diện nhận thưởng**, không dùng đo chiến đấu. `scene=install` xem hướng dẫn iOS; thêm `device=android` xem Android. Tải `?qa=1` không có scene để kiểm tiến trình vừa lưu.

## Bản nâng cấp Rễ Sao

- Sổ mặc định chỉ hiện **Đang làm**, sắp việc sẵn sàng nhận thưởng trước. **Có thể nhận** chứa việc đã mở; **Lịch sử** chứa việc đã nhận thưởng. Nhận thưởng thành công thì thẻ tự chuyển khỏi danh sách đang làm. Nhiệm vụ giao đồ vẫn cần đúng cư dân; lịch sử hợp đồng chỉ tính hôm nay.
- Sáu nhiệm vụ phiêu lưu và bốn việc khám phá tự chọn. Ba dấu vết dẫn vào rừng; đường vòng cứu người cần nối đủ ba cột dây. Chỉ dẫn/minimap chuyển theo bước còn thiếu; từng bước được lưu. Save cũ đã qua `story05` mở nội dung mới; bước đã hoàn tất vẫn được giữ.
- **Mạch ánh sáng**: khảo sát hai bia khắc phía bắc, xoay ba phiến rồi xác nhận. **Hộp di vật**: chọn ba ký hiệu theo lời khắc rồi xác nhận. Đóng/tải lại giữ bản xếp dở; xếp sai có thể xếp lại miễn phí. Khi trạm nghỉ, lối tắt hoặc cư dân nằm sát câu đố, **Tương tác** mở danh sách để chọn đúng địa điểm.
- Bãi tập có hai đợt, giải cứu bằng chiến đấu có hai đợt, mạch rễ phía tây có ba đợt phối hợp cận chiến/bắn xa. Có hai giây tái bố trí giữa các đợt; chỉ thắng cả trận mới thanh tẩy địa điểm. Menu tạm dừng giữ hồi chiêu và đạn, tránh bỏ qua hồi chiêu bằng cách mở sổ.
- **Space / Kiếm** đánh trong cung hướng nhìn, có 0,1 giây lấy đà; **V / Né** né theo hướng nhìn, tốn 10 thể lực. Vùng vàng báo đòn; địch gồm loại lao, mầm gai bắn xa, hộ vệ đòn nặng và boss hai pha. Né không cộng thêm tốc độ chạy và bị vật cản chặn.
- Sau khi cứu người giữ đường, trạm nghỉ ở rừng trở thành checkpoint. Đường tắt và bàn tiếp tế nối chuyến đi với làng. Mở sổ trong giao tranh để **Rút lui**; trận chưa thắng được đặt lại, chứng cứ và tiến trình giữ nguyên.
- Bàn tiếp tế cho chọn **Y tế** (hai phần, +45 máu/+25 thể lực mỗi phần) hoặc **Bền sức** (một phần, +25 máu/đầy thể lực). Trong giao tranh, mở Sổ → Dùng tiếp tế; bổ sung/đổi bộ ở làng hoặc bổ sung ở trạm sau trận. Boss có giáp rễ: đợi lõi lộ sau cú lao rồi phản công.
- Boss thắng được lưu ngay; thưởng độc nhất qua nhiệm vụ, có thể dọn túi rồi nhận sau. Kiếm Rễ Sao gây 3 sát thương, cần vào **Túi → Trang bị**. Thưởng còn có xu/gỗ/quặng đủ xây xưởng cơ bản; làng có góc hồi sinh và xưởng mở công thức rèn lại kiếm.
- Tuyến Rễ Sao và ba hang tự chọn bổ sung chiến đấu, trang bị và việc cư dân. Chưa có co-op chiến đấu hoặc nhạc/âm thanh mới.

QA localhost: `?qa=1&scene=journal` kiểm sổ; `scene=adventure` bắt đầu chương từ save cũ hợp lệ với ngân sách nhỏ; `scene=combat` kiểm ba vai trò địch; `scene=boss` chuẩn bị trước boss. Thêm `weather=night|rain-day|rain-night` và `motion=reduced` để rà báo đòn trong ánh sáng khó/giảm chuyển động. Muốn kiểm tải lại tiến trình sau thao tác, mở `?qa=1` **không có scene**; URL có scene tạo lại fixture mỗi lần tải. Các fixture chỉ ghi khóa save QA, không dùng save người chơi.

## Cập nhật và sao lưu trên iPhone

Tiến trình hiện chỉ lưu trong trình duyệt/ứng dụng đang mở, chưa có sao lưu tài khoản trên server. Safari và ứng dụng Màn hình chính có thể dùng vùng lưu riêng. Trước khi đổi nơi chơi, xóa hoặc cài lại, chọn **Sao lưu ra file**, lưu JSON vào **Tệp**, rồi **Nhập tiến trình** ở nơi mới. Không coi việc cài lại biểu tượng là cách cập nhật.

Chọn **Cập nhật game** ở màn hình đầu hoặc **Túi đồ**: phiên đang chơi được lưu/đọc kiểm lại trước khi tải trang; nếu lưu lỗi, game dừng cập nhật và cho xuất file. Trang đầu chưa chơi không ghi state mới đè dữ liệu chưa đọc được. Build gắn mã phiên bản vào mọi CSS/JS và hiển thị mã ở cuối màn hình đầu; phải tải lại trang đang mở trong RAM để nhận bản mới.

Xóa vùng lưu của ứng dụng mà không có file xuất có thể khiến tiến trình không thể khôi phục chính xác. Checkpoint hỗ trợ tái tạo là một trạng thái mới được dựng lại, không phải bản sao của save đã mất.

## Mục tiêu hành trình

1. **Giúp làng hồi sinh** (bước 1–14): giếng, xưởng, đèn đường, vườn quả và chuyến đi rừng đầu tiên.
2. **Theo dấu Cơn Mưa Sao** (bước 15–22): nối bờ vịnh, mở tàn tích, đánh thức các bia và tìm tinh thể.
3. **Đêm Hội Sao trở lại** (bước 23–24): dựng đài ngắm sao và Đèn Dẫn Sao; nhận thưởng bước cuối để mở cảnh lễ hội với 11 cư dân.

Nút mục tiêu trên HUD luôn hiển thị chặng và tiến độ cốt truyện, kể cả trên điện thoại. Sổ hành trình nêu thành quả từng chặng, bước tiếp theo và công trình cần xây. Nhiệm vụ cốt truyện tự nhận bước kế tiếp sau khi nhận thưởng; khi vào chơi hoặc nhập save trong phiên, bước còn thiếu của save cũ được nối lại, không tính ngược mục tiêu thu thập/chế tạo/chiến đấu.

Lễ hội có ba trang lời thoại, có thể đóng hoặc xem lại từ Sổ hành trình. Save hoàn thành từ bản cũ được xem lễ hội lần đầu khi tiếp tục chơi. Xem lại không trao thêm thưởng; xoay màn hình hoặc về title giữa cảnh giữ trang hiện tại trong phiên. Giảm chuyển động giữ cảnh đứng yên. Cảnh kết không đổi vị trí NPC/người chơi, giờ trong game hay vùng đang chơi.

Sau lễ hội có ba mục tiêu **tự chọn**: hoàn thành 24 việc cư dân, sở hữu đủ 12 nâng cấp, hoặc mở cả ba rương thất lạc. Lựa chọn và cờ đã xem lễ hội được lưu/xuất/nhập cùng tiến trình. Đổi hoặc ngừng theo dõi giữ nguyên thành quả. Việc phụ và hợp đồng ngày không bắt buộc để hoàn thành chuyện chính.

## Cấu trúc dự án

```text
public/                 Tài nguyên trình duyệt, cũng là web root khi chạy local
  index.html            Màn hình đầu, HUD và dialog
  privacy.html          Trang quyền riêng tư
  manifest.webmanifest  Cấu hình ứng dụng trên Màn hình chính
  css/styles.css        Bố cục và giao diện desktop/mobile
  js/                   Gameplay, dữ liệu, quy tắc, renderer và tiện ích UI
  assets/icons/         Icon PNG cho manifest và iPhone
server/                 HTTP/WebSocket, chính sách kết nối và phòng Redis
config/deployment.cjs   Allowlist client và security headers dùng chung
api/play.mjs            Adapter server cho Vercel
scripts/                Build client và tạo icon
tests/                  Kiểm tra tự động và công cụ preview sprite
archive/                Giao diện cũ, không được phục vụ hoặc đưa vào build
dist/                   Bản build được tạo tự động, không sửa trực tiếp
```

Các module trong `public/js/` giữ dạng script `defer` theo thứ tự trong HTML; module có hỗ trợ Node vẫn được kiểm trực tiếp trong tests. Không cần bundler. `npm start` chỉ phục vụ các đường dẫn trong allowlist từ `public/`; `npm run build` chép cùng danh sách sang `dist/`, giữ thư mục con và tạo `js/client-config.js` từ endpoint công khai. File server, cấu hình riêng, tests và archive không thuộc danh sách này.

## Chạy game

Dùng Node.js 24 (cùng phiên bản major với Vercel):

```powershell
npm start
```

Mở **http://localhost:4173**. Máy cùng mạng có thể vào `http://<IP-máy-chủ>:4173`. Có thể đặt `PORT` và `HOST` qua biến môi trường; server mặc định cổng 4173, tối đa 60 khách. `/health` trả trạng thái và số người đang chơi.

Không cần tải package, font hay ảnh ngoài. Mở trực tiếp `public/index.html` cũng chơi được một mình; người chơi trực tuyến/chat cần server. Màn hình đầu nhận tên nhân vật, chưa phải đăng nhập tài khoản.

## Cách chơi

- WASD / các phím mũi tên: đi; giữ **Shift** để chạy. Nhân vật quay theo bốn hướng và giữ hướng nhìn khi nhả phím. **E**: tương tác với điểm khám phá hoặc cư dân ở gần. **Space**: vung kiếm, có khoảng nghỉ 0,4 giây; **V**: né theo hướng nhìn, tốn10thể lực.
- **Q** mở sổ nhiệm vụ, **B** mở xây làng, **I** mở túi/chế tạo; **Esc** đóng cửa sổ hoặc hủy câu cá. Mobile có joystick bên trái, nút **Né**, kiếm/tương tác và nút **Chạy** bên phải để bật/tắt chạy.
- Mobile chơi từ ứng dụng trên Màn hình chính theo chiều ngang; Canvas phủ viewport và HUD nổi trên bản đồ. Màn hình dọc nhắc xoay máy và tạm dừng game; xoay máy, mở dialog/bảng thông tin hoặc rời trang đều xóa thao tác đang giữ. Bảng **Cư dân** và **Chat** mở thành drawer có nút đóng. Các nút có vùng chạm ít nhất 44px; ô tên/chat vẫn nhập và chọn chữ bình thường.
- Người chơi mới được hướng dẫn bốn bước; có thể bỏ qua hoặc mở lại bằng **Hướng dẫn**. Cờ hoàn tất lưu riêng với tiến trình; save cũ không bị buộc xem lại. QA mặc định không mở hướng dẫn; `?qa=1&tutorial=1` thử hướng dẫn khi chưa có save QA.
- Minimap góc trên phải hiển thị vùng hiện tại, bạn (chấm trắng), cư dân/nhiệm vụ, mục tiêu (hình thoi vàng), người chơi online cùng vùng và cổng (ô xanh). Khung trắng là vùng nhìn hiện tại. Nút **⌖** thu/mở minimap; cập nhật tối đa năm lần/giây từ dữ liệu đang có trong game.
- iPhone/Safari: ngay khi mở link, màn hình cài hướng dẫn **Chia sẻ → Thêm vào Màn hình chính**, bật **Mở dạng ứng dụng** nếu có, rồi mở biểu tượng game. Manifest và icon cho phép chạy ở chế độ ứng dụng; CSS không thể ẩn thanh Safari.
- Để mang tiến trình từ Safari sang ứng dụng trên Màn hình chính, dùng **Xuất tiến trình** trong hướng dẫn fullscreen, lưu file vào Tệp; mở biểu tượng game rồi chọn **Nhập tiến trình đã lưu**. File được xử lý trên máy, giới hạn 128 KB và cần xác nhận trước khi thay thế save. Không có đồng bộ save cloud hay chế độ offline.
- Tốc độ đi là 180 pixel/giây, tăng lên 225 khi có Giày Lướt Cỏ. Chạy nhanh gấp 1,65 lần: tương ứng 297 và 371,25 pixel/giây, không mất thêm thể lực. Đi chéo có cùng tốc độ với đi thẳng; khi bị vật cản chặn, nhân vật không tiếp tục bước tại chỗ.
- Chạy và phím di chuyển tự tắt khi mở cửa sổ, tập trung vào chat, câu cá, qua cổng, trở về màn hình đầu hoặc rời cửa sổ trình duyệt. Sau đó nhấn lại Shift hoặc nút Chạy nếu muốn tiếp tục chạy.
- Cốt truyện tự nhận bước đầu khi vào chơi và bước kế tiếp khi nhận thưởng. Nhận riêng việc cư dân/hợp đồng trước khi thu thập, chế tạo, chiến đấu hoặc trò chuyện để ghi tiến độ. Các mốc xây dựng, khám phá, bia và rương đã làm vẫn được công nhận.
- Nhiệm vụ giao hàng dùng vật phẩm trong túi và phải giao cho đúng cư dân. Mỗi nhiệm vụ trả thưởng một lần; hợp đồng được làm lại vào ngày mới.
- Cả 11 cư dân đi quanh nơi sinh hoạt với tốc độ 76–96 pixel/giây, tránh vật cản và nghỉ 0,8–1,8 giây tại các điểm trên lộ trình; lần bắt đầu nghỉ 0,4–1,2 giây. Họ quay theo hướng đi và dừng khi bạn tới gần; mở hội thoại, gõ chat hoặc câu cá sẽ tạm dừng chuyển động. Đổi vùng giữ vị trí của cư dân trong phiên chơi.
- Chọn **Tìm cư dân & hợp đồng** ở bảng hành trình để xem lộ trình, việc đang có và theo chỉ dẫn vị trí hiện tại. Dấu **?** là nhiệm vụ/hợp đồng mới, **!** là việc đang làm, **✓** là việc sẵn sàng nhận thưởng. Giao đồ tại vị trí hiện tại của người nhận.
- Gỗ, quặng, bạc hà, quả, mảnh sao và tinh thể hồi sau 30 giây; cần thể lực để thu thập. Vật liệu dư có thể bán trong túi.
- Câu cá: nhấn E ở bờ câu, rồi nhấn E khi phao ở vùng vàng. E quá sớm/trễ sẽ làm cá thoát.
- Gieo vào bốn luống ở phía nam làng, chờ 16 giây rồi thu hoạch. Nhà kính rút thời gian còn 8 giây.
- Ghế/giếng hồi sức; trà hồi 35 thể lực, cơm hồi toàn bộ máu và thể lực. Tới trại để ngủ sang ngày mới hoặc chờ đến 19:00. Ngày thứ 2 mỗi chu kỳ ba ngày có mưa.
- Slime ở các vùng thám hiểm có 3 máu, có thể đánh bằng kiếm và hồi lại sau 35 giây. Hết máu sẽ về trại, mất tối đa 30 xu.
- Xây cầu để mở bờ vịnh; kho bản đồ mở tàn tích. Đèn đường và đèn sao mang theo thực sự giảm lớp tối. Đài ngắm sao đánh dấu tài nguyên sao; Đèn Dẫn Sao mở vùng sáng lớn và đêm hội.

## Nội dung

- 60 nhiệm vụ: 24 cốt truyện nối tiếp, 24 việc của cư dân, 12 mẫu hợp đồng ngày (tối đa 6 hợp đồng đủ điều kiện mỗi ngày).
- Bốn vùng: Làng Ánh Sao, Rừng Rì Rào, Bờ Vịnh Ngọc, Tàn Tích Mây; 11 cư dân.
- 12 nâng cấp, 11 vật phẩm, bốn công thức: ván gỗ, trà, đèn sao, cơm dã ngoại.
- Đồ họa pixel gốc vẽ bằng Canvas: mái ngói, cạnh tường, bóng cây, bờ nước nhiều lớp, sắp thứ tự theo vị trí để người/cảnh vật che nhau đúng.
- `public/js/world-actors.js` vẽ sprite chibi nhìn từ trên xuống: đầu/tóc lớn, má và tóc có viền pixel bậc, thân ngắn, chân nhỏ. Bốn hướng có tám tư thế bước chính, nối bằng các pha trung gian theo quãng đường thực tế. Chân có pha chịu lực/nhấc/gập gối; tay gập khuỷu và đánh ngược chân, thân chuyển trọng tâm nhẹ. Người chơi và cả 11 NPC bắt đầu bước trong 0,08 giây, đưa tư thế về đứng yên trong 0,12 giây; đổi đi/chạy giữ pha chân và chuyển độ nghiêng trong 0,1 giây. Đây là chuyển tiếp hình vẽ, vị trí vẫn phản hồi/dừng ngay theo điều khiển và va chạm. Cả 11 NPC giữ tóc, trang phục và phụ kiện riêng theo vai trò. Có nhịp thở/chớp mắt lúc đứng yên và khăn đung đưa nhẹ khi đi. Chế độ giảm chuyển động giữ tư thế tĩnh nhưng vẫn cho phép đi/chạy và quay hướng. Tên/dấu nhiệm vụ dùng kích thước sprite thực để tránh đầu, mũ và các nhãn khác.
- Mạng đường riêng cho cả bốn vùng: quảng trường và nhánh tới công trình ở làng, đường rừng, lối cát ven vịnh, đường đá tàn tích. Giao lộ được hợp nhất trước khi vẽ, chỉ kẻ viền ngoài; đường tránh hồ, móng nhà và luống cây. Chợ Lá và Đài Sao được bố trí lại trên đất liền.
- Cảnh vật chuyển động: cỏ/hoa và tán cây lay, bướm ban ngày, đom đóm ban đêm, lá rơi trong rừng, hải âu/sóng ven vịnh, khói ống khói, tàn lửa trại, linh khí và vòng cộng hưởng ở bia. Hiệu ứng theo vùng, thời tiết và công trình đã xây.
- Bụi bước chân, vòng gợn khi thả câu, mầm cây khi gieo, vệt kiếm, chớp trúng đòn và chữ thưởng khi thu thập/thu hoạch/chiến đấu. Hiệu ứng thao tác có giới hạn số lượng và được dọn khi đổi vùng; cảnh vật ngoài vùng nhìn thấy được bỏ qua khi vẽ. Game tự nhận thiết lập giảm chuyển động của hệ điều hành.
- Màn hình mở đầu bình minh có làng, mây và vệt sao chuyển động; HUD, tên vùng, sổ nhiệm vụ và chat có vùng riêng.

## Lưu và online

Bản chơi thử triển khai tại https://starfall-valley.vercel.app. Repository `lucastr209/starfall-valley` giữ Private; JavaScript client vẫn là tài nguyên trình duyệt công khai.

Vercel phục vụ `dist` từ allowlist của `scripts/build.cjs`, còn `/play` chạy qua `api/play.mjs` (Node 24, Fluid Compute, Singapore). Redis Free từ Marketplace đồng bộ hiện diện/chat giữa nhiều instance; không lưu save hoặc lịch sử chat. Khóa Redis và `ONLINE_IP_SALT` chỉ có ở environment server. Preview có namespace riêng và giữ Deployment Protection. Không bật nâng cấp gói tự động.

Sau checkout dùng Node 24 và `npm ci`; kiểm `npm test`, `npm run build`, sau đó `vercel deploy` để tạo preview của project đã liên kết. Kiểm preview trước khi `vercel deploy --prod`. Redis live: đặt `RUN_REDIS_TESTS=1`, nạp `REDIS_URL` từ file env riêng tư và chạy `node --test tests/redis-room.test.js`. Không gửi file env vào Git.

Xem `SECURITY.md`, `public/privacy.html` và `TEST_REPORT.md` cho giới hạn bảo mật, dữ liệu lưu tạm và phạm vi kiểm chứng.

Tiến trình tự lưu trên trình duyệt mỗi 5 giây và sau thao tác quan trọng, vào khóa `starfall-valley-save-v1`. Save cũ `giaoxu-tycoon-save-v2` không bị xóa; câu chuyện mới bắt đầu riêng. Mã giao diện trước cải tạo được giữ tại `archive/index-before-retheme.html`.

Server đồng bộ vị trí người chơi, vùng, hướng nhìn, trạng thái đi/chạy và chat. Các nhiệm vụ, vật phẩm, chiến đấu và công trình hiện là tiến trình cá nhân lưu trên máy; chưa có tài khoản, cơ sở dữ liệu hoặc thế giới kinh tế chung do server quản lý. NPC đi lại trên từng client và bắt đầu lộ trình mới khi tải lại trang. Hướng nhìn, pha bước chân và nút chạy là trạng thái trong phiên, không ghi vào tiến trình. Đổi trình duyệt/máy cần xuất và nhập file tiến trình thủ công.

## Kiểm tra

```powershell
node --test tests/*.test.js
```

- `tests/core.test.js`: toàn bộ catalog, chuỗi nhiệm vụ, thưởng/giao hàng, công thức, nâng cấp, save, ngày đêm/thời tiết.
- `tests/gameplay.test.js`: chạy source game thật bằng VM với DOM/Canvas giả lập, kiểm tương tác, điều khiển, đi/chạy bốn hướng và đường chéo, va chạm khi chạy, tên/dấu nhiệm vụ khi đông người, ánh sáng, đường đi, fullscreen, save và vòng đời kết nối.
- `tests/npc-ai.test.js`: toàn bộ lộ trình cư dân, tìm đường, vật cản, tốc độ, hướng nhìn/pha bước chân, tầm trò chuyện, đổi vùng, thời gian nghỉ và khung hình bị trễ.
- `tests/world-paths.test.js`: đường liên thông, nhánh tới các điểm tương tác, tránh hồ/nhà/luống, giới hạn bản đồ và viền giao lộ.
- `tests/world-effects.test.js`: vị trí và chuyển động cảnh vật, ngày/đêm/mưa, công trình, giảm chuyển động, giới hạn số lượng và trạng thái Canvas.
- `tests/world-actors.test.js`: hình vẽ bốn hướng, tám tư thế chính và pha trung gian đi/chạy theo quãng đường, nối vòng, chuyển trọng tâm, độ dịch pixel/giày trước che khuất, trang phục của 11 cư dân, nhịp đứng yên, giảm chuyển động và khôi phục trạng thái Canvas.
- `tests/gait-preview.test.js`: xuất HTML riêng, kiểm script nhúng và 48 lượt vẽ (12 nhân vật × bốn hướng), nút đi/chạy/dừng/tạm dừng/giảm chuyển động bằng VM, không truy cập save.
- `tests/server.test.js`: HTTP, static assets, hai người chơi WebSocket, chat, di chuyển/hướng nhìn/chạy, reconnect, frame lỗi, heartbeat và shutdown.
- Kết quả kiểm tra trình duyệt và ảnh được ghi tại `TEST_REPORT.md` và `test-artifacts/`.

`node tests/render-actors.cjs` xuất bảng đối chiếu từ renderer thật sang `test-artifacts/handheld-sprite-sheet.png` và `.svg`: người chơi/cả 11 NPC ở bốn hướng, thêm đủ tám tư thế đi và tám tư thế chạy của người chơi. SVG có chú thích tên/hướng; PNG dùng để kiểm pixel và hình dáng. Không cần thư viện hoặc ảnh bên ngoài.

`node tests/render-gait.cjs` xuất `test-artifacts/handheld-gait-preview.html`, bản xem chuyển động riêng của người chơi và 11 NPC ở bốn hướng. Có nút đi/chạy, dừng, tạm dừng và giảm chuyển động; dùng renderer thật, dữ liệu mẫu và cùng thời gian chuyển tiếp hình vẽ với game. Bản HTML tự chứa mã/hình, không truy cập save hay kết nối mạng. Chạy của NPC trong bảng là tư thế mẫu để đối chiếu; trong gameplay cư dân đi bộ. Bảng này hỗ trợ rà soát hình vẽ, kiểm thao tác/va chạm trong game vẫn cần trình duyệt thật.

Các URL `?qa=1&scene=day|night|rain|farm|fish|battle|camp|npc|actors` chỉ dùng trên localhost để kiểm tra với dữ liệu riêng (`starfall-valley-qa-save`), không ghi vào save người chơi. Scene `npc` đặt người chơi phía nam làng để quan sát các cư dân đi lại mà không đứng sát họ.

`?qa=1&scene=finale` tạo tiến trình hợp lệ tới bước 24, đã dựng Đèn Dẫn Sao nhưng chưa nhận thưởng. Vào chơi rồi nhận thưởng trên tracker để kiểm cảnh kết. `?qa=1&scene=after` tạo trạng thái sau lễ hội với 7/12 nâng cấp và 2/3 rương, để kiểm mục tiêu tự chọn. Thêm `motion=reduced` kiểm cảnh lễ hội đứng yên. Muốn kiểm lưu/tải lại, mở `?qa=1` không có `scene` sau khi thao tác; URL có `scene` tạo lại fixture QA mỗi lần tải.

Thêm `fullscreen=ios` để kiểm giao diện hướng dẫn khi iPhone không hỗ trợ fullscreen, hoặc `fullscreen=standalone` để kiểm nhãn chế độ ứng dụng. Hai override này chỉ hoạt động với `qa=1` trên localhost; không giả lập Safari hoặc cài ứng dụng thật.

Scene `actors` đặt người chơi ở lối phía nam làng để kiểm tra hình vẽ và đi/chạy. Thêm `look=down|up|left|right` để chọn hướng nhìn ban đầu; thêm `motion=reduced` để kiểm tra tư thế khi giảm chuyển động. Ví dụ: http://localhost:4173/?qa=1&scene=actors&look=up hoặc http://localhost:4173/?qa=1&scene=actors&look=left&motion=reduced.

Scene `roads` mở các công trình trong dữ liệu QA để xem toàn bộ đường và hiệu ứng. Các tham số:

- `map=village|forest|coast|ruins`: khu vực.
- `weather=day|night|rain-day|rain-night`: ánh sáng/thời tiết.
- `spot=south|shore|shrine`: điểm quan sát; bỏ qua để đứng giữa bản đồ. `spot=observatory` riêng ở làng đặt người chơi trước Đài Sao.
- `motion=reduced`: kiểm tra giảm chuyển động trong QA.

Ví dụ: http://localhost:4173/?qa=1&scene=roads&map=coast&spot=shore hoặc http://localhost:4173/?qa=1&scene=roads&map=village&spot=south&weather=rain-night. Save cũ có vị trí bị cảnh vật mới chắn sẽ được đưa tới điểm trống gần nhất, giữ nguyên tiến trình/vật phẩm.

## Tiền đề thiết kế

Tham khảo nguồn chính thức: [Stardew Valley](https://www.stardewvalley.net/about/) cho vòng hoạt động và quan hệ cư dân; [Littlewood](https://store.steampowered.com/app/894940/Littlewood/) cho xây làng gắn với tài nguyên; [Sun Haven](https://store.steampowered.com/app/1432860/Sun_Haven/) cho phiêu lưu fantasy nhiều vùng; [Sea of Stars](https://seaofstarsgame.co/) cho ánh sáng theo ngày đêm/thời tiết. Tên, cốt truyện và hình vẽ trong dự án này được tạo riêng.

Lượt chỉnh nhân vật dùng ảnh sprite người dùng gửi làm chuẩn về đầu lớn/thân ngắn, bốn hướng và nhịp chân luân phiên. Đã đối chiếu thêm [Pokémon Red/Green trên Game Boy](https://www.nintendo.co.jp/n02/dmg/apajapbj/index.html) và [gallery FireRed/LeafGreen](https://www.pokemon.com/us/pokemon-video-games/pokemon-firered-version-and-pokemon-leafgreen-version). Red/Blue phát hành tại Mỹ tháng 9/1998 theo [lịch sử Pokémon](https://corporate.pokemon.co.jp/en/aboutus/history/); ảnh đính kèm có màu và chi tiết gần các sprite đời GBA hơn, nên tỷ lệ và màu sắc được chọn theo ảnh người dùng. Trang phục, mái tóc và phụ kiện trong game vẫn là thiết kế riêng cho cư dân Thung Lũng Sao Rơi.
