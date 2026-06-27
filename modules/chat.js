import { db, storage } from '../utils/firebase.js';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, doc, setDoc, getDoc, updateDoc, arrayUnion, deleteDoc, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

import { openModal, closeModal, showToast, showConfirm } from '../utils/ui.js';
import { getProjects, getTasks, getMaterials, saveProjects, saveTasks, saveMaterials } from '../utils/storage.js';

let currentUser = null;
let currentChatId = null;
let currentChatData = null;
let unsubChat = null;
let unsubChatList = null;
let unsubRequests = null;

// Ensure we have user's friends list populated
async function refreshCurrentUser() {
    const userRef = doc(db, 'users', currentUser.id);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
        const data = snap.data();
        currentUser.friends = data.friends || [];
        localStorage.setItem('nova_session_user', JSON.stringify(currentUser));
    }
}

export async function renderChat() {
    const container = document.getElementById('section-chat');
    if (!container) return;

    const stored = localStorage.getItem('nova_session_user');
    if (!stored) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">💬</div><h3>Please log in</h3><p>You must be logged in to use Team Chat.</p></div>`;
        return;
    }
    currentUser = JSON.parse(stored);
    if (!currentUser.friends) currentUser.friends = [];

    // Background refresh
    refreshCurrentUser();

    container.innerHTML = `
      <div class="section-header" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
            <h2 class="section-title">💬 Chat</h2>
            <p class="section-subtitle">Your NOVD ID: <span style="font-family:monospace;font-weight:bold;color:var(--status-green);background:rgba(16,185,129,0.1);padding:2px 6px;border-radius:4px;">${currentUser.novdId}</span></p>
        </div>
      </div>

      <div class="chat-layout" style="display: flex; height: calc(100vh - 170px); gap: 0; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-top: 16px;">
         
         <!-- LEFT SIDEBAR -->
         <div class="chat-sidebar" style="width: 320px; border-right: 1px solid var(--border); display: flex; flex-direction: column;">
            <div style="padding: 16px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 18px;">Chats</h3>
                    <div style="display:flex; gap: 8px;">
                        <button class="btn btn-icon" id="btn-friend-requests" title="Friend Requests" style="position: relative; background:var(--bg-body); border-radius:50%; width:36px; height:36px;">
                            🔔<span id="requests-badge" style="display:none; position:absolute; top:2px; right:2px; background:var(--status-red); width:8px; height:8px; border-radius:50%;"></span>
                        </button>
                        <button class="btn btn-icon" id="btn-add-friend" title="Add Friend" style="background:var(--bg-body); border-radius:50%; width:36px; height:36px;">➕</button>
                        <button class="btn btn-icon" id="btn-create-group" title="New Group" style="background:var(--bg-body); border-radius:50%; width:36px; height:36px;">👥</button>
                    </div>
                </div>
                <input type="text" id="chat-list-search" class="form-input" placeholder="Search chats..." style="font-size:13px; padding:8px 12px; border-radius:20px;" />
            </div>
            <div id="chat-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column;">
                <div style="text-align:center; padding: 20px; color: var(--text-muted);">Loading...</div>
            </div>
         </div>

         <!-- MAIN CHAT AREA -->
         <div class="chat-main" style="flex: 1; display: flex; flex-direction: column; background: var(--bg-body); position: relative;">
            
            <div id="chat-header" style="padding: 16px; border-bottom: 1px solid var(--border); background: var(--bg-card); display: flex; align-items: center; justify-content: space-between; visibility: hidden;">
                <div style="display:flex; align-items:center; gap: 12px;">
                    <img id="active-chat-avatar" src="" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border);">
                    <div>
                        <h3 id="active-chat-name" style="margin: 0; font-size: 16px; font-weight:600;"></h3>
                        <p id="active-chat-sub" style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-muted);"></p>
                    </div>
                </div>
                <button class="btn btn-ghost" id="btn-chat-info" style="font-size:18px;">ℹ️</button>
            </div>

            <div id="chat-messages" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px;">
                <div style="text-align:center; color: var(--text-muted); margin: auto;">
                    <div style="font-size:48px; margin-bottom:12px;">💬</div>
                    Select a conversation or start a new one
                </div>
            </div>

            <div id="chat-input-area" style="display:none; padding: 16px; border-top: 1px solid var(--border); background: var(--bg-card); display: flex; gap: 12px; align-items: center;">
               <div style="position:relative;">
                   <button class="btn btn-icon" id="btn-chat-attach" style="color:var(--text-muted); font-size:20px; width:40px; height:40px; border-radius:50%; background:var(--bg-body);" title="Attach">📎</button>
                   <div id="attach-menu" style="display:none; position:absolute; bottom:100%; left:0; margin-bottom:12px; background:var(--bg-card); border:1px solid var(--border); border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,0.2); width:180px; z-index:100; overflow:hidden;">
                       <button class="dropdown-item attach-opt" id="btn-attach-file" style="padding:12px 16px;"><span style="margin-right:8px;font-size:16px;">📄</span> File / Image</button>
                       <div class="dropdown-divider" style="margin:0;"></div>
                       <button class="dropdown-item attach-opt" id="btn-attach-project" style="padding:12px 16px; color:var(--accent);"><span style="margin-right:8px;font-size:16px;">📊</span> Project Data</button>
                   </div>
               </div>
               <input type="file" id="chat-file-input" style="display:none;" />
               <input type="text" id="chat-input" class="form-input" style="flex: 1; border-radius:24px; padding:12px 16px;" placeholder="Type a message..." autocomplete="off" />
               <button class="btn btn-primary" id="btn-chat-send" style="min-width: 60px; border-radius:24px; height:42px; display:flex; align-items:center; justify-content:center;">
                   <span style="font-size:18px;">↗</span>
               </button>
            </div>
         </div>
      </div>
    `;

    // Reset state
    currentChatId = null;
    currentChatData = null;
    if (unsubChat) { unsubChat(); unsubChat = null; }

    setupSidebarListeners();
    setupChatListeners();
    
    initChatListListener();
    initRequestsListener();
}

function setupSidebarListeners() {
    document.getElementById('btn-add-friend')?.addEventListener('click', showAddFriendModal);
    document.getElementById('btn-friend-requests')?.addEventListener('click', showFriendRequestsModal);
    document.getElementById('btn-create-group')?.addEventListener('click', showCreateGroupModal);

    document.getElementById('chat-list-search')?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('.chat-list-item').forEach(el => {
            const name = el.querySelector('.cli-name').textContent.toLowerCase();
            el.style.display = name.includes(query) ? 'flex' : 'none';
        });
    });
}

function setupChatListeners() {
    // Attach Menu
    const attachBtn = document.getElementById('btn-chat-attach');
    const attachMenu = document.getElementById('attach-menu');
    
    attachBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        attachMenu.style.display = attachMenu.style.display === 'block' ? 'none' : 'block';
    });
    
    document.addEventListener('click', (e) => {
        if (attachMenu && !attachMenu.contains(e.target) && e.target !== attachBtn) {
            attachMenu.style.display = 'none';
        }
    });

    document.getElementById('btn-attach-file')?.addEventListener('click', () => {
        attachMenu.style.display = 'none';
        document.getElementById('chat-file-input')?.click();
    });

    document.getElementById('btn-attach-project')?.addEventListener('click', () => {
        attachMenu.style.display = 'none';
        showShareProjectModal();
    });

    document.getElementById('chat-file-input')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !currentChatId) return;
        await uploadFileAndSend(file);
        e.target.value = '';
    });

    // Sending Messages
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('btn-chat-send');

    const sendMsg = () => {
        const text = chatInput.value.trim();
        if (!text || !currentChatId) return;
        chatInput.value = '';
        sendMessage(text);
    };

    sendBtn?.addEventListener('click', sendMsg);
    chatInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMsg();
    });

    // Chat Info
    document.getElementById('btn-chat-info')?.addEventListener('click', showChatInfoModal);
}

// ============================================================
// CHAT LISTENER & RENDERING
// ============================================================
function initChatListListener() {
    if (unsubChatList) unsubChatList();
    
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', currentUser.id));
    
    unsubChatList = onSnapshot(q, async (snapshot) => {
        const listContainer = document.getElementById('chat-list');
        if (!listContainer) return;

        if (snapshot.empty) {
            listContainer.innerHTML = `<div style="text-align:center; padding:30px 20px; color:var(--text-muted);">No chats yet.<br><br>Add a friend by their NOVD ID to start messaging.</div>`;
            return;
        }

        const sortedDocs = [...snapshot.docs].sort((a, b) => {
            const timeA = a.data().lastUpdated ? a.data().lastUpdated.toMillis() : 0;
            const timeB = b.data().lastUpdated ? b.data().lastUpdated.toMillis() : 0;
            return timeB - timeA;
        });

        const chatsHtmlPromises = sortedDocs.map(async docSnapshot => {
            const chat = docSnapshot.data();
            chat.id = docSnapshot.id;
            
            let chatName = chat.groupName;
            let chatIcon = chat.groupIcon || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=150&q=80';
            
            // If it's a direct chat, resolve the other user's name/pic
            if (chat.type === 'direct') {
                const otherUserId = chat.participants.find(id => id !== currentUser.id);
                if (otherUserId) {
                    try {
                        const otherSnap = await getDoc(doc(db, 'users', otherUserId));
                        if (otherSnap.exists()) {
                            chatName = otherSnap.data().name;
                            chatIcon = otherSnap.data().picture || 'https://via.placeholder.com/40';
                        }
                    } catch (e) {
                        chatName = 'Unknown User';
                    }
                } else {
                    chatName = 'Just You';
                }
            }

            const timeString = chat.lastUpdated ? new Date(chat.lastUpdated.toMillis()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
            const lastMsg = chat.lastMessage || 'New Chat';
            const isActive = currentChatId === chat.id;

            return `
                <div class="chat-list-item" data-id="${chat.id}" style="display:flex; align-items:center; gap:12px; padding:12px 16px; cursor:pointer; border-bottom:1px solid var(--border); transition: background 0.2s; background: ${isActive ? 'var(--bg-hover)' : 'transparent'};">
                    <img src="${chatIcon}" style="width:48px; height:48px; border-radius:50%; object-fit:cover;">
                    <div style="flex:1; overflow:hidden;">
                        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
                            <span class="cli-name" style="font-weight:600; font-size:15px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(chatName)}</span>
                            <span style="font-size:11px; color:var(--text-muted);">${timeString}</span>
                        </div>
                        <div style="font-size:13px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(lastMsg)}</div>
                    </div>
                </div>
            `;
        });

        const htmls = await Promise.all(chatsHtmlPromises);
        listContainer.innerHTML = htmls.join('');

        // Bind clicks
        document.querySelectorAll('.chat-list-item').forEach(el => {
            el.addEventListener('click', async (e) => {
                const chatId = e.currentTarget.dataset.id;
                document.querySelectorAll('.chat-list-item').forEach(i => i.style.background = 'transparent');
                e.currentTarget.style.background = 'var(--bg-hover)';
                await openChat(chatId);
            });
        });
    }, (error) => {
        console.error("Chat list listener error:", error);
    });
}

async function openChat(chatId) {
    if (currentChatId === chatId) return;
    currentChatId = chatId;
    
    document.getElementById('chat-header').style.visibility = 'visible';
    document.getElementById('chat-input-area').style.display = 'flex';
    document.getElementById('chat-messages').innerHTML = `<div style="text-align:center; color: var(--text-muted); margin-top:auto;">Loading messages...</div>`;

    // Fetch chat info
    const chatSnap = await getDoc(doc(db, 'chats', chatId));
    if (!chatSnap.exists()) return;
    currentChatData = chatSnap.data();
    currentChatData.id = chatId;

    let chatName = currentChatData.groupName;
    let chatIcon = currentChatData.groupIcon || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=150&q=80';
    let chatSub = currentChatData.type === 'group' ? `${currentChatData.participants.length} members` : '';

    if (currentChatData.type === 'direct') {
        const otherUserId = currentChatData.participants.find(id => id !== currentUser.id);
        if (otherUserId) {
            const otherSnap = await getDoc(doc(db, 'users', otherUserId));
            if (otherSnap.exists()) {
                chatName = otherSnap.data().name;
                chatIcon = otherSnap.data().picture || 'https://via.placeholder.com/40';
                chatSub = otherSnap.data().designation || '';
            }
        }
    }

    document.getElementById('active-chat-name').textContent = chatName;
    document.getElementById('active-chat-sub').textContent = chatSub;
    document.getElementById('active-chat-avatar').src = chatIcon;
    document.getElementById('active-chat-avatar').style.display = 'block';

    // Listen for messages
    if (unsubChat) unsubChat();
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    unsubChat = onSnapshot(q, (snapshot) => {
        const msgContainer = document.getElementById('chat-messages');
        if (!msgContainer || currentChatId !== chatId) return;

        if (snapshot.empty) {
            msgContainer.innerHTML = `<div style="text-align:center; color: var(--text-muted); margin: auto;">No messages yet.<br>Say hi! 👋</div>`;
            return;
        }

        msgContainer.innerHTML = '';
        
        // Group messages by date
        let lastDateStr = '';

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const isMe = data.senderId === currentUser.id;
            const dateObj = data.createdAt ? new Date(data.createdAt.toMillis()) : new Date();
            const dateStr = dateObj.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
            
            if (dateStr !== lastDateStr) {
                msgContainer.innerHTML += `<div style="text-align:center; margin: 16px 0;"><span style="background:var(--bg-body); padding:4px 12px; border-radius:12px; font-size:12px; color:var(--text-muted); box-shadow:0 1px 2px rgba(0,0,0,0.05);">${dateStr}</span></div>`;
                lastDateStr = dateStr;
            }

            const timeStr = data.createdAt ? dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Sending...';

            msgContainer.innerHTML += renderMessageHtml(data, isMe, timeStr);
        });

        // Auto-scroll to bottom
        setTimeout(() => {
            msgContainer.scrollTop = msgContainer.scrollHeight;
        }, 50);
        
        // Bind Project Data Import buttons
        document.querySelectorAll('.btn-import-project').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pjData = JSON.parse(decodeURIComponent(e.target.dataset.payload));
                handleImportProjectShared(pjData);
            });
        });
    });
}

function renderMessageHtml(data, isMe, timeStr) {
    const align = isMe ? 'flex-end' : 'flex-start';
    const bg = isMe ? 'var(--accent)' : 'var(--bg-card)';
    const color = isMe ? '#fff' : 'var(--text)';
    const border = isMe ? 'none' : '1px solid var(--border)';
    
    let contentHtml = '';
    let msgText = data.text ? escapeHtml(data.text) : '';

    if (data.msgType === 'project_data') {
        // Special UI for project data sharing
        const pName = escapeHtml(data.projectData.project.name);
        const pTasks = data.projectData.tasks ? data.projectData.tasks.length : 0;
        const payload = encodeURIComponent(JSON.stringify(data.projectData));
        contentHtml = `
            <div style="background:rgba(0,0,0,0.1); border-radius:8px; padding:12px; margin-bottom:8px; display:flex; align-items:center; gap:12px; width:220px;">
                <div style="font-size:24px; background:white; width:40px; height:40px; border-radius:8px; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.1);">📊</div>
                <div style="flex:1;">
                    <div style="font-weight:bold; font-size:14px;">${pName}</div>
                    <div style="font-size:11px; opacity:0.8;">${pTasks} Tasks</div>
                </div>
            </div>
            <button class="btn btn-import-project" data-payload="${payload}" style="width:100%; background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.4); color:${color}; padding:6px; border-radius:6px; font-size:13px; font-weight:bold; cursor:pointer;">⬇️ Import Data</button>
        `;
    } else if (data.fileUrl) {
        if (data.fileType && data.fileType.startsWith('image/')) {
            contentHtml = `<a href="${data.fileUrl}" target="_blank"><img src="${data.fileUrl}" style="max-width:240px; max-height:240px; border-radius:8px; object-fit:cover; margin-bottom:4px; box-shadow:0 2px 5px rgba(0,0,0,0.2);"></a><br>`;
        } else {
            contentHtml = `<a href="${data.fileUrl}" target="_blank" style="display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.1); padding:8px 12px; border-radius:8px; text-decoration:none; color:${color}; margin-bottom:4px;"><span style="font-size:20px;">📄</span> <span style="font-size:13px; font-weight:bold; word-break:break-all;">${escapeHtml(data.fileName || 'Attachment')}</span></a>`;
        }
        if (msgText) contentHtml += `<div style="margin-top:4px;">${msgText}</div>`;
    } else if (data.msgType === 'system') {
        return `
           <div style="text-align:center; margin: 8px 0;">
              <span style="background:var(--bg-body); padding:4px 12px; border-radius:12px; font-size:12px; color:var(--text-muted); box-shadow:0 1px 2px rgba(0,0,0,0.05);">${msgText}</span>
           </div>
        `;
    } else {
        contentHtml = msgText.replace(/\n/g, '<br>');
    }

    return `
       <div class="chat-message-item" style="display: flex; flex-direction: column; align-items: ${align}; max-width: 75%; align-self: ${align}; margin-bottom:4px;">
          ${!isMe && currentChatData?.type === 'group' ? `<span style="font-size: 11px; color: var(--text-muted); margin-bottom: 2px; padding: 0 4px; font-weight:600;">${escapeHtml(data.senderName)}</span>` : ''}
          <div style="background: ${bg}; color: ${color}; padding: 10px 14px; border-radius: 16px; border-top-${isMe ? 'right' : 'left'}-radius: 4px; border: ${border}; font-size: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); line-height: 1.4; position:relative;">
             ${contentHtml}
             <div style="font-size: 10px; opacity: 0.7; text-align: right; margin-top: 4px; display:inline-block; float:right; margin-left:12px; line-height:1;">
                ${timeStr}
             </div>
          </div>
       </div>
    `;
}

// ============================================================
// SEND MESSAGE LOGIC
// ============================================================
async function sendMessage(text, msgType = 'text', additionalData = {}) {
    if (!currentChatId) return;
    const chatId = currentChatId;
    
    try {
        const payload = {
            text: text,
            senderId: currentUser.id,
            senderName: currentUser.name,
            createdAt: serverTimestamp(),
            msgType: msgType,
            ...additionalData
        };

        // Add to messages subcollection
        await addDoc(collection(db, 'chats', chatId, 'messages'), payload);

        // Update chat's lastMessage and timestamp
        let lastMsgTxt = text;
        if (msgType === 'project_data') lastMsgTxt = `📊 Shared Project: ${additionalData.projectData.project.name}`;
        else if (additionalData.fileUrl) lastMsgTxt = `📎 Attachment`;

        await updateDoc(doc(db, 'chats', chatId), {
            lastMessage: lastMsgTxt,
            lastUpdated: serverTimestamp()
        });

    } catch (err) {
        console.error("Send error", err);
        showToast("Failed to send", "error");
    }
}

async function uploadFileAndSend(file) {
    const attachBtn = document.getElementById('btn-chat-attach');
    const orig = attachBtn.innerHTML;
    attachBtn.innerHTML = '⏳';
    attachBtn.disabled = true;

    try {
        const fileRef = ref(storage, `chats/${currentChatId}/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);

        await sendMessage('', 'file', {
            fileUrl: url,
            fileName: file.name,
            fileType: file.type
        });
    } catch (err) {
        console.error(err);
        showToast("Upload failed", "error");
    } finally {
        attachBtn.innerHTML = orig;
        attachBtn.disabled = false;
    }
}

// ============================================================
// PROJECT DATA SHARING
// ============================================================
function showShareProjectModal() {
    const projects = getProjects();
    if (projects.length === 0) {
        showToast("You don't have any projects to share.", "info");
        return;
    }

    const html = `
        <div style="margin-bottom:16px;">
            <p style="color:var(--text-muted); font-size:14px;">Select a project to share. This will send a snapshot of the Gantt chart, tasks, and materials to the chat.</p>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; max-height:300px; overflow-y:auto;">
            ${projects.map(p => `
                <div class="project-share-item" data-id="${p.id}" style="padding:12px; background:var(--bg-body); border:1px solid var(--border); border-radius:8px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:bold;">${escapeHtml(p.name)}</div>
                        <div style="font-size:11px; color:var(--text-muted);">${escapeHtml(p.client || 'No client')}</div>
                    </div>
                    <button class="btn btn-primary" style="padding:4px 12px; font-size:12px;">Share</button>
                </div>
            `).join('')}
        </div>
    `;
    openModal('Share Project Data', html);

    document.querySelectorAll('.project-share-item').forEach(el => {
        el.addEventListener('click', (e) => {
            const pid = e.currentTarget.dataset.id;
            const project = getProjects().find(p => p.id === pid);
            const tasks = getTasks().filter(t => t.projectId === pid);
            const materials = getMaterials().filter(m => m.projectId === pid);

            const payload = JSON.parse(JSON.stringify({ project, tasks, materials }));
            closeModal();
            sendMessage('', 'project_data', { projectData: payload });
        });
    });
}

function handleImportProjectShared(data) {
    showConfirm(`Do you want to import "${data.project.name}" into your workspace? This will save a local copy that you can edit.`, () => {
        try {
            // Generate a new ID for the project so it doesn't collide if they re-import
            const newProjectId = 'proj_' + Date.now();
            
            const p = { ...data.project, id: newProjectId, name: data.project.name + ' (Imported)' };
            
            const t = data.tasks.map(task => ({
                ...task, 
                id: 'task_' + Math.random().toString(36).substr(2, 9),
                projectId: newProjectId
            }));
            
            const m = data.materials.map(mat => ({
                ...mat,
                id: 'mat_' + Math.random().toString(36).substr(2, 9),
                projectId: newProjectId
            }));

            const allP = getProjects(); allP.push(p); saveProjects(allP);
            const allT = getTasks(); saveTasks([...allT, ...t]);
            const allM = getMaterials(); saveMaterials([...allM, ...m]);

            showToast("Project successfully imported! Switch to Projects tab to view.", "success");
        } catch(err) {
            console.error(err);
            showToast("Failed to import project data.", "error");
        }
    });
}

// ============================================================
// FRIEND REQUESTS & ADD FRIEND
// ============================================================
function initRequestsListener() {
    if (unsubRequests) unsubRequests();
    // Listen for incoming friend requests
    const reqRef = collection(db, 'friend_requests');
    const q = query(reqRef, where('to', '==', currentUser.id), where('status', '==', 'pending'));
    
    unsubRequests = onSnapshot(q, (snapshot) => {
        const badge = document.getElementById('requests-badge');
        if (badge) {
            badge.style.display = snapshot.empty ? 'none' : 'block';
        }
    });
}

function showAddFriendModal() {
    const html = `
        <div style="text-align:center; margin-bottom: 16px;">
           <div style="font-size: 40px; margin-bottom: 8px;">🤝</div>
           <p style="color: var(--text-muted); font-size: 14px;">Enter a 5-digit NOVD ID to send a friend request.</p>
        </div>
        <div class="form-group">
           <input type="text" id="add-novd-id" class="form-input" placeholder="e.g. 12345" style="text-align:center; font-size:24px; letter-spacing:4px;" maxlength="5" />
        </div>
        <button class="btn btn-primary" id="btn-send-request" style="margin-top: 24px; width: 100%; padding: 14px;">Send Request</button>
    `;
    openModal('Add Friend', html);
    
    setTimeout(() => {
        document.getElementById('add-novd-id')?.focus();
        document.getElementById('btn-send-request')?.addEventListener('click', async () => {
            const novdId = document.getElementById('add-novd-id').value.trim();
            if (novdId.length !== 5) {
                showToast('Please enter a valid 5-digit NOVD ID', 'error');
                return;
            }
            if (novdId === currentUser.novdId) {
                showToast("You can't add yourself!", 'error');
                return;
            }

            const btn = document.getElementById('btn-send-request');
            btn.innerHTML = 'Searching...';
            btn.disabled = true;

            try {
                const q = query(collection(db, 'users'), where('novdId', '==', novdId));
                const qs = await getDocs(q);
                
                if (qs.empty) {
                    showToast('User not found with that NOVD ID.', 'error');
                    btn.innerHTML = 'Send Request';
                    btn.disabled = false;
                    return;
                }
                
                const targetUserDoc = qs.docs[0];
                const targetUser = targetUserDoc.data();
                targetUser.id = targetUserDoc.id;
                
                // Check if already friends
                if (currentUser.friends && currentUser.friends.includes(targetUser.id)) {
                    showToast('You are already friends with ' + targetUser.name, 'info');
                    closeModal();
                    return;
                }

                // Check if request already exists
                const reqQ = query(collection(db, 'friend_requests'), where('from.id', '==', currentUser.id));
                const reqQS = await getDocs(reqQ);
                let alreadySent = false;
                reqQS.forEach(doc => {
                    if (doc.data().to === targetUser.id && doc.data().status === 'pending') {
                        alreadySent = true;
                    }
                });
                
                if (alreadySent) {
                    showToast('Request already sent!', 'info');
                    closeModal();
                    return;
                }

                // Send request
                await addDoc(collection(db, 'friend_requests'), {
                    from: {
                        id: currentUser.id,
                        name: currentUser.name || 'Unknown User',
                        novdId: currentUser.novdId || '00000',
                        picture: currentUser.picture || ''
                    },
                    to: targetUser.id,
                    status: 'pending',
                    createdAt: serverTimestamp()
                });

                showToast(`Request sent to ${targetUser.name}!`, 'success');
                closeModal();
            } catch (e) {
                console.error(e);
                showToast('Error sending request', 'error');
                btn.innerHTML = 'Send Request';
                btn.disabled = false;
            }
        });
    }, 50);
}

async function showFriendRequestsModal() {
    const html = `
        <div id="requests-list-container" style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;">
           <div style="text-align:center; color: var(--text-muted); padding:20px;">Loading requests...</div>
        </div>
    `;
    openModal('Friend Requests', html);

    const container = document.getElementById('requests-list-container');
    try {
        const q = query(collection(db, 'friend_requests'), where('to', '==', currentUser.id));
        const qs = await getDocs(q);
        
        const pendingReqs = qs.docs.filter(doc => doc.data().status === 'pending');
        
        if (pendingReqs.length === 0) {
            container.innerHTML = `<div style="text-align:center; color: var(--text-muted); padding:20px;">No pending requests.</div>`;
            return;
        }

        container.innerHTML = pendingReqs.map(doc => {
            const req = doc.data();
            return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--bg-body); border-radius: 8px; border: 1px solid var(--border);">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="${req.from.picture || 'https://via.placeholder.com/40'}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                    <div>
                        <div style="font-weight: 600; font-size: 15px;">${escapeHtml(req.from.name)}</div>
                        <div style="font-size: 12px; color: var(--text-muted);">NOVD ID: ${escapeHtml(req.from.novdId)}</div>
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-primary btn-accept-req" data-reqid="${doc.id}" data-fromid="${req.from.id}" style="padding:6px 12px; font-size:12px;">Accept</button>
                    <button class="btn btn-ghost btn-reject-req" data-reqid="${doc.id}" style="padding:6px 12px; font-size:12px; color:var(--status-red);">Reject</button>
                </div>
            </div>
            `;
        }).join('');

        // Bind Accept/Reject
        document.querySelectorAll('.btn-accept-req').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const reqId = e.currentTarget.dataset.reqid;
                const fromId = e.currentTarget.dataset.fromid;
                e.currentTarget.disabled = true;
                e.currentTarget.innerHTML = '...';
                await acceptFriendRequest(reqId, fromId);
                showFriendRequestsModal(); // Refresh modal
            });
        });
        document.querySelectorAll('.btn-reject-req').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const reqId = e.currentTarget.dataset.reqid;
                e.currentTarget.disabled = true;
                await updateDoc(doc(db, 'friend_requests', reqId), { status: 'rejected' });
                showFriendRequestsModal();
            });
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = `<div style="text-align:center; color: var(--status-red);">Failed to load requests</div>`;
    }
}

async function acceptFriendRequest(reqId, fromId) {
    try {
        // 1. Update request status
        await updateDoc(doc(db, 'friend_requests', reqId), { status: 'accepted' });

        // 2. Add to each other's friends array
        await updateDoc(doc(db, 'users', currentUser.id), {
            friends: arrayUnion(fromId)
        });
        await updateDoc(doc(db, 'users', fromId), {
            friends: arrayUnion(currentUser.id)
        });

        // 3. Create a direct chat
        const chatRef = await addDoc(collection(db, 'chats'), {
            type: 'direct',
            participants: [currentUser.id, fromId],
            lastMessage: 'Chat created',
            lastUpdated: serverTimestamp()
        });

        showToast('Friend request accepted! Chat created.', 'success');
        
        // Update local state
        if (!currentUser.friends) currentUser.friends = [];
        currentUser.friends.push(fromId);
        localStorage.setItem('nova_session_user', JSON.stringify(currentUser));
        
        closeModal();
        openChat(chatRef.id);
    } catch(err) {
        console.error(err);
        showToast('Failed to accept request', 'error');
    }
}

// ============================================================
// CREATE GROUP
// ============================================================
async function showCreateGroupModal() {
    if (!currentUser.friends || currentUser.friends.length === 0) {
        showToast("You need to add friends first before creating a group.", "info");
        return;
    }

    const html = `
        <div class="form-group">
            <label class="form-label">Group Name</label>
            <input type="text" id="new-group-name" class="form-input" placeholder="e.g. Site Engineers Team" />
        </div>
        <div class="form-group" style="margin-top:16px;">
            <label class="form-label">Select Friends</label>
            <div id="group-friends-list" style="max-height:200px; overflow-y:auto; border:1px solid var(--border); border-radius:8px; padding:8px;">
                <div style="text-align:center; color:var(--text-muted); font-size:12px;">Loading friends...</div>
            </div>
        </div>
        <button class="btn btn-primary" id="btn-confirm-group" style="margin-top: 24px; width: 100%; padding: 14px;">Create Group</button>
    `;
    openModal('Create New Group', html);

    const flist = document.getElementById('group-friends-list');
    try {
        // Fetch friend profiles
        const friendsPromises = currentUser.friends.map(fid => getDoc(doc(db, 'users', fid)));
        const friendsSnaps = await Promise.all(friendsPromises);
        
        flist.innerHTML = friendsSnaps.filter(s => s.exists()).map(snap => {
            const f = snap.data();
            return `
                <label style="display:flex; align-items:center; gap:12px; padding:8px; cursor:pointer; border-radius:6px; transition:background 0.2s;">
                    <input type="checkbox" class="group-member-cb" value="${f.id}" style="width:16px; height:16px;" />
                    <img src="${f.picture || 'https://via.placeholder.com/40'}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
                    <div style="font-weight:500; font-size:14px;">${escapeHtml(f.name)}</div>
                </label>
            `;
        }).join('');

        // Add hover effects dynamically
        flist.querySelectorAll('label').forEach(lbl => {
            lbl.addEventListener('mouseenter', () => lbl.style.background = 'var(--bg-hover)');
            lbl.addEventListener('mouseleave', () => lbl.style.background = 'transparent');
        });

    } catch (err) {
        flist.innerHTML = `<div style="color:var(--status-red); text-align:center;">Failed to load friends.</div>`;
    }

    document.getElementById('btn-confirm-group')?.addEventListener('click', async () => {
        const name = document.getElementById('new-group-name').value.trim();
        const selectedIds = Array.from(document.querySelectorAll('.group-member-cb:checked')).map(cb => cb.value);
        
        if (!name) { showToast('Enter a group name', 'error'); return; }
        if (selectedIds.length === 0) { showToast('Select at least one friend', 'error'); return; }

        const btn = document.getElementById('btn-confirm-group');
        btn.innerHTML = 'Creating...';
        btn.disabled = true;

        try {
            const participants = [currentUser.id, ...selectedIds];
            const chatRef = await addDoc(collection(db, 'chats'), {
                type: 'group',
                groupName: name,
                participants: participants,
                mainAdmin: currentUser.id,
                admins: [currentUser.id],
                lastMessage: 'Group created',
                lastUpdated: serverTimestamp()
            });

            // Add system message
            await addDoc(collection(db, 'chats', chatRef.id, 'messages'), {
                text: `${currentUser.name} created the group "${name}"`,
                senderId: 'system',
                senderName: 'System',
                createdAt: serverTimestamp(),
                msgType: 'system'
            });

            showToast('Group created!', 'success');
            closeModal();
            openChat(chatRef.id);
        } catch (err) {
            console.error(err);
            showToast('Failed to create group', 'error');
            btn.innerHTML = 'Create Group';
            btn.disabled = false;
        }
    });
}

async function showChatInfoModal() {
    if (!currentChatData) return;
    const isGroup = currentChatData.type === 'group';
    
    let html = `
        <div style="text-align:center; margin-bottom: 24px;">
            <img src="${document.getElementById('active-chat-avatar').src}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border); margin-bottom:12px;">
            <h2 style="margin:0;">${escapeHtml(document.getElementById('active-chat-name').textContent)}</h2>
            ${isGroup ? `<p style="color:var(--text-muted); margin:4px 0 0 0;">${currentChatData.participants.length} Members</p>` : ''}
        </div>
    `;

    if (isGroup) {
        html += `<div style="margin-bottom:12px; font-weight:bold; font-size:14px; border-bottom:1px solid var(--border); padding-bottom:8px;">Group Members</div>`;
        html += `<div id="group-info-members-list" style="display:flex; flex-direction:column; gap:8px; max-height:200px; overflow-y:auto; margin-bottom:24px;"><div style="text-align:center; color:var(--text-muted);">Loading members...</div></div>`;
        
        const amIAdmin = currentChatData.admins && currentChatData.admins.includes(currentUser.id);
        const amIMainAdmin = currentChatData.mainAdmin === currentUser.id;

        if (amIAdmin || amIMainAdmin) {
            html += `
                <div style="border-top:1px solid var(--border); padding-top:16px; text-align:center;">
                    <button class="btn btn-primary" id="btn-delete-group" style="background:var(--status-red); border-color:var(--status-red); width:100%;">Delete Group</button>
                </div>
            `;
        }
    }

    openModal(isGroup ? 'Group Info' : 'Contact Info', html);

    if (isGroup) {
        const listDiv = document.getElementById('group-info-members-list');
        try {
            const memberPromises = currentChatData.participants.map(pid => getDoc(doc(db, 'users', pid)));
            const memberSnaps = await Promise.all(memberPromises);
            
            listDiv.innerHTML = memberSnaps.filter(s => s.exists()).map(snap => {
                const u = snap.data();
                const isMainAdmin = currentChatData.mainAdmin === u.id;
                const isAdmin = currentChatData.admins && currentChatData.admins.includes(u.id);
                
                let badge = '';
                if (isMainAdmin) badge = `<span style="font-size:10px; background:rgba(234,179,8,0.2); color:#eab308; padding:2px 6px; border-radius:4px; font-weight:bold;">Creator</span>`;
                else if (isAdmin) badge = `<span style="font-size:10px; background:rgba(59,130,246,0.2); color:#3b82f6; padding:2px 6px; border-radius:4px; font-weight:bold;">Admin</span>`;
                
                let actions = '';
                if (currentChatData.mainAdmin === currentUser.id && !isAdmin) {
                    actions = `<button class="btn btn-ghost btn-make-admin" data-uid="${u.id}" style="padding:2px 6px; font-size:11px;">Make Admin</button>`;
                }

                return `
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:8px; background:var(--bg-body); border-radius:6px; border:1px solid var(--border);">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <img src="${u.picture || 'https://via.placeholder.com/32'}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
                            <div>
                                <div style="font-weight:500; font-size:14px; display:flex; align-items:center; gap:8px;">${escapeHtml(u.name)} ${badge}</div>
                            </div>
                        </div>
                        <div>${actions}</div>
                    </div>
                `;
            }).join('');

            document.querySelectorAll('.btn-make-admin').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const uid = e.currentTarget.dataset.uid;
                    if (confirm('Are you sure you want to make this user an admin?')) {
                        try {
                            await updateDoc(doc(db, 'chats', currentChatId), {
                                admins: arrayUnion(uid)
                            });
                            showToast('User promoted to admin', 'success');
                            currentChatData.admins.push(uid);
                            closeModal();
                            setTimeout(showChatInfoModal, 100);
                        } catch (err) {
                            showToast('Failed to promote user', 'error');
                        }
                    }
                });
            });

        } catch (err) {
            listDiv.innerHTML = `<div style="color:var(--status-red); text-align:center;">Failed to load members</div>`;
        }

        const deleteBtn = document.getElementById('btn-delete-group');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (confirm('Are you absolutely sure you want to delete this group? This action cannot be undone and will delete it for all members.')) {
                    deleteBtn.innerHTML = 'Deleting...';
                    deleteBtn.disabled = true;
                    try {
                        await deleteDoc(doc(db, 'chats', currentChatId));
                        showToast('Group deleted', 'success');
                        closeModal();
                        document.getElementById('chat-header').style.visibility = 'hidden';
                        document.getElementById('chat-input-area').style.display = 'none';
                        document.getElementById('chat-messages').innerHTML = `<div style="text-align:center; color: var(--text-muted); margin: auto;"><div style="font-size:48px; margin-bottom:12px;">💬</div>Select a conversation or start a new one</div>`;
                        currentChatId = null;
                        currentChatData = null;
                    } catch (err) {
                        showToast('Failed to delete group', 'error');
                        deleteBtn.innerHTML = 'Delete Group';
                        deleteBtn.disabled = false;
                    }
                }
            });
        }
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
