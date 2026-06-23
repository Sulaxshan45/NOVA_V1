import { db, storage } from '../utils/firebase.js';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// We'll lazy import UI helpers to avoid circular dependencies if needed
// but app.js exports them, so we can import them:
import { openModal, closeModal, showToast } from '../app.js';

export function renderChat() {
    const container = document.getElementById('section-chat');
    if (!container) return;

    const stored = localStorage.getItem('nova_session_user');
    if (!stored) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">💬</div><h3>Please log in</h3><p>You must be logged in to use Team Chat.</p></div>`;
        return;
    }
    const currentUser = JSON.parse(stored);
    const company = currentUser.company || 'Global Workspace';

    // Simple check if user is a Manager/Admin
    const isManager = currentUser.designation && (
        currentUser.designation.toLowerCase().includes('manager') || 
        currentUser.designation.toLowerCase().includes('director') ||
        currentUser.designation.toLowerCase().includes('admin')
    );

    container.innerHTML = `
      <div class="section-header" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
           <h2 class="section-title">💬 Team Chat</h2>
           <p class="section-subtitle">${company}</p>
        </div>
        <div style="display:flex; gap:12px; align-items:center;">
           <input type="text" id="chat-search" class="form-input" placeholder="🔍 Search messages..." style="max-width:200px; font-size:13px; padding:6px 12px; border-radius:20px;" />
           ${isManager ? `<button class="btn btn-primary" id="btn-invite-member">👤 + Invite Member</button>` : ''}
        </div>
      </div>

      <div class="chat-layout" style="display: flex; height: calc(100vh - 160px); gap: 16px; margin-top: 16px;">
         <div class="chat-main" style="flex: 1; display: flex; flex-direction: column; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; position: relative;">
            
            <div id="chat-messages" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px;">
                <div style="text-align:center; color: var(--text-muted); margin-top: auto;">Loading messages...</div>
            </div>

            <div class="chat-input-area" style="padding: 16px; border-top: 1px solid var(--border); display: flex; gap: 12px; align-items: center; background: var(--bg-card);">
               <button class="btn btn-icon" id="btn-chat-attach" style="color:var(--text-muted)" title="Attach File">📎</button>
               <input type="file" id="chat-file-input" style="display:none;" />
               <input type="text" id="chat-input" class="form-input" style="flex: 1;" placeholder="Type a message... Use @ to mention a task" autocomplete="off" />
               <button class="btn btn-primary" id="btn-chat-send" style="min-width: 80px;">Send ↗</button>
            </div>
         </div>
      </div>
    `;

    initChatListener(company);

    // Task Mentions Logic
    const chatInput = document.getElementById('chat-input');
    let mentionPopup = document.createElement('div');
    mentionPopup.style.cssText = 'position:absolute; bottom:100%; left:20px; background:var(--bg-card); border:1px solid var(--border); border-radius:8px; display:none; max-height:150px; overflow-y:auto; width:300px; box-shadow:0 -4px 10px rgba(0,0,0,0.1); z-index:100;';
    document.querySelector('.chat-input-area').style.position = 'relative';
    document.querySelector('.chat-input-area').appendChild(mentionPopup);

    chatInput?.addEventListener('input', async (e) => {
        const val = e.target.value;
        const match = val.match(/@([a-zA-Z0-9_-]*)$/);
        
        if (match) {
            const queryText = match[1].toLowerCase();
            // Dynamically import getTasks to avoid circular deps if needed
            const { getTasks } = await import('../utils/storage.js');
            const tasks = getTasks() || [];
            
            const filtered = tasks.filter(t => t.name.toLowerCase().includes(queryText)).slice(0, 5);
            
            if (filtered.length > 0) {
                mentionPopup.innerHTML = filtered.map(t => `
                   <div class="mention-item" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--border); font-size: 13px;">
                      <span style="font-weight:bold;">${t.name}</span>
                      <div style="font-size:11px; color:var(--text-muted)">${t.status || 'Pending'}</div>
                   </div>
                `).join('');
                mentionPopup.style.display = 'block';
                
                mentionPopup.querySelectorAll('.mention-item').forEach((item, idx) => {
                    item.addEventListener('click', () => {
                        const taskName = filtered[idx].name;
                        const newVal = val.replace(/@([a-zA-Z0-9_-]*)$/, `@"${taskName}" `);
                        chatInput.value = newVal;
                        mentionPopup.style.display = 'none';
                        chatInput.focus();
                    });
                });
            } else {
                mentionPopup.style.display = 'none';
            }
        } else {
            mentionPopup.style.display = 'none';
        }
    });

    // Event Listeners
    document.getElementById('btn-chat-send')?.addEventListener('click', () => {
        mentionPopup.style.display = 'none';
        sendMessage(currentUser, company);
    });
    chatInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            mentionPopup.style.display = 'none';
            sendMessage(currentUser, company);
        }
    });
    
    document.getElementById('btn-chat-attach')?.addEventListener('click', () => {
        document.getElementById('chat-file-input')?.click();
    });
    
    document.getElementById('chat-file-input')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await uploadFileAndSend(file, currentUser, company);
        e.target.value = ''; // Reset
    });

    if (isManager) {
        document.getElementById('btn-invite-member')?.addEventListener('click', () => showInviteModal(currentUser));
    }
    document.getElementById('chat-search')?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const messages = document.querySelectorAll('.chat-message-item');
        messages.forEach(msg => {
            if (msg.innerText.toLowerCase().includes(query)) {
                msg.style.display = 'flex';
            } else {
                msg.style.display = 'none';
            }
        });
    });
}

let unsubChat = null;

function initChatListener(company) {
    if (unsubChat) unsubChat();
    
    // We listen to the specific company's chat
    const messagesRef = collection(db, 'companies', company, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));
    
    unsubChat = onSnapshot(q, (snapshot) => {
        const msgContainer = document.getElementById('chat-messages');
        if (!msgContainer) return;
        
        if (snapshot.empty) {
            msgContainer.innerHTML = `
              <div style="text-align:center; color: var(--text-muted); margin: auto;">
                <div style="font-size: 40px; margin-bottom: 12px;">👋</div>
                No messages yet. Start the conversation!
              </div>`;
            return;
        }

        msgContainer.innerHTML = '';
        const stored = localStorage.getItem('nova_session_user');
        const currentUser = stored ? JSON.parse(stored) : {};

        snapshot.forEach(doc => {
            const data = doc.data();
            const isMe = data.senderId === currentUser.id;
            
            const align = isMe ? 'flex-end' : 'flex-start';
            const bg = isMe ? 'var(--accent)' : 'var(--bg-body)';
            const color = isMe ? '#fff' : 'var(--text)';
            
            const time = data.createdAt ? new Date(data.createdAt.toMillis()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Sending...';

            let msgText = escapeHtml(data.text);
            
            // Parse Markdown links e.g. [Image: filename.jpg](url) or [File: filename.pdf](url)
            msgText = msgText.replace(/\[Image: (.*?)\]\((.*?)\)/g, '<br><a href="$2" target="_blank"><img src="$2" style="max-width:200px; border-radius:8px; margin-top:8px;"/></a>');
            msgText = msgText.replace(/\[File: (.*?)\]\((.*?)\)/g, '<br><a href="$2" target="_blank" style="color:#0af; text-decoration:underline;">📎 $1</a>');
            
            // Parse Task Mentions e.g. @"Foundation Work"
            msgText = msgText.replace(/@&quot;(.*?)&quot;/g, '<span style="color:var(--accent); font-weight:bold; background:rgba(0,102,255,0.1); padding:2px 6px; border-radius:12px; cursor:pointer;" title="Task Mention">@$1</span>');

            msgContainer.innerHTML += `
               <div class="chat-message-item" style="display: flex; flex-direction: column; align-items: ${align}; max-width: 80%; align-self: ${align}; animation: fadeIn 0.3s ease;">
                  <span style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px; padding: 0 4px;">
                    ${isMe ? 'You' : data.senderName} • ${time}
                  </span>
                  <div style="background: ${bg}; color: ${color}; padding: 12px 16px; border-radius: 16px; font-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); line-height: 1.5; word-break: break-word;">
                     ${msgText}
                  </div>
               </div>
            `;
        });
        
        // Auto-scroll to bottom
        setTimeout(() => {
            msgContainer.scrollTop = msgContainer.scrollHeight;
        }, 50);
    });
}

async function sendMessage(user, company) {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    
    input.value = '';
    
    try {
        await addDoc(collection(db, 'companies', company, 'messages'), {
            text: text,
            senderId: user.id,
            senderName: user.name,
            senderUsername: user.username || '',
            createdAt: serverTimestamp()
        });
    } catch (err) {
        console.error("Send message error", err);
        showToast("Failed to send message", "error");
    }
}

async function uploadFileAndSend(file, user, company) {
    const attachBtn = document.getElementById('btn-chat-attach');
    const originalText = attachBtn.innerHTML;
    attachBtn.innerHTML = '⏳';
    attachBtn.disabled = true;

    try {
        const fileRef = ref(storage, `companies/${company}/chat/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);

        const isImage = file.type.startsWith('image/');
        const text = isImage 
           ? `[Image: ${file.name}](${url})`
           : `[File: ${file.name}](${url})`;

        await addDoc(collection(db, 'companies', company, 'messages'), {
            text: text,
            senderId: user.id,
            senderName: user.name,
            senderUsername: user.username || '',
            createdAt: serverTimestamp(),
            fileUrl: url,
            fileName: file.name,
            fileType: file.type
        });

    } catch (err) {
        console.error("Upload error", err);
        showToast("Failed to upload file", "error");
    } finally {
        attachBtn.innerHTML = originalText;
        attachBtn.disabled = false;
    }
}

function showInviteModal(currentUser) {
    const html = `
        <div style="text-align:center; margin-bottom: 16px;">
           <div style="font-size: 40px; margin-bottom: 8px;">🤝</div>
           <p style="color: var(--text-muted); font-size: 14px;">Invite existing NOVA users to join <b>${currentUser.company}</b>.</p>
        </div>
        <div class="form-group">
           <label class="form-label">Search by Username</label>
           <input type="text" id="invite-username" class="form-input" placeholder="e.g. johndoe123" />
        </div>
        <button class="btn btn-primary" id="btn-confirm-invite" style="margin-top: 24px; width: 100%; padding: 14px;">Invite User</button>
    `;
    openModal('Add to Company Workspace', html);
    
    setTimeout(() => {
        document.getElementById('invite-username')?.focus();
        document.getElementById('btn-confirm-invite')?.addEventListener('click', async () => {
            const uname = document.getElementById('invite-username').value.trim();
            if (!uname) {
                showToast('Please enter a username', 'error');
                return;
            }
            
            const btn = document.getElementById('btn-confirm-invite');
            btn.innerHTML = 'Searching...';
            btn.disabled = true;

            try {
                const q = query(collection(db, 'users'), where('username', '==', uname));
                const qs = await getDocs(q);
                
                if (qs.empty) {
                    showToast('User not found. Ensure they have created a NOVA account.', 'error');
                    btn.innerHTML = 'Invite User';
                    btn.disabled = false;
                    return;
                }
                
                const invitedUserDoc = qs.docs[0];
                const invitedUser = invitedUserDoc.data();
                
                // Update user's company
                invitedUser.company = currentUser.company;
                await setDoc(doc(db, 'users', invitedUser.id), invitedUser);
                
                showToast(`Successfully added ${invitedUser.name} to ${currentUser.company}!`, 'success');
                closeModal();
            } catch (e) {
                console.error(e);
                showToast('Error inviting user', 'error');
                btn.innerHTML = 'Invite User';
                btn.disabled = false;
            }
        });
    }, 50);
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
