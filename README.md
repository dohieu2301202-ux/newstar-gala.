# Sảnh sự kiện 3D — Khai trương trụ sở NewstarGroup Miền Nam

Game sảnh sự kiện 3D nhiều người chơi cùng lúc: ai mở link cũng vào được (không cần đăng nhập), thấy nhau đi lại, chat, ôm / hôn / bắt tay / đánh yêu, lấy 6 dấu mộc và quay thưởng. Có nhạc sự kiện 128 BPM tự tổng hợp (không dùng file nhạc nên không lo bản quyền).

```
newstar-gala/
├─ server.js          máy chủ Socket.io (đồng bộ vị trí, chat, hành động)
├─ package.json
└─ public/
   ├─ index.html      toàn bộ game (3D, giao diện, nhạc)
   └─ poster.jpg      poster sự kiện (hiện ở màn hình vào game và trên sân khấu)
```

## Chạy thử trên máy

Cần Node.js 18 trở lên.

```powershell
npm install
npm start
```

Mở http://localhost:3000. Người khác **cùng mạng Wi‑Fi** vào được bằng `http://<IP máy bạn>:3000` (xem IP bằng lệnh `ipconfig`, dòng IPv4).

## Đưa lên mạng cho mọi người vào (Render, miễn phí)

1. Tạo kho GitHub mới và đẩy thư mục `newstar-gala` lên (không cần thư mục `node_modules`).
2. Vào https://render.com → **New → Web Service** → chọn kho vừa tạo.
3. Điền:
   - Runtime: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance type: Free (thử) hoặc Starter (ngày sự kiện)
4. Bấm **Create Web Service**. Vài phút sau Render cho một link dạng `https://ten-cua-ban.onrender.com` — gửi link này cho khách.

Lưu ý gói Free của Render: máy chủ "ngủ" sau 15 phút không ai vào, người đầu tiên mở link sẽ chờ khoảng 1 phút. Ngày sự kiện nên chuyển sang gói Starter để luôn sẵn sàng.

Railway, Fly.io hay VPS riêng cũng chạy được y như vậy: chỉ cần `npm install` rồi `npm start`, cổng lấy từ biến môi trường `PORT`.

## Tuỳ chỉnh nhanh

| Muốn đổi | Sửa ở đâu |
|---|---|
| Số người tối đa (mặc định 300) | biến môi trường `MAX_PLAYERS` |
| Poster | thay file `public/poster.jpg` (ảnh vuông) |
| Lịch trình | mảng `AGENDA` trong `public/index.html` |
| Tên khu / gian hàng | mảng `booths` trong `public/index.html` |
| Quà vòng quay | mảng `PRIZES` trong `public/index.html` |
| Màu trang phục | mảng `COLORS` trong `public/index.html` |

## Điều khiển

- Kéo chuột / vuốt: xoay camera 360°; cuộn / chụm 2 ngón: phóng to thu nhỏ
- WASD hoặc mũi tên, hoặc chạm vào sàn: di chuyển
- E: ghé gian hàng · 1–5: biểu cảm · 6 đánh · 7 hôn · 8 ôm · 9 bắt tay · Enter: chat
- Nút 🎵 trên thanh trên cùng: bật / tắt nhạc

Dấu mộc và lượt quay lưu trên trình duyệt của từng khách, nên nếu cần trao quà thật, nên đối chiếu tại quầy.
