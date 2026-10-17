/* First steps in Thung Lũng Sao Rơi. Pure content and progression; no save or DOM access. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StardropOnboarding = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const COUNT = 4;
  const escape = value => value.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const bounded = value => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(COUNT - 1, Math.trunc(value))) : 0;

  function step(index = 0, mobile = false) {
    index = bounded(index);
    const pages = [
      {
        title: 'Đi một vòng quanh làng', subtitle: 'DI CHUYỂN & CHẠY', icon: '🧭',
        points: mobile ? [
          'Xoay ngang điện thoại để bản đồ và nút bấm có thêm không gian.',
          'Kéo joystick bên trái theo hướng muốn đi. Nhả tay để dừng.',
          'Bật nút Chạy để đi nhanh; bấm lại để tắt.',
          'Nút Né ở bên phải tránh đòn theo hướng nhìn; cần 10 thể lực.'
        ] : [
          'Dùng WASD hoặc phím mũi tên để di chuyển.',
          'Giữ Shift để chạy nhanh. Nhả phím để dừng.',
          'Bấm E để tương tác, Space để vung kiếm, V để né đòn.',
          'Bạn có thể mở lại hướng dẫn bằng nút Hướng dẫn.'
        ],
        tip: 'Chạy không mất thêm thể lực. Vật cản sẽ chặn đường đi.'
      },
      {
        title: 'Cuộc hẹn đầu tiên với Mira', subtitle: 'TRÒ CHUYỆN & NHIỆM VỤ', icon: '💬',
        points: [
          'Đưa Đêm Hội Sao trở lại qua ba chặng: hồi sinh làng, tìm ký ức và thắp Đèn Dẫn Sao.',
          mobile ? 'Tìm Mira gần quảng trường; đến gần bấm Tương tác.' : 'Tìm Mira gần quảng trường; đến gần bấm E.',
          'Cốt truyện tự nối khi nhận thưởng. Nhận việc cư dân và hợp đồng trước khi làm mục tiêu.',
          'Chọn Theo dõi để tìm mục tiêu. Nhận thưởng xong, nhiệm vụ chuyển vào Lịch sử; giao đồ cần đúng cư dân.'
        ],
        tip: 'Rễ Sao mở sau chuyến rừng đầu. Sổ giữ việc đã xong trong Lịch sử.'
      },
      {
        title: 'Chuẩn bị cho chuyến đi', subtitle: 'THU THẬP & HỒI SỨC', icon: '🎒',
        points: [
          'Đến gần cây, đá hoặc thảo dược rồi Tương tác để lấy tài nguyên.',
          'Theo dõi ♥ máu và ⚡ thể lực. Thu thập, câu cá và vung kiếm cần thể lực.',
          'Nghỉ ở ghế hoặc giếng; dùng trà hay cơm trong Túi & chế tạo để hồi sức.',
          'Mở Xây làng để xem công trình, nguyên liệu và nâng cấp. Đừng bán hết vật phẩm dành cho nhiệm vụ.'
        ],
        tip: 'Túi & chế tạo cũng là nơi làm vật phẩm từ nguyên liệu đã kiếm được.'
      },
      {
        title: 'Theo dấu trên bản đồ nhỏ', subtitle: 'KHÁM PHÁ & CHƠI ONLINE', icon: '🗺',
        points: [
          'Minimap cho biết vị trí của bạn, cư dân và lối sang vùng khác.',
          'Mục tiêu nhiệm vụ đang theo dõi cũng được đánh dấu khi ở cùng vùng.',
          'Tên và trò chuyện online được người chơi khác nhìn thấy. Hãy dùng biệt danh và không gửi thông tin riêng tư.',
          'Tiến trình tự lưu trên trình duyệt này. Dùng nút Hướng dẫn khi muốn xem lại.'
        ],
        tip: 'Chấm trắng là bạn; hình thoi vàng là mục tiêu. Tìm Mira để bắt đầu câu chuyện.'
      }
    ];
    const page = pages[index];
    const body = `<div class="tutorial-content"><span class="tutorial-icon" aria-hidden="true">${page.icon}</span><ul>${page.points.map(point => `<li>${escape(point)}</li>`).join('')}</ul><p class="tutorial-tip">${escape(page.tip)}</p></div>`;
    return Object.freeze({ index, title: page.title, subtitle: page.subtitle, body });
  }

  function render(index = 0, mobile = false) {
    const page = step(index, mobile), progress = `Bước ${page.index + 1} trên ${COUNT}`;
    return `<section class="tutorial-card"><div class="tutorial-progress" aria-label="${progress}"><span>${progress}</span><span aria-hidden="true">${Array.from({length:COUNT}, (_, i) => i === page.index ? '●' : '○').join(' ')}</span></div>${page.body}<div class="tutorial-actions"><button type="button" data-tutorial-skip>Bỏ qua</button>${page.index ? '<button type="button" data-tutorial-prev>Quay lại</button>' : ''}<button type="button" class="tutorial-primary" data-tutorial-next>${page.index === COUNT - 1 ? 'Bắt đầu chơi' : 'Tiếp tục'}</button></div></section>`;
  }

  // The host owns persistence: record completion after next() closes the last
  // page or finish() explicitly skips. Merely opening or closing a dialog is not completion.
  function create({ completed = false, mobile = false } = {}) {
    let open = false, index = 0;
    completed = Boolean(completed); mobile = Boolean(mobile);
    const state = () => ({ open, index, completed, mobile });
    function start() { index = 0; open = true; return state(); }
    function finish() { if (open) { open = false; completed = true; } return state(); }
    function next() { if (open) { if (index === COUNT - 1) return finish(); index++; } return state(); }
    function previous() { if (open) index = Math.max(0, index - 1); return state(); }
    return Object.freeze({ start, next, previous, finish, state, current: () => step(index, mobile), render: () => render(index, mobile) });
  }

  return Object.freeze({ count: COUNT, step, render, create });
});
