# Thung Lũng Sao Rơi

RPG pixel 2D trong trình duyệt, phát triển từ nền Canvas và server cộng đồng của dự án trước. Sau cơn mưa sao, bạn trở thành người giúp Làng Ánh Sao hồi sinh: làm quen cư dân, gom vật liệu, chế tạo, trồng cây, câu cá và đánh thức các bia ký ức để thắp Đèn Dẫn Sao.

## Chạy game

Dùng Node.js 22 trở lên (máy phát triển hiện dùng Node 26):

```powershell
node server.js
```

Mở **http://localhost:4173**. Máy cùng mạng có thể vào `http://<IP-máy-chủ>:4173`. Có thể đặt `PORT` và `HOST` qua biến môi trường; server mặc định cổng 4173, tối đa 60 khách. `/health` trả trạng thái và số người đang chơi.

Không cần tải package, font hay ảnh ngoài. Mở trực tiếp `index.html` cũng chơi được một mình; người chơi trực tuyến/chat cần server. Màn hình đầu nhận tên nhân vật, chưa phải đăng nhập tài khoản.

## Cách chơi

- WASD / các phím mũi tên: đi; giữ **Shift** để chạy. Nhân vật quay theo bốn hướng và giữ hướng nhìn khi nhả phím. **E**: tương tác, ưu tiên cư dân trong tầm trò chuyện. **Space**: vung kiếm, có khoảng nghỉ 0,4 giây.
- **Q** mở sổ nhiệm vụ, **B** mở xây làng, **I** mở túi/chế tạo; **Esc** đóng cửa sổ hoặc hủy câu cá. Mobile có phím điều hướng, kiếm, tương tác và nút **Chạy** để bật/tắt chạy.
- Tốc độ đi là 180 pixel/giây, tăng lên 225 khi có Giày Lướt Cỏ. Chạy nhanh gấp 1,65 lần: tương ứng 297 và 371,25 pixel/giây, không mất thêm thể lực. Đi chéo có cùng tốc độ với đi thẳng; khi bị vật cản chặn, nhân vật không tiếp tục bước tại chỗ.
- Chạy và phím di chuyển tự tắt khi mở cửa sổ, tập trung vào chat, câu cá, qua cổng, trở về màn hình đầu hoặc rời cửa sổ trình duyệt. Sau đó nhấn lại Shift hoặc nút Chạy nếu muốn tiếp tục chạy.
- Nhận nhiệm vụ trước khi thu thập, chế tạo, chiến đấu hoặc trò chuyện để ghi tiến độ. Các mốc xây dựng, khám phá, bia và rương đã làm vẫn được công nhận.
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
- `world-actors.js` vẽ sprite chibi nhìn từ trên xuống: đầu/tóc lớn, má và tóc có viền pixel bậc, thân ngắn, chân nhỏ. Bốn hướng có tám tư thế bước chính, nối bằng các pha trung gian theo quãng đường thực tế. Chân có pha chịu lực/nhấc/gập gối; tay gập khuỷu và đánh ngược chân, thân chuyển trọng tâm nhẹ. Người chơi và cả 11 NPC bắt đầu bước trong 0,08 giây, đưa tư thế về đứng yên trong 0,12 giây; đổi đi/chạy giữ pha chân và chuyển độ nghiêng trong 0,1 giây. Đây là chuyển tiếp hình vẽ, vị trí vẫn phản hồi/dừng ngay theo điều khiển và va chạm. Cả 11 NPC giữ tóc, trang phục và phụ kiện riêng theo vai trò. Có nhịp thở/chớp mắt lúc đứng yên và khăn đung đưa nhẹ khi đi. Chế độ giảm chuyển động giữ tư thế tĩnh nhưng vẫn cho phép đi/chạy và quay hướng. Tên/dấu nhiệm vụ dùng kích thước sprite thực để tránh đầu, mũ và các nhãn khác.
- Mạng đường riêng cho cả bốn vùng: quảng trường và nhánh tới công trình ở làng, đường rừng, lối cát ven vịnh, đường đá tàn tích. Giao lộ được hợp nhất trước khi vẽ, chỉ kẻ viền ngoài; đường tránh hồ, móng nhà và luống cây. Chợ Lá và Đài Sao được bố trí lại trên đất liền.
- Cảnh vật chuyển động: cỏ/hoa và tán cây lay, bướm ban ngày, đom đóm ban đêm, lá rơi trong rừng, hải âu/sóng ven vịnh, khói ống khói, tàn lửa trại, linh khí và vòng cộng hưởng ở bia. Hiệu ứng theo vùng, thời tiết và công trình đã xây.
- Bụi bước chân, vòng gợn khi thả câu, mầm cây khi gieo, vệt kiếm, chớp trúng đòn và chữ thưởng khi thu thập/thu hoạch/chiến đấu. Hiệu ứng thao tác có giới hạn số lượng và được dọn khi đổi vùng; cảnh vật ngoài vùng nhìn thấy được bỏ qua khi vẽ. Game tự nhận thiết lập giảm chuyển động của hệ điều hành.
- Màn hình mở đầu bình minh có làng, mây và vệt sao chuyển động; HUD, tên vùng, sổ nhiệm vụ và chat có vùng riêng.

## Lưu và online

Bản chơi thử triển khai tại https://starfall-valley.vercel.app. Repository `lucastr209/starfall-valley` giữ Private; JavaScript client vẫn là tài nguyên trình duyệt công khai.

Vercel phục vụ `dist` từ allowlist của `scripts/build.cjs`, còn `/play` chạy qua `api/play.mjs` (Node 24, Fluid Compute, Singapore). Redis Free từ Marketplace đồng bộ hiện diện/chat giữa nhiều instance; không lưu save hoặc lịch sử chat. Khóa Redis và `ONLINE_IP_SALT` chỉ có ở environment server. Preview có namespace riêng và giữ Deployment Protection. Không bật nâng cấp gói tự động.

Sau checkout dùng Node 24 và `npm ci`; kiểm `npm test`, `npm run build`, sau đó `vercel deploy --target preview`. Kiểm preview trước khi `vercel deploy --prod`. Redis live: đặt `RUN_REDIS_TESTS=1`, nạp `REDIS_URL` từ file env riêng tư và chạy `node --test tests/redis-room.test.js`. Không gửi file env vào Git.

Xem `SECURITY.md`, `privacy.html` và `TEST_REPORT.md` cho giới hạn bảo mật, dữ liệu lưu tạm và phạm vi kiểm chứng.

Tiến trình tự lưu trên trình duyệt mỗi 5 giây và sau thao tác quan trọng, vào khóa `starfall-valley-save-v1`. Save cũ `giaoxu-tycoon-save-v2` không bị xóa; câu chuyện mới bắt đầu riêng. Mã giao diện trước cải tạo được giữ tại `archive/index-before-retheme.html`.

Server đồng bộ vị trí người chơi, vùng, hướng nhìn, trạng thái đi/chạy và chat. Các nhiệm vụ, vật phẩm, chiến đấu và công trình hiện là tiến trình cá nhân lưu trên máy; chưa có tài khoản, cơ sở dữ liệu hoặc thế giới kinh tế chung do server quản lý. NPC đi lại trên từng client và bắt đầu lộ trình mới khi tải lại trang. Hướng nhìn, pha bước chân và nút chạy là trạng thái trong phiên, không ghi vào tiến trình. Đổi trình duyệt/máy chưa mang theo tiến trình.

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
