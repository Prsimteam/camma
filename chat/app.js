// ตัวแปรหลัก
let sessionId = null;
let userName = 'ผู้ใช้';
let lastMessageTime = null;
let isOnline = true;
let pollInterval = null;

// ฟังก์ชันเริ่มต้น
document.addEventListener('DOMContentLoaded', function() {
    // ตั้งชื่อผู้ใช้จาก URL ถ้ามี
    const urlParams = new URLSearchParams(window.location.search);
    const nameParam = urlParams.get('name');
    if (nameParam) {
        userName = decodeURIComponent(nameParam);
        document.getElementById('user-name').textContent = userName;
    }
    
    // เริ่มต้นระบบแชท
    initializeChat();
    
    // ตั้งค่า Event Listeners
    document.getElementById('message-form').addEventListener('submit', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(e);
        }
    });
    
    // ตรวจสอบการเชื่อมต่อ
    updateOnlineStatus();
    
    // ตั้งค่า polling สำหรับดึงข้อความใหม่
    startPolling();
    
    // ตั้งค่า event สำหรับการออนไลน์/ออฟไลน์
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    window.addEventListener('beforeunload', function() {
        isOnline = false;
    });
});

// เริ่มต้นระบบแชท
function initializeChat() {
    // สร้าง sessionId ใหม่หรือดึงจาก localStorage
    sessionId = localStorage.getItem('chat_session_id');
    
    if (!sessionId) {
        // สร้าง sessionId ใหม่
        sessionId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('chat_session_id', sessionId);
        
        // บันทึก session ใหม่ใน Firebase ผ่าน Google Apps Script
        registerNewSession();
    } else {
        // โหลดประวัติแชท
        loadChatHistory();
    }
}

// ลงทะเบียน session ใหม่
function registerNewSession() {
    const data = {
        action: 'registerSession',
        sessionId: sessionId,
        userName: userName,
        userId: userId,
        timestamp: new Date().toISOString()
    };
    
    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(result => {
        if (result.status === 'success') {
            console.log('Session registered successfully');
        }
    })
    .catch(error => {
        console.error('Error registering session:', error);
    });
}

// ส่งข้อความ
function sendMessage(event) {
    event.preventDefault();
    
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    // แสดงข้อความใน UI
    addMessageToUI(message, 'user', new Date());
    
    // บันทึกข้อความใน Firebase ผ่าน Google Apps Script
    const data = {
        action: 'sendMessage',
        sessionId: sessionId,
        message: message,
        sender: 'user',
        timestamp: new Date().toISOString()
    };
    
    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(result => {
        if (result.status === 'success') {
            console.log('Message sent successfully');
        }
    })
    .catch(error => {
        console.error('Error sending message:', error);
        // แสดงข้อความว่าไม่สามารถส่งได้
        showNotification('ไม่สามารถส่งข้อความได้ โปรดลองอีกครั้ง', 'error');
    });
    
    // เคลียร์ input
    messageInput.value = '';
    messageInput.focus();
    
    // อัปเดตเวลาสุดท้ายของข้อความ
    lastMessageTime = new Date();
}

// เพิ่มข้อความใน UI
function addMessageToUI(message, sender, timestamp) {
    const messagesContainer = document.getElementById('messages-container');
    
    // สร้าง element ข้อความ
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-animation';
    
    // จัดรูปแบบเวลา
    const timeString = timestamp.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    if (sender === 'user') {
        // ข้อความจากผู้ใช้ (ทางขวา)
        messageDiv.innerHTML = `
            <div class="flex justify-end">
                <div class="bg-blue-600 text-white rounded-2xl rounded-tr-none max-w-xs lg:max-w-md px-4 py-2">
                    <div class="text-sm">${message}</div>
                    <div class="text-xs text-blue-200 mt-1 text-right">${timeString}</div>
                </div>
            </div>
        `;
    } else {
        // ข้อความจาก admin (ทางซ้าย)
        messageDiv.innerHTML = `
            <div class="flex justify-start">
                <div class="bg-gray-200 text-gray-800 rounded-2xl rounded-tl-none max-w-xs lg:max-w-md px-4 py-2">
                    <div class="font-medium text-sm text-gray-700 mb-1">ผู้ดูแลระบบ</div>
                    <div class="text-sm">${message}</div>
                    <div class="text-xs text-gray-500 mt-1">${timeString}</div>
                </div>
            </div>
        `;
    }
    
    messagesContainer.appendChild(messageDiv);
    
    // เลื่อนไปที่ข้อความล่าสุด
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// โหลดประวัติแชท
function loadChatHistory() {
    const data = {
        action: 'getMessages',
        sessionId: sessionId
    };
    
    fetch(`${API_URL}?${new URLSearchParams(data)}`)
    .then(response => response.json())
    .then(result => {
        if (result.status === 'success' && result.messages) {
            const messagesContainer = document.getElementById('messages-container');
            messagesContainer.innerHTML = '';
            
            // เรียงข้อความตามเวลา
            result.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            // แสดงข้อความทั้งหมด
            result.messages.forEach(msg => {
                const timestamp = new Date(msg.timestamp);
                addMessageToUI(msg.message, msg.sender, timestamp);
            });
            
            // ถ้ามีข้อความ ให้ซื้อข้อความเริ่มต้น
            if (result.messages.length > 0) {
                const welcomeMsg = messagesContainer.querySelector('.text-center');
                if (welcomeMsg) {
                    welcomeMsg.remove();
                }
            }
        }
    })
    .catch(error => {
        console.error('Error loading chat history:', error);
    });
}

// ดึงข้อความใหม่ด้วย polling
function startPolling() {
    // ดึงข้อความทุก 3 วินาที
    pollInterval = setInterval(() => {
        checkForNewMessages();
    }, 3000);
}

// ตรวจสอบข้อความใหม่
function checkForNewMessages() {
    const data = {
        action: 'getNewMessages',
        sessionId: sessionId,
        lastCheck: lastMessageTime ? lastMessageTime.toISOString() : null
    };
    
    fetch(`${API_URL}?${new URLSearchParams(data)}`)
    .then(response => response.json())
    .then(result => {
        if (result.status === 'success' && result.messages) {
            // แสดงข้อความใหม่
            result.messages.forEach(msg => {
                const timestamp = new Date(msg.timestamp);
                addMessageToUI(msg.message, msg.sender, timestamp);
                lastMessageTime = timestamp;
            });
            
            // อัปเดตสถานะออนไลน์
            if (result.userStatus) {
                updateStatusIndicator(result.userStatus);
            }
        }
    })
    .catch(error => {
        console.error('Error checking for new messages:', error);
    });
}

// อัปเดตสถานะออนไลน์
function updateOnlineStatus() {
    if (navigator.onLine) {
        isOnline = true;
        updateStatusIndicator('online');
        
        // ส่งสถานะออนไลน์ไปยังเซิร์ฟเวอร์
        const data = {
            action: 'updateStatus',
            sessionId: sessionId,
            status: 'online'
        };
        
        fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    } else {
        isOnline = false;
        updateStatusIndicator('offline');
    }
}

// อัปเดตตัวบ่งชี้สถานะ
function updateStatusIndicator(status) {
    const statusText = document.getElementById('status-text');
    const statusDot = document.querySelector('.online-dot');
    
    if (status === 'online') {
        statusText.textContent = 'ออนไลน์';
        statusDot.style.backgroundColor = '#10B981';
    } else if (status === 'offline') {
        statusText.textContent = 'ออฟไลน์';
        statusDot.style.backgroundColor = '#EF4444';
    } else if (status === 'connecting') {
        statusText.textContent = 'กำลังเชื่อมต่อ...';
        statusDot.style.backgroundColor = '#F59E0B';
    }
}

// แสดงการแจ้งเตือน
function showNotification(message, type = 'info') {
    // สร้าง element การแจ้งเตือน
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 ${
        type === 'error' ? 'bg-red-100 text-red-700 border-l-4 border-red-500' : 
        type === 'success' ? 'bg-green-100 text-green-700 border-l-4 border-green-500' :
        'bg-blue-100 text-blue-700 border-l-4 border-blue-500'
    }`;
    
    notification.innerHTML = `
        <div class="flex items-center">
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
            </svg>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // ลบการแจ้งเตือนหลังจาก 3 วินาที
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// จัดการเมื่อผู้ใช้ออกจากหน้าเว็บ
window.addEventListener('beforeunload', function() {
    if (isOnline) {
        // ส่งสถานะออฟไลน์
        const data = {
            action: 'updateStatus',
            sessionId: sessionId,
            status: 'offline'
        };
        
        // ใช้ sendBeacon สำหรับส่งข้อมูลเมื่อปิดเบราว์เซอร์
        navigator.sendBeacon(API_URL, JSON.stringify(data));
    }
    
    // หยุด polling
    if (pollInterval) {
        clearInterval(pollInterval);
    }
});