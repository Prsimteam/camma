// ตัวแปรหลัก
let currentSessionId = null;
let sessions = [];
let pollInterval = null;

// ฟังก์ชันเริ่มต้น
document.addEventListener('DOMContentLoaded', function() {
    // โหลดรายการแชท
    loadSessions();
    
    // ตั้งค่า Event Listeners
    document.getElementById('refresh-sessions').addEventListener('click', loadSessions);
    document.getElementById('search-user').addEventListener('input', filterSessions);
    document.getElementById('generate-link').addEventListener('click', generateChatLink);
    document.getElementById('copy-link').addEventListener('click', copyLinkToClipboard);
    document.getElementById('admin-message-form').addEventListener('submit', sendAdminMessage);
    document.getElementById('admin-message-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAdminMessage(e);
        }
    });
    
    // ตั้งค่า polling สำหรับอัปเดตรายการแชท
    startPolling();
});

// โหลดรายการแชท
function loadSessions() {
    const data = {
        action: 'getAllSessions'
    };
    
    fetch(`${ADMIN_API_URL}?${new URLSearchParams(data)}`)
    .then(response => response.json())
    .then(result => {
        if (result.status === 'success' && result.sessions) {
            sessions = result.sessions;
            displaySessions(result.sessions);
            updateStats(result.sessions);
        }
    })
    .catch(error => {
        console.error('Error loading sessions:', error);
    });
}

// แสดงรายการแชท
function displaySessions(sessionList) {
    const sessionsList = document.getElementById('sessions-list');
    
    if (sessionList.length === 0) {
        sessionsList.innerHTML = `
            <div class="text-center text-gray-500 py-4">
                ไม่มีการสนทนาในขณะนี้
            </div>
        `;
        return;
    }
    
    // เรียงตามเวลาล่าสุด
    sessionList.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
    
    let sessionsHTML = '';
    
    sessionList.forEach(session => {
        const lastActive = new Date(session.lastActivity);
        const now = new Date();
        const diffMinutes = Math.floor((now - lastActive) / (1000 * 60));
        
        let lastActiveText = '';
        if (diffMinutes < 1) {
            lastActiveText = 'เมื่อสักครู่นี้';
        } else if (diffMinutes < 60) {
            lastActiveText = `${diffMinutes} นาทีที่แล้ว`;
        } else if (diffMinutes < 1440) {
            const hours = Math.floor(diffMinutes / 60);
            lastActiveText = `${hours} ชั่วโมงที่แล้ว`;
        } else {
            const days = Math.floor(diffMinutes / 1440);
            lastActiveText = `${days} วันที่แล้ว`;
        }
        
        const isSelected = currentSessionId === session.sessionId;
        const unreadCount = session.unreadCount || 0;
        
        sessionsHTML += `
            <div class="session-item p-3 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? 'selected-session' : 'border'}" 
                 data-session-id="${session.sessionId}" 
                 data-user-name="${session.userName || 'ผู้ใช้'}"
                 data-user-id="${session.userId || ''}"
                 data-last-active="${session.lastActivity}"
                 data-status="${session.status || 'offline'}">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="flex items-center mb-1">
                            <div class="w-3 h-3 rounded-full mr-2 ${session.status === 'online' ? 'bg-green-500' : 'bg-gray-300'}"></div>
                            <h4 class="font-bold text-gray-800">${session.userName || 'ผู้ใช้'}</h4>
                            ${unreadCount > 0 ? `<span class="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">${unreadCount}</span>` : ''}
                        </div>
                        <div class="text-sm text-gray-600 truncate">
                            ${session.lastMessage ? session.lastMessage.substring(0, 50) + (session.lastMessage.length > 50 ? '...' : '') : 'ยังไม่มีข้อความ'}
                        </div>
                        <div class="text-xs text-gray-500 mt-1">${lastActiveText}</div>
                    </div>
                    <div class="text-xs text-gray-500">
                        ${session.unanswered ? '<span class="text-red-500">●</span>' : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    sessionsList.innerHTML = sessionsHTML;
    
    // เพิ่ม Event Listeners สำหรับแต่ละ session
    document.querySelectorAll('.session-item').forEach(item => {
        item.addEventListener('click', function() {
            const sessionId = this.getAttribute('data-session-id');
            const userName = this.getAttribute('data-user-name');
            const userId = this.getAttribute('data-user-id');
            const lastActive = this.getAttribute('data-last-active');
            const status = this.getAttribute('data-status');
            
            selectSession(sessionId, userName, userId, lastActive, status);
        });
    });
}

// กรองรายการแชท
function filterSessions() {
    const searchTerm = document.getElementById('search-user').value.toLowerCase();
    
    if (!searchTerm) {
        displaySessions(sessions);
        return;
    }
    
    const filteredSessions = sessions.filter(session => {
        const userName = session.userName ? session.userName.toLowerCase() : '';
        const userId = session.userId ? session.userId.toLowerCase() : '';
        const lastMessage = session.lastMessage ? session.lastMessage.toLowerCase() : '';
        
        return userName.includes(searchTerm) || 
               userId.includes(searchTerm) || 
               lastMessage.includes(searchTerm);
    });
    
    displaySessions(filteredSessions);
}

// เลือก session
function selectSession(sessionId, userName, userId, lastActive, status) {
    currentSessionId = sessionId;
    
    // อัปเดต UI
    document.getElementById('no-chat-selected').style.display = 'none';
    document.getElementById('chat-header').classList.remove('hidden');
    document.getElementById('chat-input-container').classList.remove('hidden');
    
    // อัปเดตข้อมูลผู้ใช้
    document.getElementById('chat-user-name').textContent = userName || 'ผู้ใช้';
    document.getElementById('session-id').textContent = `ID: ${sessionId.substring(0, 12)}...`;
    
    // อัปเดตสถานะ
    const statusElement = document.getElementById('chat-status');
    const lastActiveElement = document.getElementById('last-active');
    
    const lastActiveDate = new Date(lastActive);
    const now = new Date();
    const diffMinutes = Math.floor((now - lastActiveDate) / (1000 * 60));
    
    if (status === 'online') {
        statusElement.innerHTML = '<span class="text-green-600">●</span> ออนไลน์';
        statusElement.className = 'text-sm status-online';
    } else {
        statusElement.innerHTML = '<span class="text-red-600">●</span> ออฟไลน์';
        statusElement.className = 'text-sm status-offline';
    }
    
    if (diffMinutes < 1) {
        lastActiveElement.textContent = 'ออนไลน์เมื่อสักครู่นี้';
    } else if (diffMinutes < 60) {
        lastActiveElement.textContent = `ออนไลน์ ${diffMinutes} นาทีที่แล้ว`;
    } else {
        lastActiveElement.textContent = `ออนไลน์ล่าสุด ${lastActiveDate.toLocaleTimeString('th-TH', {hour: '2-digit', minute: '2-digit'})}`;
    }
    
    // โหลดประวัติแชท
    loadSessionMessages(sessionId);
    
    // อัปเดตการเลือกในรายการ
    document.querySelectorAll('.session-item').forEach(item => {
        item.classList.remove('selected-session');
        if (item.getAttribute('data-session-id') === sessionId) {
            item.classList.add('selected-session');
        }
    });
}

// โหลดข้อความของ session
function loadSessionMessages(sessionId) {
    const data = {
        action: 'getMessages',
        sessionId: sessionId
    };
    
    fetch(`${ADMIN_API_URL}?${new URLSearchParams(data)}`)
    .then(response => response.json())
    .then(result => {
        if (result.status === 'success' && result.messages) {
            displayMessages(result.messages, sessionId);
        }
    })
    .catch(error => {
        console.error('Error loading session messages:', error);
    });
}

// แสดงข้อความ
function displayMessages(messages, sessionId) {
    const messagesContainer = document.getElementById('admin-messages-container');
    messagesContainer.innerHTML = '';
    
    // เรียงข้อความตามเวลา
    messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                ยังไม่มีข้อความในบทสนทนานี้
            </div>
        `;
        return;
    }
    
    let lastDate = null;
    
    messages.forEach(msg => {
        const timestamp = new Date(msg.timestamp);
        const messageDate = timestamp.toLocaleDateString('th-TH');
        
        // เพิ่มวันที่ถ้าเปลี่ยนวัน
        if (lastDate !== messageDate) {
            const dateDiv = document.createElement('div');
            dateDiv.className = 'text-center my-4';
            dateDiv.innerHTML = `
                <span class="bg-gray-200 text-gray-700 text-xs px-3 py-1 rounded-full">
                    ${messageDate}
                </span>
            `;
            messagesContainer.appendChild(dateDiv);
            lastDate = messageDate;
        }
        
        // เพิ่มข้อความ
        const messageDiv = document.createElement('div');
        messageDiv.className = 'fade-in mb-3';
        
        const timeString = timestamp.toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        if (msg.sender === 'admin') {
            // ข้อความจาก admin (ทางขวา)
            messageDiv.innerHTML = `
                <div class="flex justify-end">
                    <div class="bg-blue-600 text-white rounded-2xl rounded-tr-none max-w-xs lg:max-w-md px-4 py-2">
                        <div class="text-sm">${msg.message}</div>
                        <div class="text-xs text-blue-200 mt-1 text-right">${timeString}</div>
                    </div>
                </div>
            `;
        } else {
            // ข้อความจาก user (ทางซ้าย)
            messageDiv.innerHTML = `
                <div class="flex justify-start">
                    <div class="bg-gray-200 text-gray-800 rounded-2xl rounded-tl-none max-w-xs lg:max-w-md px-4 py-2">
                        <div class="font-medium text-sm text-gray-700 mb-1">${msg.userName || 'ผู้ใช้'}</div>
                        <div class="text-sm">${msg.message}</div>
                        <div class="text-xs text-gray-500 mt-1">${timeString}</div>
                    </div>
                </div>
            `;
        }
        
        messagesContainer.appendChild(messageDiv);
    });
    
    // เลื่อนไปที่ข้อความล่าสุด
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ส่งข้อความจาก admin
function sendAdminMessage(event) {
    event.preventDefault();
    
    if (!currentSessionId) {
        alert('กรุณาเลือกการสนทนาก่อนส่งข้อความ');
        return;
    }
    
    const messageInput = document.getElementById('admin-message-input');
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    // แสดงข้อความใน UI
    const messagesContainer = document.getElementById('admin-messages-container');
    const timestamp = new Date();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'fade-in mb-3';
    messageDiv.innerHTML = `
        <div class="flex justify-end">
            <div class="bg-blue-600 text-white rounded-2xl rounded-tr-none max-w-xs lg:max-w-md px-4 py-2">
                <div class="text-sm">${message}</div>
                <div class="text-xs text-blue-200 mt-1 text-right">${timestamp.toLocaleTimeString('th-TH', {hour: '2-digit', minute: '2-digit'})}</div>
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // ส่งข้อความไปยัง API
    const data = {
        action: 'adminReply',
        sessionId: currentSessionId,
        message: message
    };
    
    fetch(`${ADMIN_API_URL}?${new URLSearchParams(data)}`)
    .then(response => response.json())
    .then(result => {
        if (result.status === 'success') {
            console.log('Message sent successfully');
        }
    })
    .catch(error => {
        console.error('Error sending message:', error);
        alert('ไม่สามารถส่งข้อความได้ โปรดลองอีกครั้ง');
    });
    
    // เคลียร์ input
    messageInput.value = '';
    messageInput.focus();
}

// สร้างลิงค์แชทใหม่
function generateChatLink() {
    const userName = document.getElementById('new-user-name').value.trim();
    
    if (!userName) {
        alert('กรุณากรอกชื่อผู้ใช้');
        return;
    }
    
    // สร้าง userId ใหม่
    const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // สร้างลิงค์
    const baseUrl = window.location.origin + window.location.pathname.replace('admin.html', 'index.html');
    const chatLink = `${baseUrl}?userid=${userId}&name=${encodeURIComponent(userName)}`;
    
    // แสดงลิงค์
    document.getElementById('generated-link').value = chatLink;
    document.getElementById('generated-link-container').classList.remove('hidden');
    
    // บันทึก session ใหม่
    const data = {
        action: 'registerSession',
        sessionId: userId,
        userName: userName,
        userId: userId,
        timestamp: new Date().toISOString()
    };
    
    fetch(ADMIN_API_URL, {
        method: 'POST',
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        if (result.status === 'success') {
            console.log('New session registered');
            // โหลดรายการแชทใหม่
            loadSessions();
        }
    })
    .catch(error => {
        console.error('Error registering new session:', error);
    });
}

// คัดลอกลิงค์ไปยังคลิปบอร์ด
function copyLinkToClipboard() {
    const linkInput = document.getElementById('generated-link');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // สำหรับอุปกรณ์มือถือ
    
    document.execCommand('copy');
    
    // แสดงข้อความยืนยัน
    const copyButton = document.getElementById('copy-link');
    const originalText = copyButton.textContent;
    copyButton.textContent = 'คัดลอกแล้ว!';
    copyButton.classList.remove('bg-blue-600');
    copyButton.classList.add('bg-green-600');
    
    setTimeout(() => {
        copyButton.textContent = originalText;
        copyButton.classList.remove('bg-green-600');
        copyButton.classList.add('bg-blue-600');
    }, 2000);
}

// อัปเดตสถิติ
function updateStats(sessionList) {
    const onlineCount = sessionList.filter(s => s.status === 'online').length;
    const repliedCount = sessionList.filter(s => s.unanswered === false).length;
    const pendingCount = sessionList.filter(s => s.unanswered === true).length;
    
    document.getElementById('online-count').textContent = onlineCount;
    document.getElementById('replied-count').textContent = repliedCount;
    document.getElementById('pending-count').textContent = pendingCount;
}

// เริ่ม polling สำหรับอัปเดตรายการแชท
function startPolling() {
    // อัปเดตทุก 5 วินาที
    pollInterval = setInterval(() => {
        loadSessions();
        
        // ถ้ามีการเลือก session ปัจจุบันอยู่ ให้ดึงข้อความใหม่ด้วย
        if (currentSessionId) {
            loadSessionMessages(currentSessionId);
        }
    }, 5000);
}