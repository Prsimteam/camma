/**
 * ไฟล์ app.js
 * ทำหน้าที่ประสานงานระหว่างหน้าเว็บ (Frontend) และ API จาก Google Sheets
 */

// =================================================================
// 🚨 การตั้งค่า (Configuration) : ผู้ดูแลระบบต้องนำ Web App URL มาใส่แทนที่นี่ 🚨
// =================================================================
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxm2qqeAFTZjEB_21pm2BcxO1-KzNVXvYOnYI5OT1Fwczat4tYR9FMwdDrjnG5Yz0Ksyg/exec"; 
// หมายเหตุ: ถึงแม้ลูกค้านำ Sheet ID มาแล้ว แต่โครงสร้าง API ออกแบบให้รับข้อมูลผ่าน Google Apps Script
// จึงยังต้องการ URL ตัวเต็ม (https://script.google.com/macros/s/.../exec) มาใช้ในการ Fetch JSON ต่อไป


const App = {
    // เก็บตัวแปรข้อมูลของหนังสือชั่วคราวบนเบราว์เซอร์
    booksData: [],

    /**
     * ✅ ฟีเจอร์: แปลงลิงก์ Google Drive
     * หน้าที่: ตัดลิงก์ทั่วไปแบบ /view?usp=sharing ออกมาเป็น /uc?id= สำหรับเพื่อแทรกรูปภาพ (Direct Image Link)
     */
    convertDriveLink: function(url) {
        if (!url) return '';
        // ตรวจสอบว่ามีรูปแบบ file/d/ หรือไม่
        const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (idMatch && idMatch[1]) {
            // ส่งค่ากลับเป็น Direct Link
            return `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
        }
        return url.trim(); // ถ้าไม่เจอรูปแบบของ Google Drive ให้ส่งลิงก์แบบเดิมกลับไป
    },

    /**
     * 📥 ฟีเจอร์: ดึงข้อมูลจาก API
     */
    fetchBooks: async function() {
        // แจ้งเตือนกรณีลืมใส่ URL API
        if (GAS_WEB_APP_URL === "TODO_INSERT_WEB_APP_URL_HERE" || !GAS_WEB_APP_URL.includes("script.google")) {
            alert("⚠️ ยังไม่ได้ตั้งค่า API_URL!\nกรุณานำ Web App URL ของ Google Apps Script มาวางในบรรทัดที่ 8 ของไฟล์ js/app.js ให้ถูกต้อง");
            $('#loading-state').hide();
            $('#error-state').show();
            return [];
        }

        try {
            // ดึงข้อมูลแบบ GET Method
            const response = await fetch(GAS_WEB_APP_URL);
            const rawData = await response.json();
            
            // เช็กข้อมูลตอบรับว่า Success 
            if (rawData.status === "success" && rawData.data) {
                this.booksData = rawData.data;
                return this.booksData;
            } else {
                console.error("เกิดข้อผิดพลาดจาก API:", rawData);
                throw new Error("โครงสร้างข้อมูลผิดพลาด");
            }
        } catch (error) {
            console.error("Network Error หรือสคริปต์โดนบล็อก:", error);
            $('#loading-state').hide();
            $('#error-state').show();
            return [];
        }
    },

    /**
     * 📚 ฟีเจอร์: ประมวลผลหน้า Library.html
     */
    initLibrary: async function() {
        const books = await this.fetchBooks();
        if (books.length === 0) return; // ถ้าไม่มีหนังสือ ไม่ต้องทำอะไร รอให้ Error State ออกมา

        $('#loading-state').hide();
        
        let html = '';
        books.forEach(book => {
            // เอา URL หน้าปกมาแปลงให้อ่านเป็นรูป <img> ได้เลย
            const coverUrl = this.convertDriveLink(book.CoverImageURL);
            
            html += `
                <a href="book.html?id=${encodeURIComponent(book.BookID)}" class="book-card">
                    <div class="book-cover-container">
                        <img src="${coverUrl}" alt="${book.Title}" class="book-cover" loading="lazy" onerror="this.src='https://via.placeholder.com/300x400?text=ไม่มีรูปหน้าปก'">
                    </div>
                    <div class="book-info">
                        <h3 class="book-title">${book.Title || "ไม่มีชื่อเรื่อง"}</h3>
                        <p class="book-desc">${book.Description || ""}</p>
                    </div>
                </a>
            `;
        });
        
        $('#bookshelf').html(html);
    },

    /**
     * 📖 ฟีเจอร์: ประมวลผลหน้าอ่านหนังสือ (book.html)
     */
    initReader: async function() {
        // 1. ดันรหัสหนังสือจาก Parameter บนลิงก์ URL (?id=...)
        const urlParams = new URLSearchParams(window.location.search);
        const bookId = urlParams.get('id');
        
        if (!bookId) {
            alert("ไม่พบรหัสหนังสือ โปรดกลับไปเลือกที่หน้าห้องสมุด");
            window.location.href = 'index.html';
            return;
        }

        // 2. ดึงข้อมูลอีกรอบเพื่อนำมาค้นหาเล่มที่อยากอ่าน
        const books = await this.fetchBooks();
        const book = books.find(b => b.BookID === bookId);

        if (!book) {
            alert("ค้นหาหนังสือเล่มนี้ไม่เจอ อาจโดนลบออกจากระบบ");
            window.location.href = 'index.html';
            return;
        }

        // 3. กำหนดข้อมูลชื่อเรื่องลงในระบบ
        $('#book-title').text(book.Title || "กำลังอ่าน");
        document.title = `${book.Title} - E-Book Library`;

        // 4. แปลงลิงก์ และ จัดโครงสร้าง HTML ให้ Flipbook แบบไดนามิก
        const coverImg = this.convertDriveLink(book.CoverImageURL);
        const backImg = this.convertDriveLink(book.BackImageURL);
        let pageUrls = [];
        
        if (book.PageImageURLs) {
            // สมมติฐานข้อมูลคั่นด้วยคอมม่า เราจะแยกออกเป็นรายลิงก์แล้วแปลงเลย
            pageUrls = book.PageImageURLs.split(',').map(url => this.convertDriveLink(url.trim()));
        }

        let pagesHTML = '';
        
        // 4.1) แทรกปกหน้า
        // เพิ่มคลาส hard ลงไปเพื่อสร้างเอฟเฟกต์ปกแบบแข็งไม่งอเวลาพลิก
        pagesHTML += `<div class="page hard"><img src="${coverImg}" onerror="this.src='https://via.placeholder.com/400x600?text=หน้าปก'"></div>`;
        pagesHTML += `<div class="page hard"></div>`; // ใช้งานด้านในปกหน้าเป็นกระดาษว่าง
        
        // 4.2) แทรกหน้าเนื้อด้านใน
        pageUrls.forEach((imgUrl, idx) => {
            if(imgUrl) {
                // รูปหน้าใน เป็นกระดาษอ่อน ไม่ใช้ class hard
                pagesHTML += `<div class="page"><img src="${imgUrl}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x600?text=หน้าที่ ${idx+1}'"></div>`;
            }
        });

        // 4.3) ประเมินจำนวนหน้า (Flipbook จะสวยงามควรมีลักษณะหน้าคู่)
        if (pageUrls.length % 2 !== 0) {
            // ถ้าหน้าเนื้อหามีหน้าคี่ ปกหลังจะเอียง จึงแถมกระดาษเปล่าไป 1 หน้า
            pagesHTML += `<div class="page"></div>`;
        }
        
        // 4.4) แทรกปกหลัง
        pagesHTML += `<div class="page hard"></div>`; // ด้านในกระดาษเปล่าหลังสุด
        pagesHTML += `<div class="page hard"><img src="${backImg}" onerror="this.src='https://via.placeholder.com/400x600?text=ปกหลัง'"></div>`;

        // สั่งแทรกลงใน DOM
        $('#flipbook').html(pagesHTML);
        
        // 5. ซ่อนสถานะการโหลดและส่งสัญญาณให้ TurnJS เริ่มทำงาน
        $('#loading-state').hide();
        $('#flipbook').show();
        $('#reader-controls').show();

        // คำนวณขนาดสมุดคร่าวๆ เพื่อเปลี่ยนสมุดให้ตอบสนองกับหน้าจอผู้ใช้
        const flipbookDom = $("#flipbook");
        let deviceWidth = window.innerWidth;
        
        let flipWidth = 900;
        let flipHeight = 600;
        
        if (deviceWidth < 1000 && deviceWidth >= 600) {
            flipWidth = deviceWidth - 40;
            flipHeight = (flipWidth * 600) / 900;
        } else if (deviceWidth < 600){
            // จอมือถือ เปิดแบบหน้าเดียว (Single Page Display)
            flipWidth = deviceWidth - 20;
            flipHeight = (flipWidth * 600) / 450;
        }

        flipbookDom.turn({
            width: flipWidth,
            height: flipHeight,
            autoCenter: true,
            acceleration: true,
            gradients: true, // สร้างเงาหน้ากระดาษ
            elevation: 50,
            display: deviceWidth < 600 ? 'single' : 'double', // แยกจอมือถือ
            when: {
                turned: function(e, page) {
                    // อัปเดตคอร์การเปลี่ยนหน้า (หน้า 1 ไป 2)
                    $("#current-page").text(page);
                }
            }
        });

        // อัปเดตเลขจำนวนหน้ารวมทั้งหมดในระบบ
        setTimeout(() => {
            $("#total-pages").text(flipbookDom.turn("pages"));
            $("#current-page").text(flipbookDom.turn("page"));
        }, 100);

        // 6. ผูกการทำงานปุ่มต่างๆ ควบคุมได้ง่าย
        $('#prev-btn').on('click', () => flipbookDom.turn('previous'));
        $('#next-btn').on('click', () => flipbookDom.turn('next'));

        // สามารถกดลูกศรคีย์บอร์ด ซ้าย/ขวา แทนได้
        $(document).keydown(function(e) {
            if (e.keyCode === 37) { flipbookDom.turn('previous'); }
            else if (e.keyCode === 39) { flipbookDom.turn('next'); }
        });
    }
};
