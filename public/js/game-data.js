/* Original setting and quest catalogue for Thung Lũng Sao Rơi. */
(function (root) {
    'use strict';

    const data = {
        title: 'Thung Lũng Sao Rơi',
        regions: [
            { id: 'village', name: 'Làng Ánh Sao', subtitle: 'Mỗi mái nhà giữ một điều ước', color: '#83ba68' },
            { id: 'forest', name: 'Rừng Rì Rào', subtitle: 'Lắng nghe những đường mòn thức giấc', color: '#4c8e69' },
            { id: 'coast', name: 'Bờ Vịnh Ngọc', subtitle: 'Theo thủy triều tìm chuyện của biển', color: '#75c6cc' },
            { id: 'ruins', name: 'Tàn Tích Mây', subtitle: 'Dấu chân xưa giữa những mảnh sao', color: '#9998bb' }
        ],
        items: {
            wood: { name: 'Gỗ thông', icon: '🪵' },
            ore: { name: 'Quặng đồng', icon: '🪨' },
            herb: { name: 'Lá bạc hà', icon: '🌿' },
            berry: { name: 'Quả mâm xôi', icon: '🍓' },
            carrot: { name: 'Cà rốt sao', icon: '🥕', description: 'Củ cà rốt giòn ngọt ánh vàng thu hoạch từ đất tơi xốp.' },
            seed_carrot: { name: 'Hạt giống cà rốt', icon: '🌱', description: 'Hạt giống cà rốt sao, gieo vào luống đất để canh tác.' },
            wheat: { name: 'Lúa mì vàng', icon: '🌾', description: 'Những bông lúa mì óng ả trĩu hạt đón nắng ấm thung lũng.' },
            seed_wheat: { name: 'Hạt giống lúa mì', icon: '🌱', description: 'Hạt giống lúa mì vàng, thích hợp với mọi loại đất.' },
            star: { name: 'Mảnh sao', icon: '⭐' },
            fish: { name: 'Cá vịnh', icon: '🐟' },
            crystal: { name: 'Tinh thể trời', icon: '💎' },
            plank: { name: 'Ván gỗ', icon: '🪚' },
            tea: { name: 'Trà bình minh', icon: '🍵' },
            lantern: { name: 'Đèn sao', icon: '🏮' },
            meal: { name: 'Cơm dã ngoại', icon: '🍱' }
        },
        npcs: [
            {
                id: 'mira', name: 'Mira', role: 'Người giữ bản đồ', map: 'village', x: 800, y: 550, shirt: '#df7961', hair: '#533b42',
                dialogue: [
                    'Chào mừng đến Làng Ánh Sao! Cơn mưa sao làm xáo trộn mọi thứ, nhưng cũng để lại những con đường mới.',
                    'Ghé sổ hành trình để nhận nhiệm vụ. Mỗi việc nhỏ sẽ giúp ngôi làng sáng lên.',
                    'Khi ngọn đèn trên đồi được thắp lại, chúng ta sẽ cùng tổ chức đêm hội sao.'
                ],
                giftPreferences: {
                    loved: ['meal', 'star'],
                    liked: ['tea', 'berry'],
                    neutral: ['wood', 'herb', 'crystal', 'plank', 'carrot', 'wheat'],
                    disliked: ['ore']
                },
                giftReactions: {
                    loved: 'Món quà tuyệt vời quá! Chuyến thám hiểm hôm nay lại có thêm niềm vui rồi!',
                    liked: 'Cảm ơn bạn! Món quà này rất hữu ích cho các chuyến đi.',
                    neutral: 'Cảm ơn bạn nhé! Tôi sẽ cất nó cẩn thận.',
                    disliked: 'Quặng thô nặng quá... Mang theo vẽ bản đồ thì bất tiện lắm.'
                },
                heartDialogues: {
                    2: 'Nhờ có bạn khôi phục từng lối đi, bản đồ Làng Ánh Sao giờ đây đã ngập tràn ánh sáng hy vọng.',
                    4: 'Khi cơn mưa sao rơi xuống, tôi từng nghĩ ngôi làng này sẽ mãi chìm vào quên lãng. Cảm ơn bạn đã luôn đồng hành cùng tôi.',
                    5: 'Bạn không chỉ là một nhà thám hiểm, bạn là linh hồn của thung lũng này!'
                },
                milestoneRewards: {
                    2: { coins: 50, items: { berry: 2 } },
                    4: { coins: 100, items: { star: 1 } },
                    5: { renown: 3, items: { meal: 1 } }
                }
            },
            {
                id: 'huy', name: 'Huy', role: 'Thợ mộc', map: 'village', x: 400, y: 520, shirt: '#bf843e', hair: '#44342b',
                dialogue: [
                    'Tôi nhìn khúc gỗ là đã thấy một cây cầu. Còn bạn thấy gì?',
                    'Dựng xưởng mộc rồi dùng gỗ thông để làm ván. Ván rất cần cho những công trình lớn.',
                    'Chiếc cầu phía đông sẽ dẫn đến vịnh. Mang giày tốt, đường có hơi dài đấy!'
                ],
                giftPreferences: {
                    loved: ['plank', 'ore'],
                    liked: ['wood', 'lantern'],
                    neutral: ['crystal', 'tea', 'meal', 'carrot', 'wheat', 'star'],
                    disliked: ['herb', 'fish']
                },
                giftReactions: {
                    loved: 'Ván gỗ thẳng thớm và quặng tốt thế này! Cậu đúng là hiểu ý dân thợ mộc nhất!',
                    liked: 'Cảm ơn cậu nhé, đồ tốt cho xưởng mộc đấy!',
                    neutral: 'Cảm ơn cậu, tôi sẽ dùng nó khi cần.',
                    disliked: 'Mùi cá tanh hay thảo mộc này dễ ám vào thớ gỗ lắm, tôi không ưng đâu.'
                },
                heartDialogues: {
                    2: 'Tiếng cưa xẻ gỗ mỗi sớm làm tôi thấy làng mình đang hồi sinh từng ngày.',
                    4: 'Cây cầu ra vịnh đứng vững qua bao đợt gió lớn chính là nhờ những thanh ván mà cậu giúp tôi làm đấy.',
                    5: 'Tìm được người tri kỷ hiểu từng thớ gỗ như cậu quý hơn cả rương vàng.'
                },
                milestoneRewards: {
                    2: { coins: 50, items: { wood: 3 } },
                    4: { coins: 100, items: { plank: 3 } },
                    5: { renown: 3, items: { plank: 5 } }
                }
            },
            {
                id: 'linh', name: 'Linh', role: 'Người pha trà', map: 'village', x: 650, y: 520, shirt: '#93b8c9', hair: '#5c394a',
                dialogue: [
                    'Lá bạc hà thơm nhất sau một cơn mưa. Bạn thử đi dạo trong rừng lúc trời mưa xem.',
                    'Hai lá bạc hà và một quả mâm xôi là đủ cho một ấm trà bình minh.',
                    'Trà ấm và một ngọn đèn nhỏ khiến chuyến đi đêm dễ chịu hơn nhiều.'
                ],
                giftPreferences: {
                    loved: ['tea', 'herb'],
                    liked: ['berry', 'crystal'],
                    neutral: ['wood', 'plank', 'star', 'meal', 'carrot', 'wheat'],
                    disliked: ['fish', 'ore']
                },
                giftReactions: {
                    loved: 'Lá bạc hà tươi sau mưa và ấm trà này... Hương thơm thật thanh khiết! Cảm ơn bạn!',
                    liked: 'Thật nhã nhặn! Món quà này làm ấm lòng người pha trà.',
                    neutral: 'Cảm ơn bạn nhé, tôi sẽ giữ gìn cẩn thận.',
                    disliked: 'Mùi tanh và bụi quặng thế này sẽ làm hỏng mất vị thanh của trà...'
                },
                heartDialogues: {
                    2: 'Mỗi cơn mưa qua đi đều để lại giọt sương trên lá. Lắng nghe tiếng mưa cũng là một cách tìm thấy bình yên.',
                    4: 'Ngày làng bị chia cắt, tôi từng sợ không còn ai ghé quán uống trà nữa. Thật may là bạn đã đến.',
                    5: 'Ấm trà ngon nhất là ấm trà được sẻ chia cùng tri kỷ. Tách trà đầu ngày luôn dành riêng cho bạn.'
                },
                milestoneRewards: {
                    2: { coins: 40, items: { herb: 2 } },
                    4: { coins: 80, items: { tea: 2 } },
                    5: { renown: 3, items: { tea: 2 } }
                }
            },
            {
                id: 'thao', name: 'Thảo', role: 'Người chăm vườn', map: 'village', x: 900, y: 620, shirt: '#eaaa70', hair: '#604432',
                dialogue: [
                    'Những luống đất phía nam đang chờ người gieo trồng. Ghé lại sau khi cây đã chín nhé.',
                    'Nhà kính giúp quả lớn nhanh hơn. Một khu vườn nhỏ cũng đủ nuôi cả chuyến phiêu lưu.',
                    'Tôi thích mâm xôi, nhưng điều tôi thích hơn là thấy mảnh đất trống thành khu vườn.'
                ],
                giftPreferences: {
                    loved: ['berry', 'tea'],
                    liked: ['herb', 'wood', 'carrot', 'wheat'],
                    neutral: ['plank', 'star', 'meal'],
                    disliked: ['ore', 'crystal']
                },
                giftReactions: {
                    loved: 'Những quả mâm xôi mọng nước tuyệt vời! Nhìn chúng là tôi thấy công sức được đền đáp xứng đáng.',
                    liked: 'Cây cối và đất vườn sẽ rất thích món quà này đấy!',
                    neutral: 'Cảm ơn bạn nhé, món quà mộc mạc và dễ thương lắm.',
                    disliked: 'Đá quặng khô khốc này chẳng giúp hạt mầm lớn lên được chút nào...'
                },
                heartDialogues: {
                    2: 'Cây cỏ cũng có tiếng nói riêng. Tưới tắm đủ nước và tình cảm, chúng sẽ đơm hoa kết trái.',
                    4: 'Nhìn khu vườn từ mảnh đất trống biến thành những luống quả xanh tươi, tôi biết thung lũng đã thực sự sống lại.',
                    5: 'Mỗi hạt mầm tôi gieo hôm nay đều mang lời chúc bình an dành cho bạn.'
                },
                milestoneRewards: {
                    2: { coins: 40, items: { berry: 4 } },
                    4: { coins: 80, items: { tea: 1 } },
                    5: { renown: 3, items: { berry: 5 } }
                }
            },
            {
                id: 'bao', name: 'Bảo', role: 'Người coi chợ', map: 'village', x: 1150, y: 520, shirt: '#a493d1', hair: '#413d54',
                dialogue: [
                    'Có vật liệu dư thì ghé bán ở chợ. Đừng bán hết đồ dành cho nhiệm vụ đang nhận nhé!',
                    'Mở sạp phiên chợ sẽ giúp vật liệu của bạn bán được giá hơn.',
                    'Túi hành trình lớn hơn luôn là món đầu tư tốt cho người hay đi xa.'
                ],
                giftPreferences: {
                    loved: ['crystal', 'star'],
                    liked: ['meal', 'lantern', 'fish'],
                    neutral: ['plank', 'ore', 'wood', 'berry', 'carrot', 'wheat'],
                    disliked: ['herb']
                },
                giftReactions: {
                    loved: 'Ánh sáng lấp lánh này... Đích thị là bảo vật quý giá nhất phiên chợ! Cậu thật có mắt nhìn hàng!',
                    liked: 'Món hàng giá trị đấy! Cảm ơn cậu đã ưu ái mang đến phiên chợ.',
                    neutral: 'Được đấy, buôn bán luôn chào đón những món đồ hữu ích.',
                    disliked: 'Lá cỏ dại này bày ra chợ chẳng ai hỏi mua đâu, mất công dọn sạp lắm.'
                },
                heartDialogues: {
                    2: 'Chợ không chỉ là nơi đổi chác, mà là nơi người ta gặp nhau để thấy làng mình không còn cô độc.',
                    4: 'Thương gia đi khắp bốn phương nhưng chỉ có Làng Ánh Sao là nơi tôi muốn neo lại thuyền buôn.',
                    5: 'Với tôi, mối giao hảo chân thành của chúng ta có giá trị hơn mọi rương ngọc ngà châu báu.'
                },
                milestoneRewards: {
                    2: { coins: 80 },
                    4: { coins: 150, items: { star: 1 } },
                    5: { renown: 3, coins: 200 }
                }
            },
            {
                id: 'nam', name: 'Nam', role: 'Thợ đèn', map: 'village', x: 400, y: 620, shirt: '#e4bd62', hair: '#3e4b62',
                dialogue: [
                    'Đèn phải soi được đường chứ! Dựng dãy đèn lối đi, tối đến bạn sẽ thấy khác ngay.',
                    'Đèn sao cầm tay giúp bạn nhìn rõ xung quanh trong cả đêm tối và mưa.',
                    'Đèn dẫn sao trên đồi cần nhiều vật liệu, nhưng tôi tin chúng ta sẽ làm được.'
                ],
                giftPreferences: {
                    loved: ['lantern', 'star'],
                    liked: ['ore', 'plank'],
                    neutral: ['tea', 'meal', 'wood', 'crystal', 'carrot', 'wheat'],
                    disliked: ['fish', 'herb']
                },
                giftReactions: {
                    loved: 'Chiếc đèn sao tự tay bạn chế tác thật hoàn hảo! Ngọn lửa sao bên trong tỏa sáng ấm áp lạ kỳ!',
                    liked: 'Vật liệu làm đèn rất tốt! Cảm ơn bạn nhiều nhé.',
                    neutral: 'Cảm ơn bạn! Món đồ này sẽ dùng được vào việc thích hợp.',
                    disliked: 'Mùi tanh nồng hay lá ướt này dễ làm tắt ngọn lửa đèn đường mất.'
                },
                heartDialogues: {
                    2: 'Ban đêm không còn đáng sợ nữa khi từng góc đường đều có ánh đèn đón bước chân bạn.',
                    4: 'Khi ngọn đèn trên đồi được thắp lên, tôi đã thấy ánh mắt của mọi người bừng sáng như những vì sao.',
                    5: 'Dù đêm tối có mịt mùng đến đâu, chỉ cần bạn cần, tôi sẽ là ngọn đèn dẫn lối cho bạn trở về.'
                },
                milestoneRewards: {
                    2: { coins: 50, items: { ore: 2 } },
                    4: { coins: 80, items: { lantern: 1 } },
                    5: { renown: 3, items: { star: 2 } }
                }
            },
            {
                id: 'yen', name: 'Yến', role: 'Người sưu tầm chuyện xưa', map: 'village', x: 650, y: 620, shirt: '#76adb0', hair: '#4a354d',
                dialogue: [
                    'Tàn Tích Mây từng là trạm quan sát bầu trời. Kho lưu trữ của làng có bản đồ đến đó.',
                    'Những bia cộng hưởng giữ lại ký ức của cơn mưa sao. Hãy chạm vào chúng khi khám phá.',
                    'Tôi muốn ghi lại tên mọi người đã giúp làng hồi sinh. Cả tên bạn nữa.'
                ],
                giftPreferences: {
                    loved: ['star', 'crystal'],
                    liked: ['tea', 'lantern'],
                    neutral: ['berry', 'herb', 'plank', 'meal', 'wood', 'carrot', 'wheat'],
                    disliked: ['ore', 'fish']
                },
                giftReactions: {
                    loved: 'Những mảnh sao và tinh thể mang ký ức của bầu trời cổ xưa! Phát hiện này sẽ làm sáng tỏ cả trang sử của làng!',
                    liked: 'Thật tao nhã và hữu dụng cho những đêm thức chép sử thi.',
                    neutral: 'Cảm ơn bạn, tôi sẽ ghi nhận món quà vào nhật ký hành trình.',
                    disliked: 'Quặng chưa mài thô ráp và cá ẩm ướt dễ làm ố những trang thư tịch cổ...'
                },
                heartDialogues: {
                    2: 'Tàn Tích Mây lưu giữ những vết tích về những người ngắm sao từ ngàn năm trước. Họ cũng từng yêu thung lũng như chúng ta.',
                    4: 'Tôi đã viết một chương dài trong sử thi làng về bạn — người đánh thức những đài thiên văn ngủ say.',
                    5: 'Thời gian có thể xóa nhòa đền đài, nhưng tình bạn giữa chúng ta sẽ sống mãi trong trang sử này.'
                },
                milestoneRewards: {
                    2: { coins: 60, items: { tea: 1 } },
                    4: { coins: 100, items: { crystal: 1 } },
                    5: { renown: 3, items: { star: 2 } }
                }
            },
            {
                id: 'son', name: 'Sơn', role: 'Đầu bếp', map: 'village', x: 1150, y: 620, shirt: '#e98f89', hair: '#634334',
                dialogue: [
                    'Sau chuyến đi dài, một hộp cơm dã ngoại sẽ giúp bạn hồi sức.',
                    'Có bếp chung rồi thì mang cá, quả và lá bạc hà đến chế biến.',
                    'Đêm hội sao cần thật nhiều món ngon. Tôi dành cho bạn một chỗ ngồi cạnh cửa sổ.'
                ],
                giftPreferences: {
                    loved: ['fish', 'meal'],
                    liked: ['berry', 'herb', 'carrot', 'wheat'],
                    neutral: ['wood', 'tea', 'star'],
                    disliked: ['ore', 'plank', 'crystal']
                },
                giftReactions: {
                    loved: 'Cá vịnh tươi roi rói! Cơm dã ngoại thơm phức! Đây chính là nguyên liệu tuyệt nhất cho gian bếp chung!',
                    liked: 'Gia vị và hoa quả tươi ngon! Bếp hôm nay lại có món hấp dẫn rồi!',
                    neutral: 'Cảm ơn bạn! Món này cũng hữu ích cho gian bếp đấy.',
                    disliked: 'Gỗ đá kim loại này đâu thể cho vào nồi hầm được hả bạn?'
                },
                heartDialogues: {
                    2: 'Nấu ăn cho cả làng là niềm hạnh phúc lớn nhất của tôi. Tiếng cười bên mâm cơm làm tan biến mọi mệt nhọc.',
                    4: 'Bí quyết của một món ngon không nằm ở gia vị đắt tiền, mà ở tấm lòng muốn người thưởng thức được ấm bụng.',
                    5: 'Bàn ăn cạnh cửa sổ nhìn ra quảng trường luôn luôn để sẵn phần cơm nóng hổi dành riêng cho bạn!'
                },
                milestoneRewards: {
                    2: { coins: 50, items: { meal: 1 } },
                    4: { coins: 80, items: { meal: 2 } },
                    5: { renown: 3, items: { meal: 3 } }
                }
            },
            {
                id: 'sen', name: 'Sen', role: 'Người dẫn đường rừng', map: 'forest', x: 350, y: 550, shirt: '#759b63', hair: '#694631',
                dialogue: [
                    'Rừng có gỗ, bạc hà và những chú slime nghịch ngợm. Nhớ giữ sức khi đi xa.',
                    'Bia cộng hưởng ở sâu trong rừng đang phát ra một tiếng ngân rất lạ.',
                    'Hãy hái vừa đủ và quay lại sau. Rừng luôn có quà mới cho người kiên nhẫn.'
                ],
                giftPreferences: {
                    loved: ['herb', 'meal'],
                    liked: ['wood', 'berry', 'carrot', 'wheat'],
                    neutral: ['fish', 'tea', 'plank', 'star'],
                    disliked: ['crystal', 'lantern']
                },
                giftReactions: {
                    loved: 'Lá thảo mộc rừng sâu và cơm dã ngoại tiếp sức! Chuyến đi tuần rừng hôm nay có bạn tiếp sức thì yên tâm rồi!',
                    liked: 'Món quà từ thiên nhiên luôn làm lòng người dịu lại.',
                    neutral: 'Cảm ơn bạn, chuyến đi rừng sắp tới sẽ hữu ích.',
                    disliked: 'Ánh sáng nhân tạo và đá phát quang làm kinh động muông thú ban đêm...'
                },
                heartDialogues: {
                    2: 'Rừng Rì Rào che chở cho muôn loài. Hãy bước đi thật êm ái, cây cối sẽ thì thầm dẫn đường cho bạn.',
                    4: 'Ngày trước chỉ có tôi một mình lắng nghe tiếng gió rít qua tàng cây. Giờ đây tôi biết mình có một người bạn đồng hành tin cậy.',
                    5: 'Rừng sâu có thể hiểm trở với người lạ, nhưng với bạn, mọi ngọn cây ngọn cỏ đều sẽ dang tay chào đón.'
                },
                milestoneRewards: {
                    2: { coins: 50, items: { herb: 3 } },
                    4: { coins: 80, items: { meal: 2 } },
                    5: { renown: 3, items: { herb: 5 } }
                }
            },
            {
                id: 'kiet', name: 'Kiệt', role: 'Người bạn của thủy triều', map: 'coast', x: 350, y: 550, shirt: '#68a4cd', hair: '#554135',
                dialogue: [
                    'Mặt nước lấp lánh là chỗ có cá. Đứng gần rồi tương tác để thả câu.',
                    'Bờ vịnh còn có mảnh sao bị sóng đưa vào. Tìm cả những rương nhỏ ven đường nhé.',
                    'Tôi sẽ đem cá đến đêm hội. Bạn giúp tôi làm cây cầu chắc hơn là đủ!'
                ],
                giftPreferences: {
                    loved: ['fish', 'lantern'],
                    liked: ['tea', 'wood'],
                    neutral: ['berry', 'plank', 'star', 'meal', 'herb', 'carrot', 'wheat'],
                    disliked: ['ore', 'crystal']
                },
                giftReactions: {
                    loved: 'Con cá vịnh lấp lánh vảy bạc và cây đèn sao soi mặt nước đêm! Bạn đúng là bạn câu ăn ý nhất trần đời!',
                    liked: 'Ấm lòng lắm! Có thứ này ra khơi đón gió biển thì tuyệt.',
                    neutral: 'Cảm ơn bạn! Đi biển luôn cần chuẩn bị chu đáo.',
                    disliked: 'Quặng sắt với đá nặng trĩu này mang xuống thuyền chỉ làm đắm bè thôi...'
                },
                heartDialogues: {
                    2: 'Biển cả bao la nhưng cũng rất rộng lượng. Cứ kiên nhẫn thả câu, sóng sẽ mang món quà bất ngờ tới cho bạn.',
                    4: 'Cây Cầu Gió Biển nối liền vịnh với làng đã giúp tiếng cười trở lại với bến nước này. Công của bạn lớn lắm.',
                    5: 'Sóng biển vỗ bờ rồi lại rút ra xa, nhưng tình bạn giữa chúng ta sẽ vững chãi như rạn san hô dưới đáy vịnh.'
                },
                milestoneRewards: {
                    2: { coins: 50, items: { fish: 2 } },
                    4: { coins: 80, items: { lantern: 1, fish: 2 } },
                    5: { renown: 3, items: { fish: 4 } }
                }
            },
            {
                id: 'ly', name: 'Ly', role: 'Nhà thám hiểm', map: 'ruins', x: 350, y: 550, shirt: '#b08ec5', hair: '#3d4962',
                dialogue: [
                    'Chào người đồng hành! Tinh thể trời nằm giữa các cột đá của Tàn Tích Mây.',
                    'Cổ nhân sắp xếp các bia sao theo quỹ đạo ánh sáng: từ Tây sang Bắc rồi về Đông. Hãy lắng nghe tiếng chuông ngân của từng phiến đá.',
                    'Khôi phục đài ngắm sao và đèn dẫn sao, chúng ta sẽ hiểu thông điệp của bầu trời.'
                ],
                giftPreferences: {
                    loved: ['crystal', 'lantern'],
                    liked: ['star', 'meal'],
                    neutral: ['tea', 'ore', 'berry', 'plank', 'herb', 'carrot', 'wheat'],
                    disliked: ['wood']
                },
                giftReactions: {
                    loved: 'Tinh thể trời nguyên vẹn và ngọn đèn sao bền bỉ! Với hai thứ này, không góc khuất nào ngăn được bước chân ta!',
                    liked: 'Thức ăn dự trữ và mảnh sao dẫn đường, thật chu đáo!',
                    neutral: 'Cảm ơn người bạn đồng hành! Món đồ này sẽ có ích.',
                    disliked: 'Khúc gỗ mục này vướng víu quá, leo trèo trong tàn tích chỉ tổ vấp ngã.'
                },
                heartDialogues: {
                    2: 'Những vết nứt trên cột đá Tàn Tích Mây không phải là đổ nát, mà là dấu ấn kiêu hãnh của thời gian.',
                    4: 'Khám phá di tích không phải để chiếm đoạt kho báu, mà để nhắc nhở chúng ta về những giấc mơ của tiền nhân.',
                    5: 'Dù bầu trời có sụp xuống hay ngàn năm trôi qua, ta biết mình đã tìm được người đồng hành vĩ đại nhất.'
                },
                milestoneRewards: {
                    2: { coins: 60, items: { star: 1 } },
                    4: { coins: 100, items: { crystal: 2 } },
                    5: { renown: 3, items: { crystal: 2, star: 1 } }
                }
            }
        ],
        upgrades: [
            { id: 'well', name: 'Giếng Suối Trong', description: 'Phục hồi thể lực nhanh hơn khi nghỉ bên giếng giữa làng.', cost: 70, materials: { wood: 4, ore: 2 }, prerequisites: [], effect: 'Hồi thể lực nhanh hơn ở làng.' },
            { id: 'workshop', name: 'Xưởng Mộc Lá Phong', description: 'Mở công thức ván gỗ và đèn sao cho các chuyến phiêu lưu.', cost: 140, materials: { wood: 8, ore: 5 }, prerequisites: [], effect: 'Mở chế tạo ván gỗ và đèn sao.' },
            { id: 'lamps', name: 'Dãy Đèn Đom Đóm', description: 'Lắp thêm đèn thật sự soi sáng đường làng vào ban đêm và khi mưa.', cost: 120, materials: { wood: 4, ore: 3 }, prerequisites: [], effect: 'Tăng số đèn và vùng sáng trên đường làng.' },
            { id: 'bridge', name: 'Cầu Gió Biển', description: 'Nối đường làng với Bờ Vịnh Ngọc, mở vùng đánh cá và tìm mảnh sao.', cost: 260, materials: { wood: 10, ore: 4 }, prerequisites: [], effect: 'Mở đường đến Bờ Vịnh Ngọc.' },
            { id: 'archive', name: 'Kho Chuyện Mây', description: 'Khôi phục bản đồ cổ để mở lối đến Tàn Tích Mây.', cost: 340, materials: { wood: 6, ore: 8, star: 2 }, prerequisites: ['bridge'], effect: 'Mở đường đến Tàn Tích Mây.' },
            { id: 'greenhouse', name: 'Vườn Kính Ban Mai', description: 'Giữ ấm các luống mâm xôi để cây lớn nhanh hơn.', cost: 230, materials: { wood: 8, ore: 4, plank: 3 }, prerequisites: ['workshop'], effect: 'Rút ngắn thời gian chờ thu hoạch.' },
            { id: 'market', name: 'Phiên Chợ Cầu Vồng', description: 'Dựng sạp chợ mới để bán vật liệu với giá tốt hơn.', cost: 180, materials: { wood: 6, ore: 3 }, prerequisites: [], effect: 'Tăng giá bán vật liệu.' },
            { id: 'boots', name: 'Giày Lướt Cỏ', description: 'Đi nhanh hơn trên đường và giữa những chuyến thám hiểm.', cost: 110, materials: { herb: 4, ore: 3 }, prerequisites: [], effect: 'Tăng tốc độ di chuyển.' },
            { id: 'bag', name: 'Túi Hành Trình', description: 'Tăng sức chứa để mang về nhiều đồ hơn sau mỗi chuyến đi.', cost: 100, materials: { wood: 5, herb: 3 }, prerequisites: [], effect: 'Tăng giới hạn vật phẩm trong túi.' },
            { id: 'kitchen', name: 'Bếp Chung Hương Gió', description: 'Mở công thức cơm dã ngoại giúp hồi thể lực khi khám phá.', cost: 190, materials: { wood: 8, ore: 4 }, prerequisites: ['well'], effect: 'Mở chế tạo cơm dã ngoại.' },
            { id: 'observatory', name: 'Đài Ngắm Sao', description: 'Giải mã những vệt sao và gợi ý nơi tìm mảnh sao.', cost: 380, materials: { plank: 6, crystal: 3, star: 5 }, prerequisites: ['archive', 'workshop'], effect: 'Hiện gợi ý tìm mảnh sao trên bản đồ.' },
            { id: 'beacon', name: 'Đèn Dẫn Sao', description: 'Thắp sáng đỉnh đồi, hoàn thành hành trình hồi sinh và mở đêm hội sao.', cost: 650, materials: { plank: 8, crystal: 6, star: 8 }, prerequisites: ['observatory', 'lamps'], effect: 'Thắp vùng sáng lớn ở làng và hoàn thành đêm hội sao.' }
        ],
        recipes: [
            { id: 'plank', name: 'Cưa ván gỗ', description: 'Ba khúc gỗ thông tạo thành hai tấm ván chắc chắn.', requires: 'workshop', input: { wood: 3 }, output: { plank: 2 } },
            { id: 'tea', name: 'Pha trà bình minh', description: 'Một ấm trà từ lá bạc hà và mâm xôi.', requires: null, input: { herb: 2, berry: 1 }, output: { tea: 1 } },
            { id: 'lantern', name: 'Lắp đèn sao', description: 'Ghép ván, quặng đồng và một mảnh sao thành đèn mang theo.', requires: 'workshop', input: { plank: 2, ore: 2, star: 1 }, output: { lantern: 1 } },
            { id: 'meal', name: 'Nấu cơm dã ngoại', description: 'Cá và mâm xôi làm thành phần ăn giúp hồi sức.', requires: 'kitchen', input: { fish: 1, berry: 2, herb: 1 }, output: { meal: 1 } }
        ],
        quests: [
            { id: 'story01', title: 'Lá thư lúc bình minh', kind: 'story', description: 'Tìm Mira ở quảng trường để nghe câu chuyện cơn mưa sao và nhận vai trò người khôi phục làng.', giver: 'mira', requires: [], upgrade: null, objectives: [{ type: 'talk', target: 'mira', count: 1 }], reward: { coins: 50, xp: 35, renown: 1, items: { berry: 2 } } },
            { id: 'story02', title: 'Túi quà từ đường mòn', kind: 'story', description: 'Thu thập gỗ thông và lá bạc hà. Những vật liệu bé nhỏ là khởi đầu của mọi công trình.', giver: 'mira', requires: ['story01'], upgrade: null, objectives: [{ type: 'gather', target: 'wood', count: 6 }, { type: 'gather', target: 'herb', count: 3 }], reward: { coins: 60, xp: 45, renown: 1, items: { ore: 2 } } },
            { id: 'story03', title: 'Một mái hiên mới', kind: 'story', description: 'Mang bốn gỗ thông đến Huy để sửa mái hiên bị cơn mưa sao làm hỏng.', giver: 'huy', requires: ['story02'], upgrade: null, objectives: [{ type: 'deliver', target: 'wood', count: 4 }], reward: { coins: 75, xp: 45, renown: 2 } },
            { id: 'story04', title: 'Dòng nước trở về', kind: 'story', description: 'Khôi phục Giếng Suối Trong. Từ nay những chuyến đi sẽ có một nơi nghỉ chân.', giver: 'mira', requires: ['story03'], upgrade: null, objectives: [{ type: 'build', target: 'well', count: 1 }], reward: { coins: 85, xp: 65, renown: 2 } },
            { id: 'story05', title: 'Lời hẹn bên tán lá', kind: 'story', description: 'Đến Rừng Rì Rào và gặp Sen, người biết rõ mọi ngả đường trong rừng.', giver: 'sen', requires: ['story04'], upgrade: null, objectives: [{ type: 'visit', target: 'forest', count: 1 }, { type: 'talk', target: 'sen', count: 1 }], reward: { coins: 70, xp: 65, renown: 1 } },
            { id: 'story06', title: 'Tiếng ngân dưới rễ cây', kind: 'story', description: 'Đánh bại ba slime nghịch ngợm và đánh thức bia cộng hưởng của rừng.', giver: 'sen', requires: ['story05'], upgrade: null, objectives: [{ type: 'fight', target: 'slime', count: 3 }, { type: 'shrine', target: 'forest', count: 1 }], reward: { coins: 110, xp: 95, renown: 3, items: { star: 2 } } },
            { id: 'story07', title: 'Mạch đồng ấm áp', kind: 'story', description: 'Tìm sáu quặng đồng để Huy có thể bắt đầu dựng xưởng chế tạo.', giver: 'huy', requires: ['story06'], upgrade: null, objectives: [{ type: 'gather', target: 'ore', count: 6 }], reward: { coins: 80, xp: 60, renown: 1, items: { wood: 4 } } },
            { id: 'story08', title: 'Tiếng búa lá phong', kind: 'story', description: 'Dựng Xưởng Mộc Lá Phong trong mục nâng cấp. Xưởng mở công thức ván gỗ và đèn sao.', giver: 'huy', requires: ['story07'], upgrade: null, objectives: [{ type: 'build', target: 'workshop', count: 1 }], reward: { coins: 110, xp: 85, renown: 2, items: { wood: 3 } } },
            { id: 'story09', title: 'Mẻ chế tạo đầu tiên', kind: 'story', description: 'Cưa ván gỗ hai lần và pha một ấm trà bình minh trong xưởng chế tạo.', giver: 'huy', requires: ['story08'], upgrade: 'workshop', objectives: [{ type: 'craft', target: 'plank', count: 2 }, { type: 'craft', target: 'tea', count: 1 }], reward: { coins: 95, xp: 75, renown: 2 } },
            { id: 'story10', title: 'Trà cho người giữ chuyện', kind: 'story', description: 'Mang một trà bình minh cho Yến. Cô ấy đã thức nhiều đêm để cứu những bản đồ cũ.', giver: 'yen', requires: ['story09'], upgrade: null, objectives: [{ type: 'deliver', target: 'tea', count: 1 }], reward: { coins: 95, xp: 65, renown: 2, items: { ore: 3 } } },
            { id: 'story11', title: 'Con đường đom đóm', kind: 'story', description: 'Dựng Dãy Đèn Đom Đóm để những con đường làng có ánh sáng thực sự.', giver: 'nam', requires: ['story10'], upgrade: null, objectives: [{ type: 'build', target: 'lamps', count: 1 }], reward: { coins: 115, xp: 85, renown: 3 } },
            { id: 'story12', title: 'Đi dạo khi sao thức', kind: 'story', description: 'Trở về Làng Ánh Sao khi trời tối và nhìn ánh đèn soi rõ đường dưới chân.', giver: 'nam', requires: ['story11'], upgrade: 'lamps', objectives: [{ type: 'night', target: 'village', count: 1 }], reward: { coins: 85, xp: 60, renown: 1, items: { berry: 3 } } },
            { id: 'story13', title: 'Ba mầm xanh nhỏ', kind: 'story', description: 'Gieo mâm xôi trên ba luống vườn ở làng. Một khu vườn cũng là một lời hứa.', giver: 'thao', requires: ['story12'], upgrade: null, objectives: [{ type: 'plant', target: 'berry', count: 3 }], reward: { coins: 80, xp: 65, renown: 2 } },
            { id: 'story14', title: 'Mùa quả của bạn', kind: 'story', description: 'Chờ cây chín rồi thu hoạch ba luống mâm xôi. Trở lại vườn thường xuyên để chăm hành trình của mình.', giver: 'thao', requires: ['story13'], upgrade: null, objectives: [{ type: 'harvest', target: 'berry', count: 3 }], reward: { coins: 120, xp: 85, renown: 2, items: { wood: 5 } } },
            { id: 'story15', title: 'Qua cầu nghe gió', kind: 'story', description: 'Dựng Cầu Gió Biển để nối làng với vùng bờ vịnh còn bị chia cắt.', giver: 'huy', requires: ['story14'], upgrade: null, objectives: [{ type: 'build', target: 'bridge', count: 1 }], reward: { coins: 160, xp: 110, renown: 3 } },
            { id: 'story16', title: 'Ba lần phao rung', kind: 'story', description: 'Khám phá Bờ Vịnh Ngọc và câu ba con cá ở điểm nước lấp lánh.', giver: 'kiet', requires: ['story15'], upgrade: 'bridge', objectives: [{ type: 'visit', target: 'coast', count: 1 }, { type: 'fish', target: 'fish', count: 3 }], reward: { coins: 130, xp: 95, renown: 2 } },
            { id: 'story17', title: 'Ký ức của thủy triều', kind: 'story', description: 'Chào Kiệt rồi chạm vào bia cộng hưởng ở bờ vịnh để nghe phần tiếp theo của câu chuyện sao rơi.', giver: 'kiet', requires: ['story16'], upgrade: 'bridge', objectives: [{ type: 'talk', target: 'kiet', count: 1 }, { type: 'shrine', target: 'coast', count: 1 }], reward: { coins: 145, xp: 100, renown: 3, items: { star: 2 } } },
            { id: 'story18', title: 'Mùi bạc hà sau mưa', kind: 'story', description: 'Nhặt bốn mảnh sao và hái bạc hà lúc trời mưa. Thung lũng còn nhiều món quà chỉ xuất hiện khi bạn để ý thời tiết.', giver: 'linh', requires: ['story17'], upgrade: null, objectives: [{ type: 'gather', target: 'star', count: 4 }, { type: 'rain', target: 'herb', count: 1 }], reward: { coins: 130, xp: 100, renown: 2 } },
            { id: 'story19', title: 'Mang sao trong túi', kind: 'story', description: 'Chế tạo một đèn sao. Mang đèn theo để soi đường quanh bạn vào ban đêm.', giver: 'nam', requires: ['story18'], upgrade: 'workshop', objectives: [{ type: 'craft', target: 'lantern', count: 1 }], reward: { coins: 145, xp: 100, renown: 2 } },
            { id: 'story20', title: 'Bản đồ trong mây', kind: 'story', description: 'Mở Kho Chuyện Mây để tìm lối đến Tàn Tích Mây và bí mật cuối cùng của cơn mưa sao.', giver: 'yen', requires: ['story19'], upgrade: null, objectives: [{ type: 'build', target: 'archive', count: 1 }], reward: { coins: 180, xp: 125, renown: 3 } },
            { id: 'story21', title: 'Tiếng vọng trên đá', kind: 'story', description: 'Đến Tàn Tích Mây, gặp Ly và đánh thức bia cộng hưởng cuối cùng.', giver: 'ly', requires: ['story20'], upgrade: 'archive', objectives: [{ type: 'visit', target: 'ruins', count: 1 }, { type: 'talk', target: 'ly', count: 1 }, { type: 'shrine', target: 'ruins', count: 1 }], reward: { coins: 185, xp: 135, renown: 3 } },
            { id: 'story22', title: 'Ánh trời trong lòng đất', kind: 'story', description: 'Tìm ba tinh thể trời và mở hai rương thám hiểm. Chúng chứa những món quà cho công trình trên đồi.', giver: 'ly', requires: ['story21'], upgrade: 'archive', objectives: [{ type: 'gather', target: 'crystal', count: 3 }, { type: 'chest', target: 'treasure', count: 2 }], reward: { coins: 220, xp: 145, renown: 3, items: { star: 3 } } },
            { id: 'story23', title: 'Bầu trời có câu trả lời', kind: 'story', description: 'Dựng Đài Ngắm Sao để xác định nơi các mảnh sao còn đang nằm lại.', giver: 'yen', requires: ['story22'], upgrade: null, objectives: [{ type: 'build', target: 'observatory', count: 1 }], reward: { coins: 260, xp: 160, renown: 4, items: { crystal: 2, star: 2 } } },
            { id: 'story24', title: 'Đêm hội sao trở lại', kind: 'story', description: 'Dựng Đèn Dẫn Sao. Ánh sáng trên đồi sẽ báo cho cả thung lũng rằng ngôi làng đã hồi sinh.', giver: 'mira', requires: ['story23'], upgrade: null, objectives: [{ type: 'build', target: 'beacon', count: 1 }], reward: { coins: 500, xp: 350, renown: 10, items: { meal: 3 } } },

            { id: 'side01', title: 'Chào những người hàng xóm', kind: 'side', description: 'Làm quen với Huy, Linh và Thảo để biết làng đang cần những gì.', giver: 'mira', requires: ['story01'], upgrade: null, objectives: [{ type: 'talk', target: 'huy', count: 1 }, { type: 'talk', target: 'linh', count: 1 }, { type: 'talk', target: 'thao', count: 1 }], reward: { coins: 70, xp: 45, renown: 2 } },
            { id: 'side02', title: 'Kho củi cho mùa gió', kind: 'side', description: 'Thu thập tám gỗ thông cho kho vật liệu của làng.', giver: 'huy', requires: ['story01'], upgrade: null, objectives: [{ type: 'gather', target: 'wood', count: 8 }], reward: { coins: 75, xp: 45, renown: 1 } },
            { id: 'side03', title: 'Hương lá trên cửa sổ', kind: 'side', description: 'Mang bốn lá bạc hà cho Linh để trồng vào chậu bên cửa.', giver: 'linh', requires: ['story02'], upgrade: null, objectives: [{ type: 'deliver', target: 'herb', count: 4 }], reward: { coins: 60, xp: 40, renown: 1, items: { berry: 2 } } },
            { id: 'side04', title: 'Giỏ quả màu nắng', kind: 'side', description: 'Hái sáu quả mâm xôi làm quà cho phiên chợ nhỏ.', giver: 'bao', requires: ['story02'], upgrade: null, objectives: [{ type: 'gather', target: 'berry', count: 6 }], reward: { coins: 75, xp: 50, renown: 1 } },
            { id: 'side05', title: 'Thử chân trên lối mòn', kind: 'side', description: 'Ghé Rừng Rì Rào và tìm Sen để nhận lời khuyên cho chuyến đi đầu tiên.', giver: 'sen', requires: ['story03'], upgrade: null, objectives: [{ type: 'visit', target: 'forest', count: 1 }, { type: 'talk', target: 'sen', count: 1 }], reward: { coins: 65, xp: 50, renown: 1 } },
            { id: 'side06', title: 'Slime thôi nghịch nào', kind: 'side', description: 'Đánh bại năm slime để đường rừng an toàn hơn cho mọi người.', giver: 'sen', requires: ['story05'], upgrade: null, objectives: [{ type: 'fight', target: 'slime', count: 5 }], reward: { coins: 120, xp: 95, renown: 2, items: { herb: 3 } } },
            { id: 'side07', title: 'Quặng cho hộp dụng cụ', kind: 'side', description: 'Giao năm quặng đồng cho Huy làm lại bộ dụng cụ.', giver: 'huy', requires: ['story06'], upgrade: null, objectives: [{ type: 'deliver', target: 'ore', count: 5 }], reward: { coins: 95, xp: 60, renown: 2 } },
            { id: 'side08', title: 'Túi nhỏ, chuyến đi lớn', kind: 'side', description: 'Nâng cấp Túi Hành Trình để mang được nhiều vật liệu hơn.', giver: 'bao', requires: ['story03'], upgrade: null, objectives: [{ type: 'build', target: 'bag', count: 1 }], reward: { coins: 80, xp: 65, renown: 1 } },
            { id: 'side09', title: 'Bước chân lướt cỏ', kind: 'side', description: 'Trang bị Giày Lướt Cỏ cho những chuyến thám hiểm dài.', giver: 'sen', requires: ['story05'], upgrade: null, objectives: [{ type: 'build', target: 'boots', count: 1 }], reward: { coins: 85, xp: 65, renown: 1 } },
            { id: 'side10', title: 'Ván gỗ cho ghế ngồi', kind: 'side', description: 'Cưa ván gỗ ba lần để học cách làm đồ dùng cho làng.', giver: 'huy', requires: ['story08'], upgrade: 'workshop', objectives: [{ type: 'craft', target: 'plank', count: 3 }], reward: { coins: 95, xp: 70, renown: 2 } },
            { id: 'side11', title: 'Ấm trà cho hội bạn', kind: 'side', description: 'Pha ba ấm trà bình minh để mọi người ngồi lại cùng nhau.', giver: 'linh', requires: ['story04'], upgrade: null, objectives: [{ type: 'craft', target: 'tea', count: 3 }], reward: { coins: 90, xp: 70, renown: 2 } },
            { id: 'side12', title: 'Một ngọn đèn gửi xa', kind: 'side', description: 'Mang một đèn sao đến Nam. Anh sẽ trao nó cho người đi rừng muộn.', giver: 'nam', requires: ['story08'], upgrade: 'workshop', objectives: [{ type: 'deliver', target: 'lantern', count: 1 }], reward: { coins: 120, xp: 85, renown: 2, items: { star: 2 } } },
            { id: 'side13', title: 'Vườn kính đón bình minh', kind: 'side', description: 'Dựng Vườn Kính Ban Mai để mâm xôi lớn nhanh hơn.', giver: 'thao', requires: ['story08'], upgrade: null, objectives: [{ type: 'build', target: 'greenhouse', count: 1 }], reward: { coins: 140, xp: 90, renown: 2 } },
            { id: 'side14', title: 'Vườn xanh ba ngày hẹn', kind: 'side', description: 'Gieo và thu hoạch sáu luống mâm xôi qua nhiều lượt chăm vườn.', giver: 'thao', requires: ['story13'], upgrade: null, objectives: [{ type: 'plant', target: 'berry', count: 6 }, { type: 'harvest', target: 'berry', count: 6 }], reward: { coins: 150, xp: 110, renown: 3 } },
            { id: 'side15', title: 'Phiên chợ mở cửa', kind: 'side', description: 'Dựng Phiên Chợ Cầu Vồng, nơi vật liệu được bán với giá tốt hơn.', giver: 'bao', requires: ['story04'], upgrade: null, objectives: [{ type: 'build', target: 'market', count: 1 }], reward: { coins: 110, xp: 80, renown: 2 } },
            { id: 'side16', title: 'Cá cho bữa tối', kind: 'side', description: 'Câu năm cá vịnh trong chuyến ghé biển tiếp theo.', giver: 'kiet', requires: ['story15'], upgrade: 'bridge', objectives: [{ type: 'fish', target: 'fish', count: 5 }], reward: { coins: 140, xp: 100, renown: 2 } },
            { id: 'side17', title: 'Quà từ sóng xanh', kind: 'side', description: 'Mang ba cá vịnh đến Sơn để cả làng có món mới.', giver: 'son', requires: ['story15'], upgrade: 'bridge', objectives: [{ type: 'deliver', target: 'fish', count: 3 }], reward: { coins: 105, xp: 75, renown: 2, items: { berry: 3 } } },
            { id: 'side18', title: 'Bếp ấm cuối đường', kind: 'side', description: 'Dựng Bếp Chung Hương Gió và nấu hai hộp cơm dã ngoại.', giver: 'son', requires: ['story15'], upgrade: null, objectives: [{ type: 'build', target: 'kitchen', count: 1 }, { type: 'craft', target: 'meal', count: 2 }], reward: { coins: 145, xp: 100, renown: 3 } },
            { id: 'side19', title: 'Sổ tay người nhìn sao', kind: 'side', description: 'Tìm sáu mảnh sao để Yến ghi lại hình dáng của từng mảnh.', giver: 'yen', requires: ['story15'], upgrade: 'bridge', objectives: [{ type: 'gather', target: 'star', count: 6 }], reward: { coins: 125, xp: 95, renown: 2 } },
            { id: 'side20', title: 'Cơn mưa có mùi thơm', kind: 'side', description: 'Hái bạc hà ba lần khi trời mưa để kiểm chứng bí quyết của Linh.', giver: 'linh', requires: ['story05'], upgrade: null, objectives: [{ type: 'rain', target: 'herb', count: 3 }], reward: { coins: 100, xp: 75, renown: 2 } },
            { id: 'side21', title: 'Đêm yên bên ngọn đèn', kind: 'side', description: 'Ghé làng vào ban đêm và trò chuyện với Nam sau khi đèn đường được lắp.', giver: 'nam', requires: ['story11'], upgrade: 'lamps', objectives: [{ type: 'night', target: 'village', count: 1 }, { type: 'talk', target: 'nam', count: 1 }], reward: { coins: 95, xp: 70, renown: 2 } },
            { id: 'side22', title: 'Kho báu dưới mây', kind: 'side', description: 'Mở ba rương thám hiểm trong những chuyến khám phá thung lũng.', giver: 'ly', requires: ['story20'], upgrade: 'archive', objectives: [{ type: 'chest', target: 'treasure', count: 3 }], reward: { coins: 180, xp: 125, renown: 3 } },
            { id: 'side23', title: 'Màu trời trong tinh thể', kind: 'side', description: 'Giao bốn tinh thể trời cho Yến để phục dựng một tấm bản đồ phát sáng.', giver: 'yen', requires: ['story20'], upgrade: 'archive', objectives: [{ type: 'deliver', target: 'crystal', count: 4 }], reward: { coins: 160, xp: 110, renown: 3, items: { star: 2 } } },
            { id: 'side24', title: 'Bữa cơm của người trở về', kind: 'side', description: 'Mang ba hộp cơm dã ngoại cho Mira làm quà cảm ơn các nhóm thám hiểm.', giver: 'mira', requires: ['story20'], upgrade: 'kitchen', objectives: [{ type: 'deliver', target: 'meal', count: 3 }], reward: { coins: 180, xp: 125, renown: 3 } },

            { id: 'daily01', title: 'Một bó gỗ mỗi sáng', kind: 'daily', description: 'Thu thập năm gỗ thông cho kho dùng chung.', giver: 'huy', requires: ['story01'], upgrade: null, objectives: [{ type: 'gather', target: 'wood', count: 5 }], reward: { coins: 45, xp: 30, renown: 1 } },
            { id: 'daily02', title: 'Bạc hà cho ấm mới', kind: 'daily', description: 'Hái bốn lá bạc hà trong chuyến đi hôm nay.', giver: 'linh', requires: ['story01'], upgrade: null, objectives: [{ type: 'gather', target: 'herb', count: 4 }], reward: { coins: 40, xp: 30, renown: 1 } },
            { id: 'daily03', title: 'Giỏ mâm xôi hôm nay', kind: 'daily', description: 'Thu thập bốn quả mâm xôi.', giver: 'thao', requires: ['story01'], upgrade: null, objectives: [{ type: 'gather', target: 'berry', count: 4 }], reward: { coins: 40, xp: 30, renown: 1 } },
            { id: 'daily04', title: 'Quặng đồng cho thợ', kind: 'daily', description: 'Tìm bốn quặng đồng cho nhóm sửa chữa.', giver: 'huy', requires: ['story03'], upgrade: null, objectives: [{ type: 'gather', target: 'ore', count: 4 }], reward: { coins: 50, xp: 35, renown: 1 } },
            { id: 'daily05', title: 'Chuyện trò ở quảng trường', kind: 'daily', description: 'Ghé chào Mira và Bảo trước chuyến phiêu lưu.', giver: 'mira', requires: ['story01'], upgrade: null, objectives: [{ type: 'talk', target: 'mira', count: 1 }, { type: 'talk', target: 'bao', count: 1 }], reward: { coins: 35, xp: 25, renown: 1 } },
            { id: 'daily06', title: 'Một vòng đường rừng', kind: 'daily', description: 'Ghé Rừng Rì Rào và đánh bại hai slime.', giver: 'sen', requires: ['story05'], upgrade: null, objectives: [{ type: 'visit', target: 'forest', count: 1 }, { type: 'fight', target: 'slime', count: 2 }], reward: { coins: 65, xp: 50, renown: 1 } },
            { id: 'daily07', title: 'Mẻ ván trước buổi trưa', kind: 'daily', description: 'Cưa ván gỗ hai lần trong xưởng.', giver: 'huy', requires: ['story08'], upgrade: 'workshop', objectives: [{ type: 'craft', target: 'plank', count: 2 }], reward: { coins: 55, xp: 40, renown: 1 } },
            { id: 'daily08', title: 'Ấm trà của ngày mới', kind: 'daily', description: 'Pha một ấm trà bình minh.', giver: 'linh', requires: ['story04'], upgrade: null, objectives: [{ type: 'craft', target: 'tea', count: 1 }], reward: { coins: 40, xp: 30, renown: 1 } },
            { id: 'daily09', title: 'Hẹn gặp ở bến cá', kind: 'daily', description: 'Câu ba cá vịnh ở Bờ Vịnh Ngọc.', giver: 'kiet', requires: ['story15'], upgrade: 'bridge', objectives: [{ type: 'fish', target: 'fish', count: 3 }], reward: { coins: 70, xp: 50, renown: 1 } },
            { id: 'daily10', title: 'Luống vườn cần bàn tay', kind: 'daily', description: 'Gieo hai luống mâm xôi rồi thu hoạch hai luống chín.', giver: 'thao', requires: ['story13'], upgrade: null, objectives: [{ type: 'plant', target: 'berry', count: 2 }, { type: 'harvest', target: 'berry', count: 2 }], reward: { coins: 65, xp: 45, renown: 1 } },
            { id: 'daily11', title: 'Mảnh sao bên bờ vịnh', kind: 'daily', description: 'Nhặt hai mảnh sao trong hành trình hôm nay.', giver: 'yen', requires: ['story15'], upgrade: 'bridge', objectives: [{ type: 'gather', target: 'star', count: 2 }], reward: { coins: 65, xp: 45, renown: 1 } },
            { id: 'daily12', title: 'Hộp cơm cho đường xa', kind: 'daily', description: 'Nấu một cơm dã ngoại cho chuyến thám hiểm.', giver: 'son', requires: ['story15'], upgrade: 'kitchen', objectives: [{ type: 'craft', target: 'meal', count: 1 }], reward: { coins: 60, xp: 40, renown: 1 } }
        ]
    };

    root.STARDROP_DATA = data;
    if (typeof module !== 'undefined' && module.exports) module.exports = data;
})(typeof globalThis !== 'undefined' ? globalThis : this);
